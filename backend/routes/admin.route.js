import express from "express";
import {
  getAllUsersWithLatestScores,
  getUserAttempts,
  getPendingStudents,
  approveStudent,
  getUsers,
  getOnlineStudents,
  repairStuckSpeakingSessions,
  retrySpeakingErrorLogs,
  retryFailedSpeakingErrorLogsBulk,
  deleteUser,
  changeUserRole,
  setStudentHomeroomTeacher,
  inviteUser,
  getInvitations,
  deleteInvitation,
} from "../controllers/admin.controller.js";
import { verifyToken, isTeacherOrAdmin, isAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// All routes here require verification and teacher/admin role
router.use(verifyToken, isTeacherOrAdmin);

router.get("/scores", getAllUsersWithLatestScores);
router.get("/users/:userId/attempts", getUserAttempts);
router.get("/students/pending", getPendingStudents);
router.get("/students/online", isAdmin, getOnlineStudents);
router.put("/students/:userId/homeroom-teacher", isAdmin, setStudentHomeroomTeacher);
router.post("/speaking/sessions/repair-stuck", isAdmin, repairStuckSpeakingSessions);
router.post("/speaking/sessions/:id/retry-error-logs", isAdmin, retrySpeakingErrorLogs);
router.post("/speaking/error-logs/retry-failed", isAdmin, retryFailedSpeakingErrorLogsBulk);
router.put("/students/:userId/approve", approveStudent);
router.get("/users", getUsers);
router.delete("/users/:userId", isAdmin, deleteUser);

// Admin-only: change user role (promote/demote)
router.put("/users/:userId/role", isAdmin, changeUserRole);

// Admin-only: invitation management
router.post("/invitations", isAdmin, inviteUser);
router.get("/invitations", isAdmin, getInvitations);
router.delete("/invitations/:invitationId", isAdmin, deleteInvitation);

export default router;
