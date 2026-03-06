import bcrypt from "bcryptjs";
import User from "../models/User.model.js";
import { handleControllerError, sendControllerError } from "../utils/controllerError.js";
import { resolveStudentRoleFromStudyTrack } from "../utils/role.utils.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const pickAuthUserPayload = (user) => ({
  _id: user._id,
  email: user.email,
  name: user.name,
  role: user.role,
  isConfirmed: user.isConfirmed,
  createdByTeacherBulk: Boolean(user?.createdByTeacherBulk),
  mustCompleteFirstLogin: Boolean(user?.mustCompleteFirstLogin),
});

export const getFirstLoginStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select("_id createdByTeacherBulk mustCompleteFirstLogin")
      .lean();

    if (!user) {
      return sendControllerError(req, res, { statusCode: 404, message: "User not found" });
    }

    return res.json({
      success: true,
      data: {
        createdByTeacherBulk: Boolean(user.createdByTeacherBulk),
        mustCompleteFirstLogin: Boolean(user.mustCompleteFirstLogin),
      },
    });
  } catch (error) {
    return handleControllerError(req, res, error, { route: "auth.getFirstLoginStatus" });
  }
};

export const completeFirstLogin = async (req, res) => {
  try {
    const { email, password, studyTrack } = req.body || {};
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      return sendControllerError(req, res, { statusCode: 400, message: "A valid email is required" });
    }

    const newPassword = String(password || "");
    if (newPassword.length < 8) {
      return sendControllerError(req, res, {
        statusCode: 400,
        message: "Password must be at least 8 characters",
      });
    }

    const nextRole = resolveStudentRoleFromStudyTrack(studyTrack);
    if (!nextRole) {
      return sendControllerError(req, res, {
        statusCode: 400,
        message: "studyTrack is required and must be one of: ielts, aca",
      });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return sendControllerError(req, res, { statusCode: 404, message: "User not found" });
    }

    if (!user.mustCompleteFirstLogin) {
      return res.json({
        success: true,
        message: "First login setup already completed",
        data: { user: pickAuthUserPayload(user) },
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: user._id },
    }).select("_id").lean();

    if (existingUser) {
      return sendControllerError(req, res, { statusCode: 400, message: "Email already registered" });
    }

    user.email = normalizedEmail;
    user.password = await bcrypt.hash(newPassword, 10);
    user.role = nextRole;
    user.mustCompleteFirstLogin = false;
    user.firstLoginCompletedAt = new Date();

    await user.save();

    return res.json({
      success: true,
      message: "First login setup completed successfully",
      data: { user: pickAuthUserPayload(user) },
    });
  } catch (error) {
    return handleControllerError(req, res, error, { route: "auth.completeFirstLogin" });
  }
};
