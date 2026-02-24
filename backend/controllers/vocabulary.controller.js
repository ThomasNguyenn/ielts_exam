import Vocabulary from '../models/Vocabulary.model.js';
import { handleControllerError, sendControllerError } from '../utils/controllerError.js';

// Get all vocabulary for a user
export const getUserVocabulary = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return sendControllerError(req, res, { statusCode: 401, message: 'Unauthorized'  });
        }

        const { search, mastery, dueOnly } = req.query;

        let query = { user_id: userId };

        // Filter by search term
        if (search) {
            query.word = { $regex: search, $options: 'i' };
        }

        // Filter by mastery level
        if (mastery !== undefined) {
            query.mastery_level = parseInt(mastery);
        }

        // Filter by due for review
        if (dueOnly === 'true') {
            query.next_review_date = { $lte: new Date() };
        }

        const vocabulary = await Vocabulary.find(query)
            .sort({ added_at: -1 })
            .populate('source_test_id', 'title')
            .populate('source_passage_id', 'title');

        res.status(200).json({ success: true, data: vocabulary });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Get vocabulary due for review
export const getDueVocabulary = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return sendControllerError(req, res, { statusCode: 401, message: 'Unauthorized'  });
        }

        const dueWords = await Vocabulary.find({
            user_id: userId,
            next_review_date: { $lte: new Date() }
        }).sort({ next_review_date: 1 });

        res.status(200).json({ success: true, data: dueWords, count: dueWords.length });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Add new vocabulary word
export const addVocabulary = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return sendControllerError(req, res, { statusCode: 401, message: 'Unauthorized'  });
        }

        const { word, context, source_test_id, source_passage_id, definition, notes } = req.body;

        if (!word || !context) {
            return sendControllerError(req, res, {
                statusCode: 400,
                message: 'Word and context are required',
            });
        }

        // Check if word already exists for this user
        const existing = await Vocabulary.findOne({
            user_id: userId,
            word: word.toLowerCase().trim()
        });

        if (existing) {
            return sendControllerError(req, res, {
                statusCode: 409,
                message: 'Word already in your vocabulary list',
            });
        }

        const vocabulary = await Vocabulary.create({
            user_id: userId,
            word: word.toLowerCase().trim(),
            context,
            source_test_id,
            source_passage_id,
            definition,
            notes
        });

        res.status(201).json({ success: true, data: vocabulary });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Update vocabulary (definition, notes)
export const updateVocabulary = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const { definition, notes } = req.body;

        if (!userId) {
            return sendControllerError(req, res, { statusCode: 401, message: 'Unauthorized'  });
        }

        const vocabulary = await Vocabulary.findOneAndUpdate(
            { _id: id, user_id: userId },
            { definition, notes },
            { new: true, runValidators: true }
        );

        if (!vocabulary) {
            return sendControllerError(req, res, { statusCode: 404, message: 'Vocabulary not found'  });
        }

        res.status(200).json({ success: true, data: vocabulary });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Review vocabulary (update SRS)
export const reviewVocabulary = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const { difficulty } = req.body; // 'easy', 'medium', 'hard'

        if (!userId) {
            return sendControllerError(req, res, { statusCode: 401, message: 'Unauthorized'  });
        }

        if (!['easy', 'medium', 'hard'].includes(difficulty)) {
            return sendControllerError(req, res, {
                statusCode: 400,
                message: 'Difficulty must be easy, medium, or hard',
            });
        }

        const vocabulary = await Vocabulary.findOne({ _id: id, user_id: userId });

        if (!vocabulary) {
            return sendControllerError(req, res, { statusCode: 404, message: 'Vocabulary not found'  });
        }

        // Use the SRS method to calculate next review
        vocabulary.calculateNextReview(difficulty);
        await vocabulary.save();

        // Award XP
        const { addXP, XP_VOCAB_REVIEW } = await import("../services/gamification.service.js");
        const xpResult = await addXP(userId, XP_VOCAB_REVIEW, 'vocab');
        const { checkAchievements } = await import("../services/achievement.service.js");
        const newlyUnlocked = await checkAchievements(userId);

        res.status(200).json({
            success: true,
            data: {
                vocabulary,
                xpResult,
                achievements: newlyUnlocked
            },
            xpResult,
            achievements: newlyUnlocked
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Delete vocabulary
export const deleteVocabulary = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;

        if (!userId) {
            return sendControllerError(req, res, { statusCode: 401, message: 'Unauthorized'  });
        }

        const vocabulary = await Vocabulary.findOneAndDelete({
            _id: id,
            user_id: userId
        });

        if (!vocabulary) {
            return sendControllerError(req, res, { statusCode: 404, message: 'Vocabulary not found'  });
        }

        res.status(200).json({ success: true, message: 'Vocabulary deleted' });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Get vocabulary statistics
export const getVocabularyStats = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return sendControllerError(req, res, { statusCode: 401, message: 'Unauthorized'  });
        }

        const total = await Vocabulary.countDocuments({ user_id: userId });
        const dueCount = await Vocabulary.countDocuments({
            user_id: userId,
            next_review_date: { $lte: new Date() }
        });

        const masteryBreakdown = await Vocabulary.aggregate([
            { $match: { user_id: userId } },
            { $group: { _id: '$mastery_level', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                total,
                due: dueCount,
                mastery_breakdown: masteryBreakdown
            }
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};


