import express from 'express';
import { parseRawContent } from '../controllers/contentGen.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/parse', verifyToken, parseRawContent);

export default router;
