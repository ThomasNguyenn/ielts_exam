import express from 'express';
import * as skillsController from '../controllers/skills.controller.js';
import { verifyToken, isTeacherOrAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// All skill routes require authentication
router.use(verifyToken);

// Get all modules
router.get('/modules', skillsController.getAllModules);

// Get specific module
router.get('/modules/:id', skillsController.getModuleById);

// Teacher/Admin management routes
router.get('/admin/modules', isTeacherOrAdmin, skillsController.getAllModulesForManage);
router.post('/admin/modules/reorder', isTeacherOrAdmin, skillsController.reorderModules);
router.get('/admin/modules/:id', isTeacherOrAdmin, skillsController.getModuleByIdForManage);
router.post('/admin/modules', isTeacherOrAdmin, skillsController.createModule);
router.put('/admin/modules/:id', isTeacherOrAdmin, skillsController.updateModule);
router.delete('/admin/modules/:id', isTeacherOrAdmin, skillsController.deleteModule);

// Complete module
router.post('/modules/:id/complete', skillsController.completeModule);

// Submit quiz
router.post('/modules/:id/quiz', skillsController.submitQuiz);

export default router;
