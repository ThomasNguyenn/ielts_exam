import express from 'express';

import { getAllTests, getTestCategories, createTest, updateTest, deleteTest, getTheTestById, getExamData, submitExam, getMyLatestAttempts, getMyAttemptSummary, getMyTestAttempts, getMyAttemptResult, renumberTestQuestions } from '../controllers/test.controller.js';
import { verifyToken, optionalVerifyToken, isTeacherOrAdmin } from '../middleware/auth.middleware.js';
import { createCacheInvalidator, createResponseCache, getCacheTtlSec } from '../middleware/responseCache.middleware.js';
const router = express.Router();

const testsCatalogCache = createResponseCache({
  namespace: "tests-catalog",
  ttlSec: getCacheTtlSec("API_RESPONSE_CACHE_TTL_TESTS_SEC", 180),
  scope: "public",
  tags: ["catalog:tests"],
});
const testsDetailCache = createResponseCache({
  namespace: "tests-detail",
  ttlSec: getCacheTtlSec("API_RESPONSE_CACHE_TTL_TESTS_SEC", 180),
  scope: "role",
  tags: (req) => {
    const testId = String(req.params?.id || '').trim();
    return testId ? ["catalog:tests", `test:${testId}`] : ["catalog:tests"];
  },
});
const invalidateTestsCatalog = createCacheInvalidator({
  tags: ["catalog:tests"],
});
const invalidateCurrentTestDetail = createCacheInvalidator({
  tags: (req) => {
    const testId = String(req.params?.id || '').trim();
    return testId ? ["catalog:tests", `test:${testId}`] : ["catalog:tests"];
  },
});

router.get("/", testsCatalogCache, getAllTests);
router.get("/categories", testsCatalogCache, getTestCategories);
router.post("/", verifyToken, isTeacherOrAdmin, invalidateTestsCatalog, createTest);
router.get("/my-attempts-summary", verifyToken, getMyAttemptSummary);
router.get("/my-latest-attempts", verifyToken, getMyLatestAttempts);
router.get("/attempts/:attemptId/result", verifyToken, getMyAttemptResult);
router.get("/:id/exam", optionalVerifyToken, testsDetailCache, getExamData);
router.post("/:id/submit", verifyToken, submitExam);
router.get("/:id/attempts", verifyToken, getMyTestAttempts);
router.get("/:id", optionalVerifyToken, testsDetailCache, getTheTestById);
router.put("/:id", verifyToken, isTeacherOrAdmin, invalidateCurrentTestDetail, updateTest);
router.post("/:id/renumber", verifyToken, isTeacherOrAdmin, invalidateCurrentTestDetail, renumberTestQuestions);
router.delete("/:id", verifyToken, isTeacherOrAdmin, invalidateCurrentTestDetail, deleteTest);

export default router;
