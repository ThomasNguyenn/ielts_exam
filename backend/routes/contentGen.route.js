import express from 'express';
import { parseRawContent } from '../controllers/contentGen.controller.js';
// import { verifyToken } from '../middleware/auth.middleware.js'; // Optional: Add auth

const router = express.Router();

router.post('/parse', parseRawContent);

export default router;
