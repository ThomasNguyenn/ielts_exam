import User from "../models/User.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID, randomBytes } from "crypto";
import { JWT_SECRET, VALID_GIFTCODES } from "../config/security.config.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../services/email.service.js";

const ALLOWED_ROLES = new Set(["student", "teacher", "admin"]);
const JWT_EXPIRES_IN = "7d";

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
    const { email, password, name, role, giftcode } = req.body;
    const requestedRole = (typeof role === "string" ? role.toLowerCase().trim() : "student") || "student";
    const normalizedGiftcode = giftcode?.trim().toUpperCase();

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: "Email, password, and name are required" });
    }

    if (!ALLOWED_ROLES.has(requestedRole)) {
      return res.status(400).json({ success: false, message: "Role must be one of: student, teacher, admin" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    // If registering as teacher or admin, validate giftcode
    if (requestedRole === 'teacher' || requestedRole === 'admin') {
      if (!normalizedGiftcode) {
        return res.status(400).json({ success: false, message: `Giftcode is required for ${requestedRole} registration` });
      }

      const validRole = VALID_GIFTCODES[normalizedGiftcode];
      if (!validRole || validRole !== requestedRole) {
        return res.status(400).json({ success: false, message: "Invalid giftcode for this role" });
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (requestedRole === "student" && normalizedGiftcode) {
      return res.status(400).json({ success: false, message: "Giftcode is not used for student registration" });
    }

    const finalRole = requestedRole;

    // Generate verification token
    const verificationToken = randomBytes(32).toString('hex');
    const verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Create user
    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      role: finalRole,
      giftcode: normalizedGiftcode || null,
      isConfirmed: finalRole === 'teacher' || finalRole === 'admin' ? true : false, // Auto-confirm teachers/admins? Or require email too? 
      // For now, let's stick to existing logic for isConfirmed but add token
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

    // Send verification email
    // We only send if not auto-confirmed (or maybe always send welcome?)
    if (!user.isConfirmed) {
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
        message: "Registration successful. Please check your email to verify your account.",
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

    // Build update object
    const updateFields = {};
    if (name) updateFields.name = name;
    if (targets) {
      // Ensure targets are preserved if partial update, but we can just set the object for now or merge deep if needed
      // Assuming frontend sends full targets object or we use dot notation for partials if using mongoose directly
      // Here we replace the targets object or specific fields if provided
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

// Admin endpoint to verify giftcode (returns 200 with valid status)
export const verifyGiftcode = async (req, res) => {
  const { giftcode, role } = req.body;
  const normalizedRole = typeof role === "string" ? role.toLowerCase().trim() : "";
  const normalizedGiftcode = giftcode?.trim().toUpperCase();

  if (!normalizedGiftcode || !normalizedRole || !ALLOWED_ROLES.has(normalizedRole) || normalizedRole === "student") {
    return res.status(200).json({ success: true, valid: false, message: "Valid giftcode and teacher/admin role are required" });
  }

  const validRole = VALID_GIFTCODES[normalizedGiftcode];
  if (validRole && validRole === normalizedRole) {
    res.status(200).json({ success: true, valid: true, message: "Valid giftcode" });
  } else {
    res.status(200).json({ success: true, valid: false, message: "Invalid giftcode" });
  }
};
