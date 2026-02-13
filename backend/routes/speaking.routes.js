import express from 'express';
import multer from 'multer';
import path from 'path';
import { getRandomSpeaking, getSpeakings, submitSpeaking, createSpeaking, updateSpeaking, deleteSpeaking, getSpeakingById, getSpeakingSession } from '../controllers/speaking.controller.js';
import { verifyToken, optionalVerifyToken, isTeacherOrAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/recordings';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Import fs for mkdirSync in diskStorage
import fs from 'fs';

const upload = multer({ 
    storage: storage,
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
