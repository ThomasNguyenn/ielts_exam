import express from 'express';
import { protect } from '../middleware/auth.js';
import {
    getLeaderboard,
    getMyRank,
    getAchievementDefinitions,
    getMyAchievements,
    triggerAchievementCheck,
} from '../controllers/leaderboard.controller.js';

const router = express.Router();

// Public-ish (still requires auth)
router.get('/leaderboard', protect, getLeaderboard);
router.get('/leaderboard/me', protect, getMyRank);

// Achievements
router.get('/achievements', protect, getAchievementDefinitions);
router.get('/achievements/me', protect, getMyAchievements);
router.post('/achievements/check', protect, triggerAchievementCheck);

export default router;
