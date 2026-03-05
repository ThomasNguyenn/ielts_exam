import express from 'express';
import multer from 'multer';
import { verifyToken, isTeacherOrAdmin } from "../middleware/auth.middleware.js";
import { createCacheInvalidator, createResponseCache, getCacheTtlSec } from '../middleware/responseCache.middleware.js';
import Test from '../models/Test.model.js';
import { getSectionAudioUploadLimitBytes } from "../services/objectStorage.service.js";
import { sendControllerError } from "../utils/controllerError.js";

import { getAllSections, getSectionById, createSection, updateSection, deleteSection, uploadSectionAudio } from '../controllers/section.controller.js';
const router = express.Router();
const sectionsCatalogCache = createResponseCache({
  namespace: "sections-catalog",
  ttlSec: getCacheTtlSec("API_RESPONSE_CACHE_TTL_SECTIONS_SEC", 180),
  scope: "role",
  tags: ["catalog:sections"],
});

const MAX_SECTION_AUDIO_BYTES = getSectionAudioUploadLimitBytes();

const sectionAudioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SECTION_AUDIO_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!String(file?.mimetype || "").toLowerCase().startsWith("audio/")) {
      const typeError = new Error("Only audio files are allowed for section uploads");
      typeError.statusCode = 415;
      typeError.code = "UNSUPPORTED_MEDIA_TYPE";
      return cb(typeError);
    }
    return cb(null, true);
  },
});

const handleSectionAudioUpload = (req, res, next) =>
  sectionAudioUpload.single("audio")(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return sendControllerError(req, res, {
        statusCode: 413,
        code: "PAYLOAD_TOO_LARGE",
        message: `Audio file exceeds max size of ${MAX_SECTION_AUDIO_BYTES} bytes`,
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

    req.cacheInvalidationTags = ['catalog:sections', 'catalog:tests', ...testTags];
    return next();
  } catch {
    req.cacheInvalidationTags = ['catalog:sections', 'catalog:tests'];
    return next();
  }
};

const invalidateTestsCache = createCacheInvalidator({
  tags: (req) => {
    if (Array.isArray(req.cacheInvalidationTags) && req.cacheInvalidationTags.length > 0) {
      return req.cacheInvalidationTags;
    }
    return ['catalog:sections', 'catalog:tests'];
  },
});

router.get("/", verifyToken, isTeacherOrAdmin, sectionsCatalogCache, getAllSections);
router.get("/:id", verifyToken, isTeacherOrAdmin, getSectionById);
router.post("/upload-audio", verifyToken, isTeacherOrAdmin, handleSectionAudioUpload, uploadSectionAudio);
router.post("/", verifyToken, isTeacherOrAdmin, collectAffectedSectionTestTags, invalidateTestsCache, createSection);
router.put("/:id", verifyToken, isTeacherOrAdmin, collectAffectedSectionTestTags, invalidateTestsCache, updateSection);
router.delete("/:id", verifyToken, isTeacherOrAdmin, collectAffectedSectionTestTags, invalidateTestsCache, deleteSection);

export default router;
