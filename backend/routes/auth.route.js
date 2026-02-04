import express from "express";
import { register, login, getProfile, verifyGiftcode, updateProfile } from "../controllers/auth.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/profile", verifyToken, getProfile);
router.put("/profile", verifyToken, updateProfile);
router.post("/verify-giftcode", verifyGiftcode);

export default router;
