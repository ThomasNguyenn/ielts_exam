import { getAllWritings, createWriting, updateWriting, deleteWriting, getWritingById, getWritingExam, submitWriting, getSubmissions, getSubmissionById, scoreSubmission } from '../controllers/writing.controller.js';
import { verifyToken, optionalVerifyToken } from '../middleware/auth.middleware.js';
import express from 'express';
const router = express.Router();

router.get("/", getAllWritings);
router.get("/submissions", verifyToken, getSubmissions); // New route for teachers
router.get("/submissions/:id", getSubmissionById); // New route for grading detail
router.post("/", createWriting);
router.get("/:id", getWritingById);
router.get("/:id/exam", getWritingExam);
router.post("/:id/submit", submitWriting);
router.post("/submissions/:id/score", scoreSubmission); // New route for scoring
router.put("/:id", updateWriting);
router.delete("/:id", deleteWriting);

export default router;
