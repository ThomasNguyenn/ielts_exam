import express from 'express';

import { getAllTests, getTestCategories, createTest, updateTest, deleteTest, getTheTestById, getExamData, submitExam, getMyLatestAttempts, getMyAttemptSummary, getMyTestAttempts, renumberTestQuestions } from '../controllers/test.controller.js';
import { verifyToken, optionalVerifyToken, isTeacherOrAdmin } from '../middleware/auth.middleware.js';
const router = express.Router();

router.get("/", getAllTests);
router.get("/categories", getTestCategories);
router.post("/", verifyToken, isTeacherOrAdmin, createTest);
router.get("/my-attempts-summary", verifyToken, getMyAttemptSummary);
router.get("/my-latest-attempts", verifyToken, getMyLatestAttempts);
router.get("/:id/exam", getExamData);
router.post("/:id/submit", verifyToken, submitExam);
router.get("/:id/attempts", verifyToken, getMyTestAttempts);
router.get("/:id", getTheTestById);
router.put("/:id", verifyToken, isTeacherOrAdmin, updateTest);
router.post("/:id/renumber", verifyToken, isTeacherOrAdmin, renumberTestQuestions);
router.delete("/:id", verifyToken, isTeacherOrAdmin, deleteTest);

export default router;
