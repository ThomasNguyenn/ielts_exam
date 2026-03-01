import express from 'express';
import * as modelEssayController from '../controllers/modelEssay.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import { createResponseCache, getCacheTtlSec } from '../middleware/responseCache.middleware.js';

const router = express.Router();

// All model essay routes require authentication
router.use(verifyToken);

const modelEssayCache = createResponseCache({
  namespace: "model-essays",
  ttlSec: getCacheTtlSec("API_RESPONSE_CACHE_TTL_MODEL_ESSAYS_SEC", 300),
  scope: "public",
  tags: ["catalog:model-essays"],
});

// Get model essays (with filters)
router.get('/', modelEssayCache, modelEssayController.getModelEssays);

// Get specific model essay with full annotations
router.get('/:id', modelEssayCache, modelEssayController.getModelEssayById);

// Submit analysis task
router.post('/:id/analyze', modelEssayController.submitAnalysisTask);

export default router;
