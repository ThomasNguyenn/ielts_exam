import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/security.config.js";
import User from "../models/User.model.js";

const STUDENT_PRESENCE_THROTTLE_MS = 60 * 1000;
const studentPresenceTouchedAt = new Map();

const shouldTouchStudentPresence = (userId, nowMs) => {
  const key = String(userId || "").trim();
  if (!key) return false;
  const lastTouchedAt = Number(studentPresenceTouchedAt.get(key) || 0);
  if (lastTouchedAt > 0 && nowMs - lastTouchedAt < STUDENT_PRESENCE_THROTTLE_MS) {
    return false;
  }
  studentPresenceTouchedAt.set(key, nowMs);
  return true;
};

export const touchStudentLastSeen = ({ userId, sessionId }) => {
  const safeUserId = String(userId || "").trim();
  const safeSessionId = String(sessionId || "").trim();
  if (!safeUserId || !safeSessionId) return;

  const nowMs = Date.now();
  if (!shouldTouchStudentPresence(safeUserId, nowMs)) return;

  User.updateOne(
    {
      _id: safeUserId,
      role: "student",
      activeSessionId: safeSessionId,
    },
    {
      $set: {
        lastSeenAt: new Date(nowMs),
      },
    },
  ).catch((error) => {
    console.warn("[presence] Failed to update student lastSeenAt:", error?.message || error);
  });
};

export const __resetPresenceTouchStateForTests = () => {
  studentPresenceTouchedAt.clear();
};

export const validateStudentSingleSession = async (decodedToken) => {
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

export const verifyAccessToken = async (token) => {
  if (!token || !String(token).trim()) {
    throw new Error("No token provided");
  }

  const decoded = jwt.verify(token, JWT_SECRET);
  if (decoded?.tokenType && decoded.tokenType !== "access") {
    throw new Error("Invalid token");
  }

  return validateStudentSingleSession(decoded);
};

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const validated = await verifyAccessToken(token);

    req.user = validated;
    if (validated?.role === "student") {
      touchStudentLastSeen({
        userId: validated.userId,
        sessionId: validated.sessionId,
      });
    }
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
    const decoded = await verifyAccessToken(token);
    if (!decoded) {
      return next();
    }
    req.user = decoded;
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

export const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  if (req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({ success: false, message: "Forbidden: Admin access required" });
  }
};
