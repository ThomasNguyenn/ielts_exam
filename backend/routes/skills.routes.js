import express from 'express';
import * as skillsController from '../controllers/skills.controller.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All skill routes require authentication
router.use(authenticateToken);

// Get all modules
router.get('/modules', skillsController.getAllModules);

// Get specific module
router.get('/modules/:id', skillsController.getModuleById);

// Complete module
router.post('/modules/:id/complete', skillsController.completeModule);

// Submit quiz
router.post('/modules/:id/quiz', skillsController.submitQuiz);

export default router;
