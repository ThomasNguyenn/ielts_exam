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
  changePassword,
  requestEmailChange,
  confirmEmailChange,
} from "../controllers/auth.controller.js";
import { getFirstLoginStatus, completeFirstLogin } from "../controllers/firstLogin.controller.js";
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
router.post("/change-password", verifyToken, changePassword);
router.post("/change-email/request", verifyToken, requestEmailChange);
router.post("/change-email/confirm", confirmEmailChange);
router.get("/invite/:token", validateInviteToken);
router.get("/profile", verifyToken, getProfile);
router.put("/profile", verifyToken, updateProfile);
router.get("/first-login/status", verifyToken, getFirstLoginStatus);
router.post("/first-login/complete", verifyToken, completeFirstLogin);

export default router;
