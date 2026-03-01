import express from 'express';
import { verifyToken, isTeacherOrAdmin } from "../middleware/auth.middleware.js";
import { createCacheInvalidator } from '../middleware/responseCache.middleware.js';
import Test from '../models/Test.model.js';

import { getAllSections, getSectionById, createSection, updateSection, deleteSection } from '../controllers/section.controller.js';
const router = express.Router();

const collectAffectedSectionTestTags = async (req, _res, next) => {
  try {
    const sectionIds = new Set();

    const paramId = String(req.params?.id || '').trim();
    if (paramId) sectionIds.add(paramId);

    const bodyId = String(req.body?._id || '').trim();
    if (bodyId) sectionIds.add(bodyId);

    const explicitTestIds = [
      req.body?.test_id,
      req.body?.testId,
      ...(Array.isArray(req.body?.test_ids) ? req.body.test_ids : []),
      ...(Array.isArray(req.body?.testIds) ? req.body.testIds : []),
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    const relatedTests = sectionIds.size > 0
      ? await Test.find({ listening_sections: { $in: Array.from(sectionIds) } }).select('_id').lean()
      : [];

    const relatedTestIds = relatedTests
      .map((item) => String(item?._id || '').trim())
      .filter(Boolean);

    const allTestIds = [...new Set([...explicitTestIds, ...relatedTestIds])];
    const testTags = allTestIds.map((testId) => `test:${testId}`);

    req.cacheInvalidationTags = ['catalog:tests', ...testTags];
    return next();
  } catch {
    req.cacheInvalidationTags = ['catalog:tests'];
    return next();
  }
};

const invalidateTestsCache = createCacheInvalidator({
  tags: (req) => {
    if (Array.isArray(req.cacheInvalidationTags) && req.cacheInvalidationTags.length > 0) {
      return req.cacheInvalidationTags;
    }
    return ['catalog:tests'];
  },
});

router.get("/", verifyToken, isTeacherOrAdmin, getAllSections);
router.get("/:id", verifyToken, isTeacherOrAdmin, getSectionById);
router.post("/", verifyToken, isTeacherOrAdmin, collectAffectedSectionTestTags, invalidateTestsCache, createSection);
router.put("/:id", verifyToken, isTeacherOrAdmin, collectAffectedSectionTestTags, invalidateTestsCache, updateSection);
router.delete("/:id", verifyToken, isTeacherOrAdmin, collectAffectedSectionTestTags, invalidateTestsCache, deleteSection);

export default router;
