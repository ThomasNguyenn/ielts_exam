import express from 'express';
import * as modelEssayController from '../controllers/modelEssay.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// All model essay routes require authentication
router.use(verifyToken);

// Get model essays (with filters)
router.get('/', modelEssayController.getModelEssays);

// Get specific model essay with full annotations
router.get('/:id', modelEssayController.getModelEssayById);

// Submit analysis task
router.post('/:id/analyze', modelEssayController.submitAnalysisTask);

export default router;
