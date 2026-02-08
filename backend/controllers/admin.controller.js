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

export const getPendingStudents = async (req, res) => {
    try {
        const students = await User.find({ role: 'student', isConfirmed: false })
            .sort({ createdAt: -1 })
            .select('-password');
        res.json({ success: true, data: students });
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
        const filter = {};
        if (role) {
            filter.role = role;
        }
        
        const users = await User.find(filter)
            .sort({ createdAt: -1 })
            .select('-password');
            
        res.json({ success: true, data: users });
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