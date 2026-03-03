import express from 'express';
import { submitEvaluations, getEvaluationStatus } from '../controllers/evaluation.controller.js';
import { verifyToken, isTeacherOrAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// All evaluation routes require teacher/admin authentication
router.use(verifyToken, isTeacherOrAdmin);

router.post('/submit', submitEvaluations);
router.get('/status/:requestId', getEvaluationStatus);

export default router;
