import express from 'express';
import { verifyToken } from '../middleware/auth.middleware.js';
import { createCacheInvalidator, createResponseCache, getCacheTtlSec } from '../middleware/responseCache.middleware.js';
import {
    getLeaderboard,
    getMyRank,
    getAchievementDefinitions,
    getMyAchievements,
    triggerAchievementCheck,
} from '../controllers/leaderboard.controller.js';

const router = express.Router();

const leaderboardCache = createResponseCache({
    namespace: "leaderboard-global",
    ttlSec: getCacheTtlSec("API_RESPONSE_CACHE_TTL_LEADERBOARD_SEC", 20),
    scope: "public",
    tags: ["leaderboard:global"],
});
const myRankCache = createResponseCache({
    namespace: "leaderboard-me",
    ttlSec: getCacheTtlSec("API_RESPONSE_CACHE_TTL_LEADERBOARD_ME_SEC", 15),
    scope: "user",
    tags: (req) => [`leaderboard:user:${String(req.user?.userId || "").trim()}`],
});
const invalidateLeaderboardCache = createCacheInvalidator({
    tags: (req) => [
        "leaderboard:global",
        `leaderboard:user:${String(req.user?.userId || "").trim()}`,
    ],
});

// Public-ish (still requires auth)
router.get('/leaderboard', verifyToken, leaderboardCache, getLeaderboard);
router.get('/leaderboard/me', verifyToken, myRankCache, getMyRank);

// Achievements
router.get('/achievements', verifyToken, getAchievementDefinitions);
router.get('/achievements/me', verifyToken, getMyAchievements);
router.post('/achievements/check', verifyToken, invalidateLeaderboardCache, triggerAchievementCheck);

export default router;
