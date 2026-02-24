import User from '../models/User.model.js';
import { checkAchievements, getAllAchievements, getUserAchievements } from '../services/achievement.service.js';
import { getLevelTitle } from '../services/gamification.service.js';
import { handleControllerError, sendControllerError } from '../utils/controllerError.js';

// GET /api/leaderboard — Top 20 students by XP
export const getLeaderboard = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 20, 50);

        const students = await User.find({ role: 'student' })
            .sort({ xp: -1 })
            .limit(limit)
            .select('name xp level totalAchievements')
            .lean();

        const leaderboard = students.map((student, index) => ({
            rank: index + 1,
            _id: student._id,
            name: student.name,
            xp: student.xp || 0,
            level: student.level || 1,
            levelTitle: getLevelTitle(student.level || 1),
            totalAchievements: student.totalAchievements || 0,
        }));

        res.json({ success: true, data: leaderboard });
    } catch (error) {
        return handleControllerError(req, res, error, { route: 'leaderboard.getLeaderboard' });
    }
};

// GET /api/leaderboard/me — Current user rank + surrounding
export const getMyRank = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId).select('name xp level totalAchievements').lean();
        if (!user) return sendControllerError(req, res, { statusCode: 404, message: 'User not found'  });

        // Count how many students have more XP
        const higherCount = await User.countDocuments({
            role: 'student',
            xp: { $gt: user.xp || 0 }
        });

        const myRank = higherCount + 1;

        res.json({
            success: true,
            data: {
                rank: myRank,
                name: user.name,
                xp: user.xp || 0,
                level: user.level || 1,
                levelTitle: getLevelTitle(user.level || 1),
                totalAchievements: user.totalAchievements || 0,
            }
        });
    } catch (error) {
        return handleControllerError(req, res, error, { route: 'leaderboard.getMyRank' });
    }
};

// GET /api/achievements — All achievement definitions
export const getAchievementDefinitions = async (req, res) => {
    try {
        const achievements = await getAllAchievements();
        const userId = req.user?.userId;
        const userAchievements = userId ? await getUserAchievements(userId) : [];
        const unlockedKeys = new Set(userAchievements.map((item) => item.achievementKey));

        const sanitized = achievements.map((achievement, index) => {
            if (!achievement.hidden || unlockedKeys.has(achievement.key)) {
                return achievement;
            }

            const { condition, ...rest } = achievement;
            return {
                ...rest,
                key: `hidden-locked-${index + 1}`,
                title: '???',
                description: 'Hidden achievement - unlock it to reveal details.',
                icon: '❓',
                xpReward: 0,
            };
        });

        res.json({ success: true, data: sanitized });
    } catch (error) {
        return handleControllerError(req, res, error, { route: 'leaderboard.getAchievementDefinitions' });
    }
};

// GET /api/achievements/me — Current user's unlocked achievements
export const getMyAchievements = async (req, res) => {
    try {
        const userId = req.user.userId;
        const userAchievements = await getUserAchievements(userId);
        res.json({ success: true, data: userAchievements });
    } catch (error) {
        return handleControllerError(req, res, error, { route: 'leaderboard.getMyAchievements' });
    }
};

// POST /api/achievements/check — Manually trigger achievement check (returns newly unlocked)
export const triggerAchievementCheck = async (req, res) => {
    try {
        const userId = req.user.userId;
        const newlyUnlocked = await checkAchievements(userId);
        res.json({
            success: true,
            data: {
                achievements: newlyUnlocked,
                newlyUnlocked,
                count: newlyUnlocked.length,
            }
        });
    } catch (error) {
        return handleControllerError(req, res, error, { route: 'leaderboard.triggerAchievementCheck' });
    }
};

