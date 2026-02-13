import express from 'express';
import { createStudyPlan, getMyPlan, updateTaskStatus, updateStudyPlan, getStudyHistory } from '../controllers/studyPlan.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js'; // Assuming auth middleware

const router = express.Router();

router.use(verifyToken); // All routes require auth

router.post('/', createStudyPlan);
router.get('/', getMyPlan);
router.put('/tasks/:id', updateTaskStatus);
router.put('/', updateStudyPlan);
router.get('/history', getStudyHistory);

export default router;
