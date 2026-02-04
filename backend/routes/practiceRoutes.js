import express from 'express';
import { getRandomQuestion, checkOutline, generateMaterials, submitWriting } from '../controllers/practice.controller.js';

const router = express.Router();

router.get('/questions/random', getRandomQuestion);
router.post('/outline-check', checkOutline);
router.get('/materials/:questionId', generateMaterials);
router.post('/submit', submitWriting);

export default router;
