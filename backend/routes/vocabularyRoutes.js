import express from 'express';
import {
    getUserVocabulary,
    getDueVocabulary,
    addVocabulary,
    updateVocabulary,
    reviewVocabulary,
    deleteVocabulary,
    getVocabularyStats
} from '../controllers/vocabulary.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Get all vocabulary for user
router.get('/', getUserVocabulary);

// Get vocabulary due for review
router.get('/due', getDueVocabulary);

// Get vocabulary statistics
router.get('/stats', getVocabularyStats);

// Add new vocabulary
router.post('/', addVocabulary);

// Update vocabulary (definition, notes)
router.put('/:id', updateVocabulary);

// Review vocabulary (update SRS)
router.put('/:id/review', reviewVocabulary);

// Delete vocabulary
router.delete('/:id', deleteVocabulary);

export default router;
