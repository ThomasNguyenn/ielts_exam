import express from "express";
import { getSkillsBreakdown, getWeaknessAnalysis, getProgressHistory, getStudentAnalytics } from "../controllers/analytics.controller.js";
import { verifyToken, isTeacherOrAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(verifyToken);

// User Analytics
router.get("/skills", getSkillsBreakdown);
router.get("/weaknesses", getWeaknessAnalysis);
router.get("/history", getProgressHistory);

// Admin Analytics
router.get("/admin/:studentId", isTeacherOrAdmin, getStudentAnalytics);

export default router;
