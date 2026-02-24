import User from "../models/User.model.js";
import Invitation from "../models/Invitation.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID, randomBytes, createHash } from "crypto";
import {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_IN,
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  REFRESH_COOKIE_SAMESITE,
  REFRESH_COOKIE_SECURE,
} from "../config/security.config.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../services/email.service.js";
import { handleControllerError, sendControllerError, logControllerError } from "../utils/controllerError.js";

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // bcrypt limit
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const isValidEmail = (value) => EMAIL_REGEX.test(String(value || "").trim());

const parseCookies = (cookieHeader = "") =>
  String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex <= 0) return acc;
      const key = decodeURIComponent(part.slice(0, separatorIndex).trim());
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
      acc[key] = value;
      return acc;
    }, {});

const hashToken = (token) =>
  createHash("sha256").update(String(token || ""), "utf8").digest("hex");

const decodeTokenExpiry = (token) => {
  const decoded = jwt.decode(token);
  const expSec = Number(decoded?.exp || 0);
  if (!Number.isFinite(expSec) || expSec <= 0) return null;
  return new Date(expSec * 1000);
};

const getRefreshCookieOptions = (refreshToken) => {
  const expires = decodeTokenExpiry(refreshToken);
  return {
    httpOnly: true,
    secure: REFRESH_COOKIE_SECURE || REFRESH_COOKIE_SAMESITE === "none",
    sameSite: REFRESH_COOKIE_SAMESITE,
    path: REFRESH_COOKIE_PATH,
    expires: expires || undefined,
  };
};

const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions(refreshToken));
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: REFRESH_COOKIE_SECURE || REFRESH_COOKIE_SAMESITE === "none",
    sameSite: REFRESH_COOKIE_SAMESITE,
    path: REFRESH_COOKIE_PATH,
  });
};

