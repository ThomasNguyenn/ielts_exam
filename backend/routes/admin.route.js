import express from "express";
import { getAllUsersWithLatestScores, getUserAttempts, getPendingStudents, approveStudent, getUsers, deleteUser, changeUserRole, inviteUser, getInvitations } from "../controllers/admin.controller.js";
import { verifyToken, isTeacherOrAdmin, isAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// All routes here require verification and teacher/admin role
router.use(verifyToken, isTeacherOrAdmin);

router.get("/scores", getAllUsersWithLatestScores);
router.get("/users/:userId/attempts", getUserAttempts);
router.get("/students/pending", getPendingStudents);
router.put("/students/:userId/approve", approveStudent);
router.get("/users", getUsers);
router.delete("/users/:userId", deleteUser);

// Admin-only: change user role (promote/demote)
router.put("/users/:userId/role", isAdmin, changeUserRole);

// Admin-only: invitation management
router.post("/invitations", isAdmin, inviteUser);
router.get("/invitations", isAdmin, getInvitations);

export default router;
