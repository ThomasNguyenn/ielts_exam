import TestAttempt from "../models/TestAttempt.model.js";
import WritingSubmission from "../models/WritingSubmission.model.js";
import SpeakingSession from "../models/SpeakingSession.js";
import mongoose from "mongoose";

// Helper: safe division
const safeDiv = (a, b) => b === 0 ? 0 : a / b;

// 1. Get Skills Breakdown (Radar Chart)
export const getSkillsBreakdown = async (req, res) => {
    try {
        const userId = req.user.userId;
        const objectId = new mongoose.Types.ObjectId(userId);

        // Aggregate Reading & Listening from TestAttempts
        const attempts = await TestAttempt.aggregate([
            { $match: { user_id: objectId } },
            {
                $group: {
                    _id: "$type",
                    avgScore: { $avg: "$score" }, // Band score
                    count: { $sum: 1 }
                }
            }
        ]);

        // Aggregate Writing from WritingSubmissions
        const writing = await WritingSubmission.aggregate([
            { $match: { user_id: objectId, status: { $in: ['scored', 'reviewed'] } } },
            {
                $group: {
                    _id: "writing",
                    avgScore: { $avg: "$score" },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Aggregate Speaking from SpeakingSessions
        const speaking = await SpeakingSession.aggregate([
            { $match: { userId: objectId, status: 'completed', 'analysis.band_score': { $exists: true } } },
            {
                $group: {
                    _id: "speaking",
                    avgScore: { $avg: "$analysis.band_score" },
                    count: { $sum: 1 }
                }
            }
        ]);

        // Merge results
        const skills = {
            reading: 0,
            listening: 0,
            writing: 0,
            speaking: 0
        };

        attempts.forEach(a => {
            if (skills[a._id] !== undefined) skills[a._id] = Math.round(a.avgScore * 2) / 2;
        });

        if (writing.length > 0) skills.writing = Math.round(writing[0].avgScore * 2) / 2;
        if (speaking.length > 0) skills.speaking = Math.round(speaking[0].avgScore * 2) / 2;

        res.json({ skills });

    } catch (error) {
        console.error("Analytics Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// 2. Weakness Detective (By Question Type)
export const getWeaknessAnalysis = async (req, res) => {
    try {
        const userId = req.user.userId;
        const objectId = new mongoose.Types.ObjectId(userId);

        // Only analyze attempts that have detailed_answers (newly taken tests)
        // Unwind detailed_answers array to process each question individually
        const weaknesses = await TestAttempt.aggregate([
            { $match: { user_id: objectId, 'detailed_answers.0': { $exists: true } } },
            { $unwind: "$detailed_answers" },
            {
                $group: {
                    _id: "$detailed_answers.question_type",
                    totalQuestions: { $sum: 1 },
                    correctQuestions: {
                        $sum: { $cond: [{ $eq: ["$detailed_answers.is_correct", true] }, 1, 0] }
                    }
                }
            },
            {
                $project: {
                    type: "$_id",
                    accuracy: { $multiply: [{ $divide: ["$correctQuestions", "$totalQuestions"] }, 100] },
                    total: "$totalQuestions"
                }
            },
            { $sort: { accuracy: 1 } } // Lowest accuracy first
        ]);

        res.json({ weaknesses });

    } catch (error) {
        console.error("Weakness Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// 3. Progress History (Line Chart)
export const getProgressHistory = async (req, res) => {
    try {
        const userId = req.user.userId;
        const objectId = new mongoose.Types.ObjectId(userId);

        // Get chronological list of all tests
        const history = await TestAttempt.aggregate([
            { $match: { user_id: objectId, score: { $ne: null } } },
            { $sort: { submitted_at: 1 } },
            {
                $project: {
                    date: "$submitted_at",
                    score: "$score",
                    type: "$type"
                }
            }
        ]);

        res.json({ history });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Admin: Get analytics for a specific student
export const getStudentAnalytics = async (req, res) => {
    // Re-use logic but with userId from params
    // For simplicity, we can extract logic to helper functions if strict DRY is needed,
    // but here we might just modify req.user.userId in a wrapper or pass ID explicitly.
    try {
        const { studentId } = req.params;
        // Mocking the request user for the helper functions might be tricky if they rely on req.user.
        // Better to separate service logic from controller logic.
        // For now, let's just duplicate the aggregation with studentId.

        const objectId = new mongoose.Types.ObjectId(studentId);

        // 1. Skills
        const attempts = await TestAttempt.aggregate([
            { $match: { user_id: objectId } },
            { $group: { _id: "$type", avgScore: { $avg: "$score" } } }
        ]);

        const writing = await WritingSubmission.aggregate([
            { $match: { user_id: objectId, status: { $in: ['scored', 'reviewed'] } } },
            { $group: { _id: "writing", avgScore: { $avg: "$score" } } }
        ]);

        const speaking = await SpeakingSession.aggregate([
            { $match: { userId: objectId, status: 'completed' } },
            { $group: { _id: "speaking", avgScore: { $avg: "$analysis.band_score" } } }
        ]);

        const skills = { reading: 0, listening: 0, writing: 0, speaking: 0 };
        attempts.forEach(a => { if (skills[a._id] !== undefined) skills[a._id] = Math.round(a.avgScore * 2) / 2; });
        if (writing.length > 0) skills.writing = Math.round(writing[0].avgScore * 2) / 2;
        if (speaking.length > 0) skills.speaking = Math.round(speaking[0].avgScore * 2) / 2;

        // 2. Weakness
        const weaknesses = await TestAttempt.aggregate([
            { $match: { user_id: objectId, 'detailed_answers.0': { $exists: true } } },
            { $unwind: "$detailed_answers" },
            {
                $group: {
                    _id: "$detailed_answers.question_type",
                    totalQuestions: { $sum: 1 },
                    correctQuestions: { $sum: { $cond: [{ $eq: ["$detailed_answers.is_correct", true] }, 1, 0] } }
                }
            },
            {
                $project: {
                    type: "$_id",
                    accuracy: { $multiply: [{ $divide: ["$correctQuestions", "$totalQuestions"] }, 100] },
                    total: "$totalQuestions"
                }
            },
            { $sort: { accuracy: 1 } }
        ]);

        // 3. History
        const history = await TestAttempt.aggregate([
            { $match: { user_id: objectId, score: { $ne: null } } },
            { $sort: { submitted_at: 1 } },
            { $project: { date: "$submitted_at", score: "$score", type: "$type" } }
        ]);

        res.json({ skills, weaknesses, history });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
