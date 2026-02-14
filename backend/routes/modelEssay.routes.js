import express from 'express';
import * as modelEssayController from '../controllers/modelEssay.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get model essays (with filters)
router.get('/', modelEssayController.getModelEssays);

// Get specific model essay with full annotations
router.get('/:id', modelEssayController.getModelEssayById);

// Submit analysis task
router.post('/:id/analyze', modelEssayController.submitAnalysisTask);

export default router;
