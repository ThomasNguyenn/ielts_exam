import express from "express";
import { getAllUsersWithLatestScores, getUserAttempts } from "../controllers/admin.controller.js";
import { verifyToken, isStaff } from "../middleware/auth.middleware.js";

const router = express.Router();

// All routes here require verification and staff role
router.use(verifyToken, isStaff);

router.get("/scores", getAllUsersWithLatestScores);
router.get("/users/:userId/attempts", getUserAttempts);

export default router;