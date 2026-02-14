import express from 'express';
import multer from 'multer';
import { getRandomSpeaking, getSpeakings, submitSpeaking, createSpeaking, updateSpeaking, deleteSpeaking, getSpeakingById, getSpeakingSession } from '../controllers/speaking.controller.js';
import { verifyToken, optionalVerifyToken, isTeacherOrAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an audio file!'), false);
        }
    }
});

router.get('/', getSpeakings);
router.post('/', verifyToken, isTeacherOrAdmin, createSpeaking);
router.get('/random', getRandomSpeaking);
router.get('/sessions/:id', verifyToken, getSpeakingSession);
router.get('/:id', getSpeakingById);
router.put('/:id', verifyToken, isTeacherOrAdmin, updateSpeaking);
router.delete('/:id', verifyToken, isTeacherOrAdmin, deleteSpeaking);
router.post('/submit', optionalVerifyToken, upload.single('audio'), submitSpeaking);

export default router;
