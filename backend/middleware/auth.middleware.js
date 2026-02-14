import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/security.config.js";
import User from "../models/User.model.js";

const validateStudentSingleSession = async (decodedToken) => {
  if (!decodedToken?.userId) {
    throw new Error("Invalid token payload");
  }

  if (decodedToken.role !== "student") {
    return decodedToken;
  }

  const user = await User.findById(decodedToken.userId)
    .select("role activeSessionId")
    .lean();

  if (!user) {
    throw new Error("User not found");
  }

  const tokenSessionId = String(decodedToken.sessionId || "").trim();
  const activeSessionId = String(user.activeSessionId || "").trim();

  if (!tokenSessionId || !activeSessionId || tokenSessionId !== activeSessionId) {
    const err = new Error("Session has been logged in on another device");
    err.code = "SESSION_REVOKED";
    throw err;
  }

  return decodedToken;
};

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const validated = await validateStudentSingleSession(decoded);

    req.user = validated;
    next();
  } catch (error) {
    if (error?.code === "SESSION_REVOKED") {
      return res.status(401).json({
        success: false,
        code: "SESSION_REVOKED",
        message: "Your account was logged in on another device.",
      });
    }
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// Optional auth: attach req.user if token is valid, otherwise continue
export const optionalVerifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const validated = await validateStudentSingleSession(decoded);
    req.user = validated;
  } catch (error) {
    // Ignore invalid token for optional auth
  }
  return next();
};
export const isTeacherOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (req.user.role === 'admin' || req.user.role === 'teacher') {
    next();
  } else {
    return res.status(403).json({ success: false, message: "Forbidden: Access restricted to teacher/admin only" });
  }
};
