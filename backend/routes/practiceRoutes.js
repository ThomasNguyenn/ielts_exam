import express from 'express';
import { getRandomQuestion, checkOutline, generateMaterials, submitWriting } from '../controllers/practice.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/questions/random', getRandomQuestion);
router.post('/outline-check', verifyToken, checkOutline);
router.get('/materials/:questionId', verifyToken, generateMaterials);
router.post('/submit', verifyToken, submitWriting);

export default router;
