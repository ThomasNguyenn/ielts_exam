import express from 'express';

import { getAllTests, createTest, updateTest, deleteTest, getTheTestById, getExamData, submitExam, getMyLatestAttempts, getMyAttemptSummary, getMyTestAttempts, renumberTestQuestions } from '../controllers/test.controller.js';
import { verifyToken, optionalVerifyToken } from '../middleware/auth.middleware.js';
const router = express.Router();

router.get("/", getAllTests);
router.post("/", createTest);
router.get("/my-attempts-summary", verifyToken, getMyAttemptSummary);
router.get("/my-latest-attempts", verifyToken, getMyLatestAttempts);
router.get("/:id/exam", getExamData);
router.post("/:id/submit", optionalVerifyToken, submitExam);
router.get("/:id/attempts", verifyToken, getMyTestAttempts);
router.get("/:id", getTheTestById);
router.put("/:id", updateTest);
router.post("/:id/renumber", verifyToken, renumberTestQuestions);
router.delete("/:id", deleteTest);

export default router;
