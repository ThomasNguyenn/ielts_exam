import User from '../models/User.model.js';
import { checkAchievements, getAllAchievements, getUserAchievements, seedAchievements } from '../services/achievement.service.js';
import { calculateLevel, getLevelTitle } from '../services/gamification.service.js';

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
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// GET /api/leaderboard/me — Current user rank + surrounding
export const getMyRank = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select('name xp level totalAchievements').lean();
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

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
        console.error('Error fetching my rank:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// GET /api/achievements — All achievement definitions
export const getAchievementDefinitions = async (req, res) => {
    try {
        const achievements = await getAllAchievements();
        res.json({ success: true, data: achievements });
    } catch (error) {
        console.error('Error fetching achievement definitions:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// GET /api/achievements/me — Current user's unlocked achievements
export const getMyAchievements = async (req, res) => {
    try {
        const userId = req.user.id;
        const userAchievements = await getUserAchievements(userId);
        res.json({ success: true, data: userAchievements });
    } catch (error) {
        console.error('Error fetching my achievements:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// POST /api/achievements/check — Manually trigger achievement check (returns newly unlocked)
export const triggerAchievementCheck = async (req, res) => {
    try {
        const userId = req.user.id;
        const newlyUnlocked = await checkAchievements(userId);
        res.json({
            success: true,
            data: {
                newlyUnlocked,
                count: newlyUnlocked.length,
            }
        });
    } catch (error) {
        console.error('Error checking achievements:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// Seed achievements on import (call from server.js)
export const initAchievements = async () => {
    await seedAchievements();
};
