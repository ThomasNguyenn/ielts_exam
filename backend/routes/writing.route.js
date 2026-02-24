import { getAllWritings, createWriting, updateWriting, deleteWriting, getWritingById, getWritingExam, submitWriting, getSubmissions, getSubmissionById, getSubmissionStatus, scoreSubmission, regenerateWritingId, scoreSubmissionAI, uploadImage } from '../controllers/writing.controller.js';
import { verifyToken, optionalVerifyToken, isTeacherOrAdmin } from '../middleware/auth.middleware.js';
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

router.get("/", optionalVerifyToken, getAllWritings);
router.get("/submissions", verifyToken, isTeacherOrAdmin, getSubmissions);
router.get("/submissions/:id", verifyToken, isTeacherOrAdmin, getSubmissionById);
router.get("/submissions/:id/status", verifyToken, getSubmissionStatus);
router.post("/", verifyToken, isTeacherOrAdmin, createWriting);
router.post("/upload-image", verifyToken, isTeacherOrAdmin, upload.single('image'), uploadImage);
router.get("/:id", optionalVerifyToken, getWritingById);
router.get("/:id/exam", optionalVerifyToken, getWritingExam);
router.post("/:id/submit", verifyToken, submitWriting);
router.post("/submissions/:id/score", verifyToken, isTeacherOrAdmin, scoreSubmission);
router.post("/submissions/:id/ai-score", verifyToken, scoreSubmissionAI);
router.post("/:id/regenerate-id", verifyToken, isTeacherOrAdmin, regenerateWritingId);
router.put("/:id", verifyToken, isTeacherOrAdmin, updateWriting);
router.delete("/:id", verifyToken, isTeacherOrAdmin, deleteWriting);

export default router;
