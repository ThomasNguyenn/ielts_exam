import User from "../models/User.model.js";
import Invitation from "../models/Invitation.model.js";
import { sendInvitationEmail } from "../services/email.service.js";
import TestAttempt from "../models/TestAttempt.model.js";
import WritingSubmission from "../models/WritingSubmission.model.js";
import PracticeSession from "../models/PracticeSession.js";
import SpeakingSession from "../models/SpeakingSession.js";
import Vocabulary from "../models/Vocabulary.model.js";
import StudentProgress from "../models/StudentProgress.model.js";
import StudyPlan from "../models/StudyPlan.model.js";
import StudyTask from "../models/StudyTask.model.js";
import StudyTaskProgress from "../models/StudyTaskProgress.model.js";
import StudyTaskHistory from "../models/StudyTaskHistory.model.js";
import mongoose from "mongoose";
import { parsePagination, buildPaginationMeta } from "../utils/pagination.js";
import { handleControllerError, sendControllerError } from '../utils/controllerError.js';

const toTimeValue = (value) => {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};

const mapWritingSubmissionToAttempt = (submission = {}) => {
    const taskTitles = (Array.isArray(submission?.writing_answers) ? submission.writing_answers : [])
        .map((item) => String(item?.task_title || "").trim())
        .filter(Boolean);
    const title = taskTitles.length > 0 ? taskTitles.join(" | ") : "Writing Submission";
    const scoreValue = Number(submission?.score);
    const hasScore = Number.isFinite(scoreValue);
    const percentage = hasScore ? Math.round((scoreValue / 9) * 1000) / 10 : null;

    return {
        _id: `writing_submission:${String(submission?._id || "")}`,
        source_id: String(submission?._id || ""),
        source_type: "writing_submission",
        type: "writing",
        test_id: { title },
        submitted_at: submission?.submitted_at || submission?.createdAt || null,
        score: hasScore ? scoreValue : null,
        total: hasScore ? 9 : null,
        wrong: null,
        skipped: null,
        percentage,
        time_taken_ms: Number.isFinite(Number(submission?.time_taken_ms)) ? Number(submission.time_taken_ms) : null,
        status: submission?.status || "pending",
    };
};

export const getAllUsersWithLatestScores = async (req, res) => {
    try {
        res.set("Cache-Control", "no-store");
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
            { $match: { user_id: { $in: userIds }, score: { $ne: null } } },
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
        const latestWritingSubmissions = await WritingSubmission.aggregate([
            { $match: { user_id: { $in: userIds }, score: { $ne: null } } },
            { $sort: { submitted_at: -1, createdAt: -1, updatedAt: -1 } },
            {
                $group: {
                    _id: "$user_id",
                    latest: { $first: "$$ROOT" },
                },
            },
            {
                $project: {
                    _id: 1,
                    score: "$latest.score",
                    submitted_at: { $ifNull: ["$latest.submitted_at", "$latest.createdAt"] },
                },
            },
        ]);

        // Map attempts back to users
        const userScoreMap = {};
        latestAttempts.forEach(item => {
            userScoreMap[item._id.toString()] = item.scores;
        });
        const writingScoreMap = {};
        latestWritingSubmissions.forEach((item) => {
            writingScoreMap[String(item?._id || "")] = {
                score: Number(item?.score),
                total: 9,
                submitted_at: item?.submitted_at || null,
                percentage: Number.isFinite(Number(item?.score))
                    ? Math.round((Number(item.score) / 9) * 1000) / 10
                    : null,
            };
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
            const latestWriting = writingScoreMap[user._id.toString()];
            if (latestWriting) {
                const currentWriting = scoresObj.writing || null;
                const incomingTs = toTimeValue(latestWriting.submitted_at);
                const currentTs = toTimeValue(currentWriting?.submitted_at);
                if (!currentWriting || incomingTs >= currentTs) {
                    scoresObj.writing = latestWriting;
                }
            }

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
        return handleControllerError(req, res, error);
    }
};

export const getUserAttempts = async (req, res) => {
    try {
        res.set("Cache-Control", "no-store");
        const { userId } = req.params;
        const { type } = req.query;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return sendControllerError(req, res, { statusCode: 400, message: "Invalid user id"  });
        }
        const normalizedType = String(type || "all").toLowerCase();
        const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });

        const includeObjectiveAttempts = ["all", "reading", "listening", "writing"].includes(normalizedType);
        const includeWritingSubmissions = normalizedType === "all" || normalizedType === "writing";

        const objectiveFilter = { user_id: userId };
        if (normalizedType !== "all") {
            objectiveFilter.type = normalizedType;
        }

        const [objectiveAttempts, writingSubmissions] = await Promise.all([
            includeObjectiveAttempts
                ? TestAttempt.find(objectiveFilter)
                    .sort({ submitted_at: -1 })
                    .select("_id type test_id submitted_at score total wrong skipped percentage time_taken_ms")
                    .populate("test_id", "title")
                    .lean()
                : Promise.resolve([]),
            includeWritingSubmissions
                ? WritingSubmission.find({ user_id: userId })
                    .sort({ submitted_at: -1, createdAt: -1 })
                    .select("_id writing_answers score status submitted_at createdAt time_taken_ms")
                    .lean()
                : Promise.resolve([]),
        ]);

        const merged = [
            ...(Array.isArray(objectiveAttempts) ? objectiveAttempts : []),
            ...(Array.isArray(writingSubmissions) ? writingSubmissions.map(mapWritingSubmissionToAttempt) : []),
        ].sort((a, b) => toTimeValue(b?.submitted_at) - toTimeValue(a?.submitted_at));

        const totalItems = merged.length;
        const attempts = merged.slice(skip, skip + limit);

        res.json({
            success: true,
            data: attempts,
            pagination: buildPaginationMeta({ page, limit, totalItems }),
        });
    } catch (error) {
        return handleControllerError(req, res, error);
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
        return handleControllerError(req, res, error);
    }
};

