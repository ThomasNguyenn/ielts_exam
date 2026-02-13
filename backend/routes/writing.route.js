import { getAllWritings, createWriting, updateWriting, deleteWriting, getWritingById, getWritingExam, submitWriting, getSubmissions, getSubmissionById, scoreSubmission, regenerateWritingId, scoreSubmissionAI, uploadImage } from '../controllers/writing.controller.js';
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

router.get("/", getAllWritings);
router.get("/submissions", verifyToken, isTeacherOrAdmin, getSubmissions);
router.get("/submissions/:id", verifyToken, isTeacherOrAdmin, getSubmissionById);
router.post("/", verifyToken, isTeacherOrAdmin, createWriting);
router.post("/upload-image", verifyToken, isTeacherOrAdmin, upload.single('image'), uploadImage);
router.get("/:id", getWritingById);
router.get("/:id/exam", getWritingExam);
router.post("/:id/submit", optionalVerifyToken, submitWriting);
router.post("/submissions/:id/score", verifyToken, isTeacherOrAdmin, scoreSubmission);
router.post("/submissions/:id/ai-score", verifyToken, isTeacherOrAdmin, scoreSubmissionAI);
router.post("/:id/regenerate-id", verifyToken, isTeacherOrAdmin, regenerateWritingId);
router.put("/:id", verifyToken, isTeacherOrAdmin, updateWriting);
// router.post("/:id/regenerate-id", import('../controllers/writing.controller.js').then(m => m.regenerateWritingId).catch(e => console.error(e))); // Dynamic import wrapper or just import it at top?
// Better to just export it in controller and import at top. 
// But since I used dynamic imports inside controller for Models, I should just import it standardly.
// Wait, I am editing the route file. I should add `regenerateWritingId` to imports.
router.delete("/:id", verifyToken, isTeacherOrAdmin, deleteWriting);

export default router;
