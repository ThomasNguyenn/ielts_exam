import express from 'express';
import multer from 'multer';
import { verifyToken, optionalVerifyToken, isTeacherOrAdmin } from "../middleware/auth.middleware.js";
import { createCacheInvalidator, createResponseCache, getCacheTtlSec } from '../middleware/responseCache.middleware.js';
import Test from '../models/Test.model.js';
import { sendControllerError } from '../utils/controllerError.js';

import {
  getAllPassages,
  getPassageById,
  createPassage,
  updatePassage,
  deletePassage,
  generatePassageInsights,
  uploadPassageDiagramImage,
} from '../controllers/passage.controller.js';
const router = express.Router();
const MAX_PASSAGE_DIAGRAM_IMAGE_BYTES = Number(process.env.PASSAGE_DIAGRAM_IMAGE_MAX_BYTES || 5 * 1024 * 1024);
const ALLOWED_PASSAGE_DIAGRAM_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const diagramImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PASSAGE_DIAGRAM_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_PASSAGE_DIAGRAM_IMAGE_MIME_TYPES.has(file.mimetype)) {
      const typeError = new Error('Only JPEG, PNG, and WEBP images are allowed for diagram uploads');
      typeError.statusCode = 415;
      typeError.code = 'UNSUPPORTED_MEDIA_TYPE';
      return cb(typeError);
    }
    return cb(null, true);
  },
});

const handlePassageDiagramImageUpload = (req, res, next) =>
  diagramImageUpload.single('image')(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return sendControllerError(req, res, {
        statusCode: 413,
        code: 'PAYLOAD_TOO_LARGE',
        message: `Image file exceeds max size of ${MAX_PASSAGE_DIAGRAM_IMAGE_BYTES} bytes`,
      });
    }

    if (error?.statusCode) {
      return sendControllerError(req, res, {
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
      });
    }

    return next(error);
  });

const passagesCatalogCache = createResponseCache({
  namespace: "passages-catalog",
  ttlSec: getCacheTtlSec("API_RESPONSE_CACHE_TTL_PASSAGES_SEC", 180),
  scope: "role",
  tags: ["catalog:passages"],
});

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

    req.cacheInvalidationTags = ['catalog:passages', 'catalog:tests', ...testTags];
    return next();
  } catch {
    req.cacheInvalidationTags = ['catalog:passages', 'catalog:tests'];
    return next();
  }
};

const invalidateTestsCache = createCacheInvalidator({
  tags: (req) => {
    if (Array.isArray(req.cacheInvalidationTags) && req.cacheInvalidationTags.length > 0) {
      return req.cacheInvalidationTags;
    }
    return ['catalog:passages', 'catalog:tests'];
  },
});

router.get("/", optionalVerifyToken, passagesCatalogCache, getAllPassages);
router.post("/ai/question-insights", verifyToken, isTeacherOrAdmin, generatePassageInsights);
router.post("/upload-diagram-image", verifyToken, isTeacherOrAdmin, handlePassageDiagramImageUpload, uploadPassageDiagramImage);
router.get("/:id", verifyToken, isTeacherOrAdmin, getPassageById);
router.post("/", verifyToken, isTeacherOrAdmin, collectAffectedPassageTestTags, invalidateTestsCache, createPassage);
router.put("/:id", verifyToken, isTeacherOrAdmin, collectAffectedPassageTestTags, invalidateTestsCache, updatePassage);
router.delete("/:id", verifyToken, isTeacherOrAdmin, collectAffectedPassageTestTags, invalidateTestsCache, deletePassage);

export default router;