export const approveStudent = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findByIdAndUpdate(userId, { isConfirmed: true }, { new: true }).select('-password');
        
        if (!user) {
            return sendControllerError(req, res, { statusCode: 404, message: "User not found"  });
        }

        res.json({ success: true, data: user, message: "Student approved successfully" });
    } catch (error) {
        return handleControllerError(req, res, error);
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
        return handleControllerError(req, res, error);
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Prevent deleting self? Maybe.
        if (req.user && req.user.userId === userId) {
             return sendControllerError(req, res, { statusCode: 400, message: "Cannot delete yourself"  });
        }

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return sendControllerError(req, res, { statusCode: 400, message: "Invalid user id"  });
        }

        const user = await User.findById(userId).select("_id").lean();
        
        if (!user) {
            return sendControllerError(req, res, { statusCode: 404, message: "User not found"  });
        }

        const plans = await StudyPlan.find({ userId }, "_id").lean();
        const planIds = plans.map((plan) => plan._id);

        await Promise.all([
            TestAttempt.deleteMany({ user_id: userId }),
            WritingSubmission.deleteMany({ user_id: userId }),
            PracticeSession.deleteMany({ userId }),
            SpeakingSession.deleteMany({ userId }),
            Vocabulary.deleteMany({ user_id: userId }),
            StudentProgress.deleteMany({ userId }),
            StudyTaskHistory.deleteMany({ userId }),
            StudyTaskProgress.deleteMany({ userId }),
            StudyTask.deleteMany({ userId }),
            StudyPlan.deleteMany({ userId }),
            ...(planIds.length > 0
                ? [
                    StudyTaskProgress.deleteMany({ planId: { $in: planIds } }),
                    StudyTask.deleteMany({ planId: { $in: planIds } }),
                    StudyTaskHistory.deleteMany({ sourcePlanId: { $in: planIds } }),
                ]
                : []),
        ]);

        await User.findByIdAndDelete(userId);

        res.json({ success: true, message: "User deleted successfully" });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};


const PROMOTABLE_ROLES = new Set(["student", "teacher", "admin"]);

export const changeUserRole = async (req, res) => {
    try {
        const { userId } = req.params;
        const { role } = req.body;

        if (!role || !PROMOTABLE_ROLES.has(role)) {
            return sendControllerError(req, res, { statusCode: 400, message: "Role must be one of: student, teacher, admin"  });
        }

        if (req.user.userId === userId) {
            return sendControllerError(req, res, { statusCode: 400, message: "Cannot change your own role"  });
        }

        const user = await User.findById(userId).select("name email role isConfirmed");
        if (!user) {
            return sendControllerError(req, res, { statusCode: 404, message: "User not found"  });
        }

        const oldRole = user.role;
        if (oldRole === role) {
            return res.json({ success: true, message: "User already has role: " + role, data: user });
        }

        user.role = role;
        if (role === "teacher" || role === "admin") {
            user.isConfirmed = true;
        }
        await user.save();

        res.json({
            success: true,
            message: "Role changed from " + oldRole + " to " + role,
            data: { _id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};


const INVITABLE_ROLES = new Set(["teacher", "admin"]);

export const inviteUser = async (req, res) => {
    try {
        const { email, role } = req.body;

        if (!email || !role) {
            return sendControllerError(req, res, { statusCode: 400, message: "Email and role are required"  });
        }

        if (!INVITABLE_ROLES.has(role)) {
            return sendControllerError(req, res, { statusCode: 400, message: "Can only invite teacher or admin roles"  });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() }).select("_id").lean();
        if (existingUser) {
            return sendControllerError(req, res, { statusCode: 400, message: "A user with this email already exists"  });
        }

        const existingInvite = await Invitation.findOne({
            email: email.toLowerCase(),
            status: "pending",
            expiresAt: { $gt: new Date() },
        }).lean();

        if (existingInvite) {
            return sendControllerError(req, res, { statusCode: 400, message: "An active invitation already exists for this email"  });
        }

        const invitation = new Invitation({
            email: email.toLowerCase(),
            role,
            invitedBy: req.user.userId,
        });
        await invitation.save();

        await sendInvitationEmail(invitation.email, invitation.token, invitation.role);

        res.status(201).json({
            success: true,
            message: "Invitation sent successfully",
            data: {
                _id: invitation._id,
                email: invitation.email,
                role: invitation.role,
                expiresAt: invitation.expiresAt,
                status: invitation.status,
            },
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const getInvitations = async (req, res) => {
    try {
        const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });

        // Auto-expire old invitations
        await Invitation.updateMany(
            { status: "pending", expiresAt: { $lt: new Date() } },
            { $set: { status: "expired" } }
        );

        const filter = {};
        if (req.query.status) {
            filter.status = req.query.status;
        }

        const totalItems = await Invitation.countDocuments(filter);
        const invitations = await Invitation.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("invitedBy", "name email")
            .lean();

        res.json({
            success: true,
            data: invitations,
            pagination: buildPaginationMeta({ page, limit, totalItems }),
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};


