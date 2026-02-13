import User from "../models/User.model.js";
import TestAttempt from "../models/TestAttempt.model.js";
import mongoose from "mongoose";
import { parsePagination, buildPaginationMeta } from "../utils/pagination.js";

export const getAllUsersWithLatestScores = async (req, res) => {
    try {
        const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
        const totalItems = await User.countDocuments({});

        // 1. Fetch only users for current page
        const users = await User.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('name email role _id createdAt')
            .lean();

        const userIds = users.map((u) => u._id).filter(Boolean);
        if (userIds.length === 0) {
            return res.json({
                success: true,
                data: [],
                pagination: buildPaginationMeta({ page, limit, totalItems }),
            });
        }

        // 2. Aggregate latest scores for each user in this page only
        const latestAttempts = await TestAttempt.aggregate([
            { $match: { user_id: { $in: userIds } } },
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

        res.json({
            success: true,
            data: result,
            pagination: buildPaginationMeta({ page, limit, totalItems }),
        });
    } catch (error) {
        console.error("Error in getAllUsersWithLatestScores:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const getUserAttempts = async (req, res) => {
    try {
        const { userId } = req.params;
        const { type } = req.query;
        const filter = { user_id: userId };
        if (type && type !== "all") {
            filter.type = type;
        }
        const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
        const totalItems = await TestAttempt.countDocuments(filter);

        const attempts = await TestAttempt.find(filter)
            .sort({ submitted_at: -1 })
            .skip(skip)
            .limit(limit)
            .populate('test_id', 'title')
            .lean();

        res.json({
            success: true,
            data: attempts,
            pagination: buildPaginationMeta({ page, limit, totalItems }),
        });
    } catch (error) {
        console.error("Error in getUserAttempts:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const getPendingStudents = async (req, res) => {
    try {
        const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
        const filter = { role: 'student', isConfirmed: false };
        const totalItems = await User.countDocuments(filter);

        const students = await User.find({ role: 'student', isConfirmed: false })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('-password');

        res.json({
            success: true,
            data: students,
            pagination: buildPaginationMeta({ page, limit, totalItems }),
        });
    } catch (error) {
        console.error("Error in getPendingStudents:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const approveStudent = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findByIdAndUpdate(userId, { isConfirmed: true }, { new: true }).select('-password');
        
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, data: user, message: "Student approved successfully" });
    } catch (error) {
        console.error("Error in approveStudent:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const getUsers = async (req, res) => {
    try {
        const { role } = req.query;
        const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
        const filter = {};
        if (role) {
            filter.role = role;
        }

        const totalItems = await User.countDocuments(filter);
        
        const users = await User.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('-password');
            
        res.json({
            success: true,
            data: users,
            pagination: buildPaginationMeta({ page, limit, totalItems }),
        });
    } catch (error) {
        console.error("Error in getUsers:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Prevent deleting self? Maybe.
        if (req.user && req.user.userId === userId) {
             return res.status(400).json({ success: false, message: "Cannot delete yourself" });
        }

        const user = await User.findByIdAndDelete(userId);
        
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Optional: Delete related data (test attempts, submissions, etc.)
        // For now, simple delete.

        res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
        console.error("Error in deleteUser:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
