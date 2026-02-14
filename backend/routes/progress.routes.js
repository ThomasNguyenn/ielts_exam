import express from 'express';
import * as progressController from '../controllers/progress.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All progress routes require authentication
router.use(authenticateToken);

// Get my progress
router.get('/me', progressController.getMyProgress);

// Get skill breakdown
router.get('/skills', progressController.getSkillBreakdown);

// Update skill scores (usually called after essay grading)
router.post('/update-skills', progressController.updateSkillScores);

// Mark module complete
router.post('/module-complete', progressController.markModuleComplete);

// Get badges
router.get('/badges', progressController.getBadges);

// Get streak info
router.get('/streak', progressController.getStreak);

export default router;
