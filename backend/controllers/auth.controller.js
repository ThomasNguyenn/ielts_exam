import User from "../models/User.model.js";
import Invitation from "../models/Invitation.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID, randomBytes } from "crypto";
import { JWT_SECRET } from "../config/security.config.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../services/email.service.js";

const ALLOWED_ROLES = new Set(["student", "teacher", "admin"]);
const JWT_EXPIRES_IN = "7d";

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // bcrypt limit
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

const validatePassword = (password) => {
  if (!password || password.length < PASSWORD_MIN) {
    return `Password must be at least ${PASSWORD_MIN} characters`;
  }
  if (password.length > PASSWORD_MAX) {
    return `Password must not exceed ${PASSWORD_MAX} characters`;
  }
  if (!PASSWORD_REGEX.test(password)) {
    return "Password must contain at least one uppercase letter, one lowercase letter, and one digit";
  }
  return null;
};

const createStudentSessionId = () => randomUUID();

const issueTokenForUser = (user, sessionId = null) => {
  const payload = {
    userId: user._id,
    email: user.email,
    role: user.role,
  };

  if (sessionId) {
    payload.sessionId = sessionId;
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

export const register = async (req, res) => {
  try {
    const { email, password, name, inviteToken } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: "Email, password, and name are required" });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    // Resolve invitation if invite token is provided
    let assignedRole = "student";
    let autoConfirm = false;
    let invitation = null;

    if (inviteToken) {
      invitation = await Invitation.findOne({
        token: inviteToken,
        status: "pending",
        expiresAt: { $gt: new Date() },
      });

      if (!invitation) {
        return res.status(400).json({ success: false, message: "Invalid or expired invitation token" });
      }

      if (invitation.email !== email.toLowerCase()) {
        return res.status(400).json({ success: false, message: "Email does not match invitation" });
      }

      assignedRole = invitation.role;
      autoConfirm = true;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate verification token (only for non-invited students)
    const verificationToken = autoConfirm ? null : randomBytes(32).toString("hex");
    const verificationTokenExpires = autoConfirm ? null : Date.now() + 24 * 60 * 60 * 1000;

    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role: assignedRole,
      isConfirmed: autoConfirm,
      verificationToken,
      verificationTokenExpires,
    });

    let studentSessionId = null;
    if (user.role === "student") {
      studentSessionId = createStudentSessionId();
      user.activeSessionId = studentSessionId;
      user.activeSessionIssuedAt = new Date();
    }

    await user.save();

    // Mark invitation as accepted
    if (invitation) {
      invitation.status = "accepted";
      invitation.acceptedAt = new Date();
      await invitation.save();
    }

    // Send verification email only for non-invited users
    if (!user.isConfirmed && verificationToken) {
      await sendVerificationEmail(user.email, verificationToken);
    }

    const token = issueTokenForUser(user, studentSessionId);

    res.status(201).json({
      success: true,
      data: {
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          isConfirmed: user.isConfirmed,
        },
        token,
        message: autoConfirm
          ? "Registration successful. Welcome!"
          : "Registration successful. Please check your email to verify your account.",
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }
    console.error("Register Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired token" });
    }

    user.isConfirmed = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    console.error("Verify Email Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Security: Don't reveal user existence
      return res.json({ success: true, message: "If an account exists, a reset email has been sent." });
    }

    const resetToken = randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 1 * 60 * 60 * 1000; // 1 hour
    await user.save();

    await sendPasswordResetEmail(user.email, resetToken);

    res.json({ success: true, message: "If an account exists, a reset email has been sent." });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: "Token and new password are required" });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ success: false, message: passwordError });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired token" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    let studentSessionId = null;
    if (user.role === "student") {
      studentSessionId = createStudentSessionId();
      user.activeSessionId = studentSessionId;
      user.activeSessionIssuedAt = new Date();
      await user.save();
    }

    const token = issueTokenForUser(user, studentSessionId);

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          isConfirmed: user.isConfirmed,
        },
        token,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { targets, name } = req.body;

    const updateFields = {};
    if (name) updateFields.name = name;
    if (targets) {
      updateFields.targets = targets;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      data: user,
      message: "Profile updated successfully"
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

export const validateInviteToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    const invitation = await Invitation.findOne({
      token,
      status: "pending",
      expiresAt: { $gt: new Date() },
    }).select("email role expiresAt").lean();

    if (!invitation) {
      return res.status(404).json({ success: false, valid: false, message: "Invalid or expired invitation" });
    }

    res.json({
      success: true,
      valid: true,
      data: {
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
      },
    });
  } catch (error) {
    console.error("Error in validateInviteToken:", error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};
