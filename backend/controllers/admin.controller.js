import User from "../models/User.model.js";
import TestAttempt from "../models/TestAttempt.model.js";
import mongoose from "mongoose";

export const getAllUsersWithLatestScores = async (req, res) => {
    try {
        // 1. Fetch all users (including students, teachers, admins)
        const users = await User.find({}).select('name email role _id').lean();

        // 2. Aggregate latest scores for each student
        const latestAttempts = await TestAttempt.aggregate([
            { $sort: { submitted_at: -1 } },
            {
                $group: {
                    _id: { user_id: "$user_id", type: "$type" },
                    latestScore: { $first: "$$ROOT" }
                }
            },
            {
                $group: {
                    _id: "$_id.user_id",
                    scores: {
                        $push: {
                            type: "$_id.type",
                            score: "$latestScore.score",
                            total: "$latestScore.total",
                            submitted_at: "$latestScore.submitted_at",
                            percentage: "$latestScore.percentage"
                        }
                    }
                }
            }
        ]);

        // Map attempts back to users
        const userScoreMap = {};
        latestAttempts.forEach(item => {
            userScoreMap[item._id.toString()] = item.scores;
        });

        const result = users.map(user => {
            const userScores = userScoreMap[user._id.toString()] || [];
            const scoresObj = {};
            userScores.forEach(s => {
                scoresObj[s.type] = {
                    score: s.score,
                    total: s.total,
                    submitted_at: s.submitted_at,
                    percentage: s.percentage
                };
            });

            return {
                ...user,
                latestScores: scoresObj
            };
        });

        res.json({ success: true, data: result });
    } catch (error) {
        console.error("Error in getAllUsersWithLatestScores:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const getUserAttempts = async (req, res) => {
    try {
        const { userId } = req.params;

        const attempts = await TestAttempt.find({ user_id: userId })
            .sort({ submitted_at: -1 })
            .populate('test_id', 'title')
            .lean();

        res.json({ success: true, data: attempts });
    } catch (error) {
        console.error("Error in getUserAttempts:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};