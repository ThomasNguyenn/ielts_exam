import StudentProgress from '../models/StudentProgress.model.js';
import SkillModule from '../models/SkillModule.model.js';

// Get or create student progress
export const getMyProgress = async (req, res) => {
    try {
        const userId = req.user.userId;

        let progress = await StudentProgress.findOne({ userId });

        if (!progress) {
            // Create new progress record
            progress = new StudentProgress({ userId });
            await progress.save();
        }

        res.json({ success: true, data: progress });
    } catch (error) {
        console.error('Error fetching progress:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get skill breakdown
export const getSkillBreakdown = async (req, res) => {
    try {
        const userId = req.user.userId;
        const progress = await StudentProgress.findOne({ userId });

        if (!progress) {
            return res.status(404).json({ success: false, message: 'Progress not found' });
        }

        const skillScores = progress.skillScores;
        const weakestSkills = Object.entries(skillScores)
            .sort(([, a], [, b]) => a - b)
            .slice(0, 3) // Top 3 weakest
            .map(([skill, score]) => ({ skill, score }));

        res.json({
            success: true,
            data: {
                skillScores,
                weakestSkills,
                averageSkillScore: Object.values(skillScores).reduce((a, b) => a + b, 0) / Object.keys(skillScores).length
            }
        });
    } catch (error) {
        console.error('Error fetching skill breakdown:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update skill scores (called after grading)
export const updateSkillScores = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { skillScores } = req.body;

        let progress = await StudentProgress.findOne({ userId });
        if (!progress) {
            progress = new StudentProgress({ userId });
        }

        // Update skill scores (weighted average with existing scores)
        for (const [skill, newScore] of Object.entries(skillScores)) {
            if (progress.skillScores[skill] !== undefined) {
                // Weighted average: 30% old score, 70% new score
                progress.skillScores[skill] = Math.round(
                    progress.skillScores[skill] * 0.3 + newScore * 0.7
                );
            }
        }

        // Update streak
        progress.updateStreak();

        // Check for badges
        checkAndAwardBadges(progress);

        await progress.save();

        res.json({ success: true, data: progress });
    } catch (error) {
        console.error('Error updating skill scores:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Mark module as completed
export const markModuleComplete = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { moduleId, quizScore } = req.body;

        const module = await SkillModule.findById(moduleId);
        if (!module) {
            return res.status(404).json({ success: false, message: 'Module not found' });
        }

        let progress = await StudentProgress.findOne({ userId });
        if (!progress) {
            progress = new StudentProgress({ userId });
        }

        // Check if already completed
        const alreadyCompleted = progress.completedModules.some(
            m => m.moduleId.toString() === moduleId
        );

        if (!alreadyCompleted) {
            progress.completedModules.push({
                moduleId,
                quizScore,
                completedAt: new Date()
            });

            // Award badge if first module
            if (progress.completedModules.length === 1) {
                progress.awardBadge('First Step', '🎯', 'Completed your first skill module');
            }

            // Award badge if all modules completed
            const totalModules = await SkillModule.countDocuments({ isActive: true });
            if (progress.completedModules.length === totalModules) {
                progress.awardBadge('Skill Master', '🏆', 'Completed all skill modules');
            }
        }

        await progress.save();

        res.json({ success: true, data: progress });
    } catch (error) {
        console.error('Error marking module complete:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get badges
export const getBadges = async (req, res) => {
    try {
        const userId = req.user.userId;
        const progress = await StudentProgress.findOne({ userId });

        if (!progress) {
            return res.json({ success: true, data: [] });
        }

        res.json({ success: true, data: progress.badges });
    } catch (error) {
        console.error('Error fetching badges:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get streak info
export const getStreak = async (req, res) => {
    try {
        const userId = req.user.userId;
        const progress = await StudentProgress.findOne({ userId });

        if (!progress) {
            return res.json({ success: true, data: { current: 0, longest: 0 } });
        }

        res.json({
            success: true,
            data: {
                current: progress.streak,
                longest: progress.longestStreak
            }
        });
    } catch (error) {
        console.error('Error fetching streak:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Helper function to check and award badges
function checkAndAwardBadges(progress) {
    // Essay count badges
    if (progress.totalEssays === 1) {
        progress.awardBadge('First Essay', '✍️', 'Completed your first essay');
    }
    if (progress.totalEssays === 10) {
        progress.awardBadge('Practice Makes Perfect', '📚', 'Completed 10 essays');
    }
    if (progress.totalEssays === 50) {
        progress.awardBadge('Essay Expert', '🎓', 'Completed 50 essays');
    }

    // Streak badges
    if (progress.streak === 7) {
        progress.awardBadge('Week Warrior', '🔥', '7-day practice streak');
    }
    if (progress.streak === 30) {
        progress.awardBadge('Month Master', '🌟', '30-day practice streak');
    }

    // Skill badges
    const skillScores = Object.values(progress.skillScores);
    const avgSkillScore = skillScores.reduce((a, b) => a + b, 0) / skillScores.length;

    if (avgSkillScore >= 90) {
        progress.awardBadge('Skill Champion', '👑', 'Achieved 90+ average across all skills');
    }
}
