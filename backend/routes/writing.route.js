import { getAllWritings, createWriting, updateWriting, deleteWriting, getWritingById, getWritingExam, submitWriting, getSubmissions, getSubmissionById, scoreSubmission, regenerateWritingId, scoreSubmissionAI } from '../controllers/writing.controller.js';
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
router.post("/submissions/:id/score", verifyToken, scoreSubmission); // New route for scoring
router.post("/submissions/:id/ai-score", verifyToken, scoreSubmissionAI); // New route for AI scoring
router.post("/:id/regenerate-id", regenerateWritingId);
router.put("/:id", updateWriting);
// router.post("/:id/regenerate-id", import('../controllers/writing.controller.js').then(m => m.regenerateWritingId).catch(e => console.error(e))); // Dynamic import wrapper or just import it at top?
// Better to just export it in controller and import at top. 
// But since I used dynamic imports inside controller for Models, I should just import it standardly.
// Wait, I am editing the route file. I should add `regenerateWritingId` to imports.
router.delete("/:id", deleteWriting);

export default router;
