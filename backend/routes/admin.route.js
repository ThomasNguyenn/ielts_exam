import express from "express";
import { getAllUsersWithLatestScores, getUserAttempts, getPendingStudents, approveStudent, getUsers, deleteUser } from "../controllers/admin.controller.js";
import { verifyToken, isTeacherOrAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// All routes here require verification and teacher/admin role
router.use(verifyToken, isTeacherOrAdmin);

router.get("/scores", getAllUsersWithLatestScores);
router.get("/users/:userId/attempts", getUserAttempts);
router.get("/students/pending", getPendingStudents);
router.put("/students/:userId/approve", approveStudent);
router.get("/users", getUsers);
router.delete("/users/:userId", deleteUser);

export default router;