const issueAccessTokenForUser = (user, sessionId = null) => {
  const payload = {
    userId: user._id,
    email: user.email,
    role: user.role,
    tokenType: "access",
  };

  if (sessionId) {
    payload.sessionId = sessionId;
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
};

const issueRefreshTokenForUser = (user, sessionId = null) => {
  const payload = {
    userId: user._id,
    email: user.email,
    role: user.role,
    tokenType: "refresh",
  };
  if (sessionId) {
    payload.sessionId = sessionId;
  }

  const token = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
  return {
    token,
    expiresAt: decodeTokenExpiry(token),
  };
};

const getRefreshTokenFromRequest = (req) => {
  const cookies = parseCookies(req.headers?.cookie || "");
  return cookies[REFRESH_COOKIE_NAME] || null;
};

const pickAuthUserPayload = (user) => ({
  _id: user._id,
  email: user.email,
  name: user.name,
  role: user.role,
  isConfirmed: user.isConfirmed,
});

export const register = async (req, res) => {
  try {
    const { email, password, name, inviteToken } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password || !name) {
      return sendControllerError(req, res, { statusCode: 400, message: "Email, password, and name are required"  });
    }
    if (!isValidEmail(normalizedEmail)) {
      return sendControllerError(req, res, { statusCode: 400, message: "Invalid email format"  });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return sendControllerError(req, res, { statusCode: 400, message: passwordError  });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return sendControllerError(req, res, { statusCode: 400, message: "Email already registered"  });
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
        return sendControllerError(req, res, { statusCode: 400, message: "Invalid or expired invitation token"  });
      }

      if (invitation.email !== normalizedEmail) {
        return sendControllerError(req, res, { statusCode: 400, message: "Email does not match invitation"  });
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
      email: normalizedEmail,
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

    const accessToken = issueAccessTokenForUser(user, studentSessionId);
    const refreshToken = issueRefreshTokenForUser(user, studentSessionId);
    user.refreshTokenHash = hashToken(refreshToken.token);
    user.refreshTokenIssuedAt = new Date();
    user.refreshTokenExpiresAt = refreshToken.expiresAt;
    await user.save();

    // Send verification email only for non-invited users.
    // Roll back the created account when email delivery fails to avoid partial registration.
    if (!user.isConfirmed && verificationToken) {
      try {
        await sendVerificationEmail(user.email, verificationToken);
      } catch (mailError) {
        await User.deleteOne({ _id: user._id }).catch((rollbackError) => {
          logControllerError(req, rollbackError, {
            route: "auth.register.rollback",
            context: { createdUserId: String(user._id) },
          });
        });
        return res.status(503).json({
          success: false,
          code: "EMAIL_DELIVERY_FAILED",
          message: "Could not send verification email. Please try registering again.",
        });
      }
    }

    // Invitation persistence is best-effort so successful registrations are not lost on transient invitation failures.
    if (invitation) {
      invitation.status = "accepted";
      invitation.acceptedAt = new Date();
      await invitation.save().catch((invitationError) => {
        console.warn("Invitation acceptance update failed:", invitationError.message);
      });
    }

    setRefreshTokenCookie(res, refreshToken.token);

    res.status(201).json({
      success: true,
      data: {
        user: pickAuthUserPayload(user),
        token: accessToken,
        message: autoConfirm
          ? "Registration successful. Welcome!"
          : "Registration successful. Please check your email to verify your account.",
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return sendControllerError(req, res, { statusCode: 400, message: "Email already registered"  });
    }
    return handleControllerError(req, res, error, { route: "auth.register" });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return sendControllerError(req, res, { statusCode: 400, message: "Token is required"  });
    }

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return sendControllerError(req, res, { statusCode: 400, message: "Invalid or expired token"  });
    }

    user.isConfirmed = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    return handleControllerError(req, res, error, { route: "auth.verifyEmail" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return sendControllerError(req, res, { statusCode: 400, message: "Email is required"  });
    }

    if (!isValidEmail(normalizedEmail)) {
      return sendControllerError(req, res, { statusCode: 400, message: "Invalid email format"  });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Security: Don't reveal user existence
      return res.json({ success: true, message: "If an account exists, a reset email has been sent." });
    }

    const resetToken = randomBytes(32).toString("hex");
    user.resetPasswordToken = hashToken(resetToken);
    user.resetPasswordExpires = Date.now() + 1 * 60 * 60 * 1000; // 1 hour
    await user.save();

    await sendPasswordResetEmail(user.email, resetToken);

    res.json({ success: true, message: "If an account exists, a reset email has been sent." });
  } catch (error) {
    return handleControllerError(req, res, error, { route: "auth.forgotPassword" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return sendControllerError(req, res, { statusCode: 400, message: "Token and new password are required"  });
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return sendControllerError(req, res, { statusCode: 400, message: passwordError  });
    }

    const tokenHash = hashToken(token);
    const user = await User.findOne({
      resetPasswordExpires: { $gt: Date.now() }
    }).or([
      { resetPasswordToken: tokenHash },
      { resetPasswordToken: token }, // Backward compatibility with old plaintext tokens
    ]);

    if (!user) {
      return sendControllerError(req, res, { statusCode: 400, message: "Invalid or expired token"  });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshTokenHash = null;
    user.refreshTokenIssuedAt = null;
    user.refreshTokenExpiresAt = null;
    if (user.role === "student") {
      user.activeSessionId = createStudentSessionId();
      user.activeSessionIssuedAt = new Date();
    }
    await user.save();

    res.json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    return handleControllerError(req, res, error, { route: "auth.resetPassword" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return sendControllerError(req, res, { statusCode: 400, message: "Email and password are required"  });
    }
    if (!isValidEmail(normalizedEmail)) {
      return sendControllerError(req, res, { statusCode: 400, message: "Invalid email format"  });
    }

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return sendControllerError(req, res, { statusCode: 401, message: "Invalid credentials"  });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return sendControllerError(req, res, { statusCode: 401, message: "Invalid credentials"  });
    }

    let studentSessionId = null;
    if (user.role === "student") {
      studentSessionId = createStudentSessionId();
      user.activeSessionId = studentSessionId;
      user.activeSessionIssuedAt = new Date();
    }

    const accessToken = issueAccessTokenForUser(user, studentSessionId);
    const refreshToken = issueRefreshTokenForUser(user, studentSessionId);
    user.refreshTokenHash = hashToken(refreshToken.token);
    user.refreshTokenIssuedAt = new Date();
    user.refreshTokenExpiresAt = refreshToken.expiresAt;
    await user.save();
    setRefreshTokenCookie(res, refreshToken.token);

    res.json({
      success: true,
      data: {
        user: pickAuthUserPayload(user),
        token: accessToken,
      },
    });
  } catch (error) {
    return handleControllerError(req, res, error, { route: "auth.login" });
  }
};

export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
      clearRefreshTokenCookie(res);
      return sendControllerError(req, res, { statusCode: 401, message: "Refresh token missing"  });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch {
      clearRefreshTokenCookie(res);
      return sendControllerError(req, res, { statusCode: 401, message: "Invalid refresh token"  });
    }

    if (decoded?.tokenType !== "refresh" || !decoded?.userId) {
      clearRefreshTokenCookie(res);
      return sendControllerError(req, res, { statusCode: 401, message: "Invalid refresh token"  });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      clearRefreshTokenCookie(res);
      return sendControllerError(req, res, { statusCode: 401, message: "Invalid refresh token"  });
    }

    if (!user.refreshTokenHash || hashToken(refreshToken) !== user.refreshTokenHash) {
      clearRefreshTokenCookie(res);
      return sendControllerError(req, res, { statusCode: 401, message: "Refresh token revoked"  });
    }

    if (!user.refreshTokenExpiresAt || user.refreshTokenExpiresAt.getTime() <= Date.now()) {
      user.refreshTokenHash = null;
      user.refreshTokenIssuedAt = null;
      user.refreshTokenExpiresAt = null;
      await user.save();
      clearRefreshTokenCookie(res);
      return sendControllerError(req, res, { statusCode: 401, message: "Refresh token expired"  });
    }

    if (user.role === "student") {
      const tokenSessionId = String(decoded.sessionId || "").trim();
      const activeSessionId = String(user.activeSessionId || "").trim();
      if (!tokenSessionId || !activeSessionId || tokenSessionId !== activeSessionId) {
        clearRefreshTokenCookie(res);
        return sendControllerError(req, res, { statusCode: 401, message: "Session revoked"  });
      }
    }

    const sessionId = user.role === "student" ? String(user.activeSessionId || "").trim() : null;
    const accessToken = issueAccessTokenForUser(user, sessionId || null);
    const nextRefresh = issueRefreshTokenForUser(user, sessionId || null);

    user.refreshTokenHash = hashToken(nextRefresh.token);
    user.refreshTokenIssuedAt = new Date();
    user.refreshTokenExpiresAt = nextRefresh.expiresAt;
    await user.save();

    setRefreshTokenCookie(res, nextRefresh.token);

    return res.status(200).json({
      success: true,
      data: {
        token: accessToken,
        user: pickAuthUserPayload(user),
      },
    });
  } catch (error) {
    clearRefreshTokenCookie(res);
    return handleControllerError(req, res, error, { route: "auth.refreshAccessToken" });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        if (decoded?.userId && decoded?.tokenType === "refresh") {
          const updatePayload = {
            refreshTokenHash: null,
            refreshTokenIssuedAt: null,
            refreshTokenExpiresAt: null,
          };
          if (decoded.role === "student") {
            updatePayload.activeSessionId = createStudentSessionId();
            updatePayload.activeSessionIssuedAt = new Date();
          }

          await User.findByIdAndUpdate(decoded.userId, {
            $set: updatePayload,
          });
        }
      } catch {
        // Ignore invalid refresh token on logout.
      }
    }

    clearRefreshTokenCookie(res);
    return res.status(200).json({ success: true, message: "Logged out" });
  } catch (error) {
    clearRefreshTokenCookie(res);
    return handleControllerError(req, res, error, { route: "auth.logout" });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      return sendControllerError(req, res, { statusCode: 404, message: "User not found"  });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    return handleControllerError(req, res, error, { route: "auth.getProfile" });
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
      return sendControllerError(req, res, { statusCode: 404, message: "User not found"  });
    }

    res.json({
      success: true,
      data: user,
      message: "Profile updated successfully"
    });
  } catch (error) {
    return handleControllerError(req, res, error, { route: "auth.updateProfile" });
  }
};

export const validateInviteToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return sendControllerError(req, res, { statusCode: 400, message: "Token is required"  });
    }

    const invitation = await Invitation.findOne({
      token,
      status: "pending",
      expiresAt: { $gt: new Date() },
    }).select("email role expiresAt").lean();

    if (!invitation) {
      return sendControllerError(req, res, {
        statusCode: 404,
        message: "Invalid or expired invitation",
        details: { valid: false },
      });
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
    return handleControllerError(req, res, error, { route: "auth.validateInviteToken" });
  }
};

