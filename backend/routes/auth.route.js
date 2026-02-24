import express from "express";
import {
  register,
  login,
  refreshAccessToken,
  logout,
  getProfile,
  updateProfile,
  verifyEmail,
  forgotPassword,
  resetPassword,
  validateInviteToken,
} from "../controllers/auth.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import { requireTrustedOrigin } from "../middleware/csrf.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", requireTrustedOrigin, refreshAccessToken);
router.post("/logout", requireTrustedOrigin, logout);
router.post("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/invite/:token", validateInviteToken);
router.get("/profile", verifyToken, getProfile);
router.put("/profile", verifyToken, updateProfile);

export default router;
