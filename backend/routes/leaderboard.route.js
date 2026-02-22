import express from 'express';
import { verifyToken } from '../middleware/auth.middleware.js';
import {
    getLeaderboard,
    getMyRank,
    getAchievementDefinitions,
    getMyAchievements,
    triggerAchievementCheck,
} from '../controllers/leaderboard.controller.js';

const router = express.Router();

// Public-ish (still requires auth)
router.get('/leaderboard', verifyToken, getLeaderboard);
router.get('/leaderboard/me', verifyToken, getMyRank);

// Achievements
router.get('/achievements', verifyToken, getAchievementDefinitions);
router.get('/achievements/me', verifyToken, getMyAchievements);
router.post('/achievements/check', verifyToken, triggerAchievementCheck);

export default router;
