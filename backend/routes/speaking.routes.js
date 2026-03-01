import express from 'express';
import multer from 'multer';
import { getRandomSpeaking, getSpeakings, submitSpeaking, createSpeaking, updateSpeaking, deleteSpeaking, getSpeakingById, getSpeakingSession, runMockExaminerTurn, preGeneratePart3ReadAloud, generateSpeakingPromptReadAloud } from '../controllers/speaking.controller.js';
import { verifyToken, isTeacherOrAdmin } from "../middleware/auth.middleware.js";
import { createCacheInvalidator, createResponseCache, getCacheTtlSec } from '../middleware/responseCache.middleware.js';

const router = express.Router();

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            const typeError = new Error('Only audio files are allowed for speaking uploads');
            typeError.statusCode = 415;
            typeError.code = 'UNSUPPORTED_MEDIA_TYPE';
            cb(typeError, false);
        }
    }
});

const speakingCatalogCache = createResponseCache({
    namespace: "speaking-catalog",
    ttlSec: getCacheTtlSec("API_RESPONSE_CACHE_TTL_SPEAKING_SEC", 180),
    scope: "public",
    tags: ["catalog:speaking"],
});
const invalidateSpeakingCatalog = createCacheInvalidator({
    tags: ["catalog:speaking"],
});

router.get('/', speakingCatalogCache, getSpeakings);
router.post('/', verifyToken, isTeacherOrAdmin, invalidateSpeakingCatalog, createSpeaking);
router.post('/admin/pre-generate-part3-audio', verifyToken, isTeacherOrAdmin, preGeneratePart3ReadAloud);
router.post('/read-aloud/generate', verifyToken, isTeacherOrAdmin, generateSpeakingPromptReadAloud);
router.get('/random', getRandomSpeaking);
router.get('/sessions/:id', verifyToken, getSpeakingSession);
router.post('/sessions/:id/mock-examiner/turn', verifyToken, runMockExaminerTurn);
router.get('/:id', speakingCatalogCache, getSpeakingById);
router.put('/:id', verifyToken, isTeacherOrAdmin, invalidateSpeakingCatalog, updateSpeaking);
router.delete('/:id', verifyToken, isTeacherOrAdmin, invalidateSpeakingCatalog, deleteSpeaking);
router.post('/submit', verifyToken, upload.single('audio'), submitSpeaking);

export default router;
