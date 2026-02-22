import User from '../models/User.model.js';
import XpTransaction from '../models/XpTransaction.model.js';

export const XP_TEST_COMPLETION = 500;
export const XP_VOCAB_REVIEW = 10;
export const XP_WRITING_SUBMIT = 200;
export const XP_SPEAKING_SESSION = 150;

// Simple level formula: Level N requires 500 * (N-1) XP to reach? 
// Or cumulative? Let's use a simple table or formula.
// Level 1: 0-499
// Level 2: 500-1499 (Need 1000 more?)
// Let's stick to a simple formula: Threshold = Level * 500. 
// Cumulative XP to reach Level L = 500 * (L * (L-1) / 2) ? 
// Let's use a simpler linear-ish progression for now or a static function.

// Calculate level based on total XP
export const calculateLevel = (totalXP) => {
    // Level 1: 0 - 499
    // Level 2: 500 - 1249 (750 gap)
    // Level 3: 1250 - 2249 (1000 gap)
    // Level 4: 2250 - 3499 (1250 gap)
    // ... Gap increases by 250 each level.

    let level = 1;
    let xpForNextLevel = 500;
    let gap = 500;

    while (totalXP >= xpForNextLevel) {
        level++;
        gap += 250;
        xpForNextLevel += gap;
    }

    return level;
};

// Returns { newXP, newLevel, levelUp, xpGained }
export const addXP = async (userId, amount, source = 'general') => {
    try {
        const user = await User.findById(userId);
        if (!user) return null;

        const oldLevel = user.level || 1;
        user.xp = (user.xp || 0) + amount;

        const newLevel = calculateLevel(user.xp);
        const levelUp = newLevel > oldLevel;

        if (levelUp) {
            user.level = newLevel;
        }

        await user.save();

        // Log XP transaction for daily tracking
        try {
            await XpTransaction.create({ userId, amount, source });
        } catch { /* fail silently */ }

        return {
            currentXP: user.xp,
            currentLevel: user.level,
            levelUp,
            xpGained: amount
        };
    } catch (error) {
        console.error("Error adding XP:", error);
        return null; // Fail silently to not break main flow
    }
};

export const getLevelTitle = (level) => {
    if (level >= 10) return "Master";
    if (level >= 8) return "Elite";
    if (level >= 6) return "Advanced";
    if (level >= 4) return "Intermediate";
    if (level >= 2) return "Novice";
    return "Beginner";
};
