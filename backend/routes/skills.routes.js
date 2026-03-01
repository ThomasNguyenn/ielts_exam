import express from 'express';
import * as skillsController from '../controllers/skills.controller.js';
import { verifyToken, isTeacherOrAdmin } from '../middleware/auth.middleware.js';
import { createCacheInvalidator, createResponseCache, getCacheTtlSec } from '../middleware/responseCache.middleware.js';

const router = express.Router();

// All skill routes require authentication
router.use(verifyToken);

const skillsCatalogCache = createResponseCache({
  namespace: "skills-catalog",
  ttlSec: getCacheTtlSec("API_RESPONSE_CACHE_TTL_SKILLS_SEC", 300),
  scope: "public",
  tags: ["catalog:skills"],
});
const invalidateSkillsCatalog = createCacheInvalidator({
  tags: ["catalog:skills"],
});

// Get categories summary
router.get('/categories', skillsCatalogCache, skillsController.getCategories);

// Get all modules
router.get('/modules', skillsCatalogCache, skillsController.getAllModules);

// Get specific module
router.get('/modules/:id', skillsCatalogCache, skillsController.getModuleById);

// Teacher/Admin management routes
router.get('/admin/modules', isTeacherOrAdmin, skillsController.getAllModulesForManage);
router.post('/admin/modules/reorder', isTeacherOrAdmin, invalidateSkillsCatalog, skillsController.reorderModules);
router.get('/admin/modules/:id', isTeacherOrAdmin, skillsController.getModuleByIdForManage);
router.post('/admin/modules', isTeacherOrAdmin, invalidateSkillsCatalog, skillsController.createModule);
router.put('/admin/modules/:id', isTeacherOrAdmin, invalidateSkillsCatalog, skillsController.updateModule);
router.delete('/admin/modules/:id', isTeacherOrAdmin, invalidateSkillsCatalog, skillsController.deleteModule);

// Complete module
router.post('/modules/:id/complete', skillsController.completeModule);

// Submit quiz
router.post('/modules/:id/quiz', skillsController.submitQuiz);

export default router;
