import {
  archiveSubmission,
  closeLiveRoom,
  createSubmissionLiveRoom,
  createWriting,
  deleteWriting,
  getAllWritings,
  getLiveRoomSharedContext,
  getSubmissionById,
  getSubmissionStudents,
  getSubmissionStatus,
  getSubmissions,
  getWritingById,
  getWritingExam,
  regenerateWritingId,
  resolveLiveRoom,
  scoreSubmission,
  scoreSubmissionAIFast,
  scoreSubmissionAI,
  submitWriting,
  updateWriting,
  uploadImage,
} from '../controllers/writing.controller.js';
import { verifyToken, optionalVerifyToken, isTeacherOrAdmin } from '../middleware/auth.middleware.js';
import { createCacheInvalidator, createResponseCache, getCacheTtlSec } from '../middleware/responseCache.middleware.js';
import express from 'express';
import multer from 'multer';

const router = express.Router();

const MAX_WRITING_IMAGE_BYTES = Number(process.env.WRITING_IMAGE_MAX_BYTES || 2 * 1024 * 1024);
const ALLOWED_WRITING_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_WRITING_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_WRITING_IMAGE_MIME_TYPES.has(file.mimetype)) {
      const typeError = new Error("Only JPEG, PNG, and WEBP images are allowed for writing uploads");
      typeError.statusCode = 415;
      typeError.code = "UNSUPPORTED_MEDIA_TYPE";
      return cb(typeError);
    }
    return cb(null, true);
  },
});

const writingsCatalogCache = createResponseCache({
  namespace: "writings-catalog",
  ttlSec: getCacheTtlSec("API_RESPONSE_CACHE_TTL_WRITINGS_SEC", 180),
  scope: "role",
  tags: ["catalog:writings"],
});
const invalidateWritingsCatalog = createCacheInvalidator({
  tags: ["catalog:writings"],
});

router.get("/", optionalVerifyToken, writingsCatalogCache, getAllWritings);
router.get("/submissions", verifyToken, isTeacherOrAdmin, getSubmissions);
router.get("/submissions/students", verifyToken, isTeacherOrAdmin, getSubmissionStudents);
router.get("/submissions/:id", verifyToken, isTeacherOrAdmin, getSubmissionById);
router.get("/submissions/:id/status", verifyToken, getSubmissionStatus);
router.post("/submissions/:id/live-room", verifyToken, isTeacherOrAdmin, createSubmissionLiveRoom);
router.post("/live-room/resolve", verifyToken, resolveLiveRoom);
router.get("/live-room/:roomCode/context", verifyToken, getLiveRoomSharedContext);
router.post("/live-room/:roomCode/close", verifyToken, isTeacherOrAdmin, closeLiveRoom);
router.post("/", verifyToken, isTeacherOrAdmin, invalidateWritingsCatalog, createWriting);
router.post("/upload-image", verifyToken, isTeacherOrAdmin, upload.single('image'), uploadImage);
router.get("/:id", optionalVerifyToken, writingsCatalogCache, getWritingById);
router.get("/:id/exam", optionalVerifyToken, writingsCatalogCache, getWritingExam);
router.post("/:id/submit", verifyToken, submitWriting);
router.put("/submissions/:id/archive", verifyToken, isTeacherOrAdmin, archiveSubmission);
router.post("/submissions/:id/score", verifyToken, isTeacherOrAdmin, scoreSubmission);
router.post("/submissions/:id/ai-fast-score", verifyToken, scoreSubmissionAIFast);
router.post("/submissions/:id/ai-score", verifyToken, scoreSubmissionAI);
router.post("/:id/regenerate-id", verifyToken, isTeacherOrAdmin, invalidateWritingsCatalog, regenerateWritingId);
router.put("/:id", verifyToken, isTeacherOrAdmin, invalidateWritingsCatalog, updateWriting);
router.delete("/:id", verifyToken, isTeacherOrAdmin, invalidateWritingsCatalog, deleteWriting);

export default router;
