import express from 'express';
import { verifyToken, isTeacherOrAdmin } from "../middleware/auth.middleware.js";
import { createCacheInvalidator } from '../middleware/responseCache.middleware.js';
import Test from '../models/Test.model.js';

import { getAllPassages, getPassageById, createPassage, updatePassage, deletePassage, generatePassageInsights } from '../controllers/passage.controller.js';
const router = express.Router();

const collectAffectedPassageTestTags = async (req, _res, next) => {
  try {
    const passageIds = new Set();

    const paramId = String(req.params?.id || '').trim();
    if (paramId) passageIds.add(paramId);

    const bodyId = String(req.body?._id || '').trim();
    if (bodyId) passageIds.add(bodyId);

    const explicitTestIds = [
      req.body?.test_id,
      req.body?.testId,
      ...(Array.isArray(req.body?.test_ids) ? req.body.test_ids : []),
      ...(Array.isArray(req.body?.testIds) ? req.body.testIds : []),
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    const relatedTests = passageIds.size > 0
      ? await Test.find({ reading_passages: { $in: Array.from(passageIds) } }).select('_id').lean()
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

router.get("/", verifyToken, isTeacherOrAdmin, getAllPassages);
router.post("/ai/question-insights", verifyToken, isTeacherOrAdmin, generatePassageInsights);
router.get("/:id", verifyToken, isTeacherOrAdmin, getPassageById);
router.post("/", verifyToken, isTeacherOrAdmin, collectAffectedPassageTestTags, invalidateTestsCache, createPassage);
router.put("/:id", verifyToken, isTeacherOrAdmin, collectAffectedPassageTestTags, invalidateTestsCache, updatePassage);
router.delete("/:id", verifyToken, isTeacherOrAdmin, collectAffectedPassageTestTags, invalidateTestsCache, deletePassage);

export default router;
