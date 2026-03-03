import User from "../models/User.model.js";
import Invitation from "../models/Invitation.model.js";
import { sendInvitationEmail } from "../services/email.service.js";
import TestAttempt from "../models/TestAttempt.model.js";
import WritingSubmission from "../models/WritingSubmission.model.js";
import Speaking from "../models/Speaking.model.js";
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

const ONLINE_WINDOW_MINUTES = 5;
const ONLINE_WINDOW_MS = ONLINE_WINDOW_MINUTES * 60 * 1000;
const SPEAKING_STUCK_THRESHOLD_MS = Math.max(
    1000,
    Number(process.env.SPEAKING_STUCK_THRESHOLD_MS || 60_000),
);
const SPEAKING_REPAIR_DEFAULT_WINDOW_HOURS = 24;
const SPEAKING_REPAIR_DEFAULT_LIMIT = 200;
const SPEAKING_REPAIR_MAX_LIMIT = 1000;
const ADMIN_USER_LIST_SELECT = "name email role isConfirmed createdAt lastSeenAt avatarSeed targets xp level";

const toBoolean = (value, fallback = false) => {
    if (value === undefined || value === null) return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    return fallback;
};

const parseBooleanQuery = (value, fallback) => {
    if (value === undefined || value === null || value === "") return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) return true;
    if (["0", "false", "no", "off"].includes(normalized)) return false;
    return fallback;
};

const buildEstimatedPaginationMeta = ({ page, limit, hasNextPage }) => ({
    page,
    limit,
    totalItems: null,
    totalPages: null,
    hasPrevPage: page > 1,
    hasNextPage: Boolean(hasNextPage),
    estimated: true,
});

const toPositiveInt = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(Math.floor(parsed), max);
};

const buildOnlineThreshold = (now = new Date()) =>
    new Date(now.getTime() - ONLINE_WINDOW_MS);

const withOnlineFlag = (user = {}, thresholdTimeMs = 0) => {
    const isStudent = String(user?.role || "") === "student";
    const isOnline = isStudent && toTimeValue(user?.lastSeenAt) >= thresholdTimeMs;
    return {
        ...user,
        is_online: Boolean(isOnline),
    };
};

const escapeRegex = (value = "") =>
    String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

const mapSpeakingSessionToAttempt = (session = {}, topicTitleById = {}) => {
    const sessionId = String(session?._id || "");
    const questionId = String(session?.questionId || "");
    const topicTitle = String(topicTitleById?.[questionId] || "").trim();
    const title = topicTitle || "Speaking Session";
    const bandScore = Number(session?.analysis?.band_score);
    const hasBandScore = Number.isFinite(bandScore);
    const percentage = hasBandScore ? Math.round((bandScore / 9) * 1000) / 10 : null;

    return {
        _id: `speaking_session:${sessionId}`,
        source_id: sessionId,
        source_type: "speaking_session",
        type: "speaking",
        test_id: { title },
        submitted_at: session?.timestamp || session?.createdAt || null,
        score: hasBandScore ? bandScore : null,
        total: 9,
        wrong: null,
        skipped: null,
        percentage,
        time_taken_ms: null,
        status: session?.status || "processing",
        scoring_state: session?.scoring_state || "processing",
        error_logs_state: session?.error_logs_state || null,
        error_logs_error: session?.error_logs_error || null,
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
        const latestSpeakingSessions = await SpeakingSession.aggregate([
            { $match: { userId: { $in: userIds }, "analysis.band_score": { $ne: null } } },
            { $sort: { timestamp: -1, createdAt: -1, updatedAt: -1 } },
            {
                $group: {
                    _id: "$userId",
                    latest: { $first: "$$ROOT" },
                },
            },
            {
                $project: {
                    _id: 1,
                    score: "$latest.analysis.band_score",
                    submitted_at: { $ifNull: ["$latest.timestamp", "$latest.createdAt"] },
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
        const speakingScoreMap = {};
        latestSpeakingSessions.forEach((item) => {
            speakingScoreMap[String(item?._id || "")] = {
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
            const latestSpeaking = speakingScoreMap[user._id.toString()];
            if (latestSpeaking) {
                const currentSpeaking = scoresObj.speaking || null;
                const incomingTs = toTimeValue(latestSpeaking.submitted_at);
                const currentTs = toTimeValue(currentSpeaking?.submitted_at);
                if (!currentSpeaking || incomingTs >= currentTs) {
                    scoresObj.speaking = latestSpeaking;
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
        const includeSpeakingSessions = normalizedType === "all" || normalizedType === "speaking";

        const objectiveFilter = { user_id: userId };
        if (normalizedType !== "all") {
            objectiveFilter.type = normalizedType;
        }

        const [objectiveAttempts, writingSubmissions, speakingSessions] = await Promise.all([
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
            includeSpeakingSessions
                ? SpeakingSession.find({ userId })
                    .sort({ timestamp: -1, createdAt: -1 })
                    .select("_id questionId analysis.band_score status scoring_state timestamp createdAt error_logs_state error_logs_error")
                    .lean()
                : Promise.resolve([]),
        ]);

        const topicIdSet = new Set(
            (Array.isArray(speakingSessions) ? speakingSessions : [])
                .map((item) => String(item?.questionId || "").trim())
                .filter(Boolean),
        );
        const topicIdList = Array.from(topicIdSet).filter((id) => mongoose.Types.ObjectId.isValid(id));
        const speakingTopics = topicIdList.length > 0
            ? await Speaking.find({ _id: { $in: topicIdList } }).select("_id title").lean()
            : [];
        const topicTitleById = (Array.isArray(speakingTopics) ? speakingTopics : []).reduce((acc, item) => {
            const id = String(item?._id || "").trim();
            if (!id) return acc;
            acc[id] = String(item?.title || "").trim();
            return acc;
        }, {});

        const merged = [
            ...(Array.isArray(objectiveAttempts) ? objectiveAttempts : []),
            ...(Array.isArray(writingSubmissions) ? writingSubmissions.map(mapWritingSubmissionToAttempt) : []),
            ...(Array.isArray(speakingSessions) ? speakingSessions.map((item) => mapSpeakingSessionToAttempt(item, topicTitleById)) : []),
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
        const includeTotal = parseBooleanQuery(req.query?.include_total, true);
        const filter = {};
        if (role) {
            filter.role = role;
        }
        const threshold = buildOnlineThreshold();
        const thresholdTimeMs = threshold.getTime();

        const queryLimit = includeTotal ? limit : limit + 1;
        const usersQuery = User.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(queryLimit)
            .select(ADMIN_USER_LIST_SELECT)
            .lean();

        let totalItems = null;
        let users = [];
        if (includeTotal) {
            [totalItems, users] = await Promise.all([
                User.countDocuments(filter),
                usersQuery,
            ]);
        } else {
            users = await usersQuery;
        }

        const hasNextPage = includeTotal ? false : users.length > limit;
        const effectiveUsers = includeTotal ? users : users.slice(0, limit);

        const usersWithOnlineFlag = effectiveUsers.map((user) => withOnlineFlag(user, thresholdTimeMs));
        const pagination = includeTotal
            ? buildPaginationMeta({ page, limit, totalItems })
            : buildEstimatedPaginationMeta({ page, limit, hasNextPage });
            
        res.json({
            success: true,
            data: usersWithOnlineFlag,
            pagination,
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const getOnlineStudents = async (req, res) => {
    try {
        res.set("Cache-Control", "no-store");
        const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
        const includeTotal = parseBooleanQuery(req.query?.include_total, true);
        const now = new Date();
        const threshold = buildOnlineThreshold(now);
        const thresholdTimeMs = threshold.getTime();
        const queryText = String(req.query?.q || "").trim();

        const filter = {
            role: "student",
            lastSeenAt: { $gte: threshold },
        };

        if (queryText) {
            const safeRegex = new RegExp(escapeRegex(queryText), "i");
            filter.$or = [
                { name: safeRegex },
                { email: safeRegex },
            ];
        }
        const queryLimit = includeTotal ? limit : limit + 1;
        const studentsQuery = User.find(filter)
            .sort({ lastSeenAt: -1, createdAt: -1 })
            .skip(skip)
            .limit(queryLimit)
            .select(ADMIN_USER_LIST_SELECT)
            .lean();

        let totalItems = null;
        let students = [];
        if (includeTotal) {
            [totalItems, students] = await Promise.all([
                User.countDocuments(filter),
                studentsQuery,
            ]);
        } else {
            students = await studentsQuery;
        }

        const hasNextPage = includeTotal ? false : students.length > limit;
        const effectiveStudents = includeTotal ? students : students.slice(0, limit);
        const studentsWithOnlineFlag = effectiveStudents.map((user) => withOnlineFlag(user, thresholdTimeMs));
        const pagination = includeTotal
            ? buildPaginationMeta({ page, limit, totalItems })
            : buildEstimatedPaginationMeta({ page, limit, hasNextPage });

        return res.json({
            success: true,
            data: studentsWithOnlineFlag,
            pagination,
            online_window_minutes: ONLINE_WINDOW_MINUTES,
            as_of: now.toISOString(),
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const repairStuckSpeakingSessions = async (req, res) => {
    try {
        res.set("Cache-Control", "no-store");
        const body = req.body || {};
        const windowHours = toPositiveInt(
            body.window_hours,
            SPEAKING_REPAIR_DEFAULT_WINDOW_HOURS,
            24 * 30,
        );
        const limit = toPositiveInt(
            body.limit,
            SPEAKING_REPAIR_DEFAULT_LIMIT,
            SPEAKING_REPAIR_MAX_LIMIT,
        );
        const dryRun = toBoolean(body.dry_run, false);
        const now = new Date();
        const thresholdDate = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

        const [speakingService, speakingQueue] = await Promise.all([
            import("../services/speakingGrading.service.js"),
            import("../queues/ai.queue.js"),
        ]);

        const sessions = await SpeakingSession.find({
            $or: [
                { timestamp: { $gte: thresholdDate } },
                { createdAt: { $gte: thresholdDate } },
            ],
        })
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();

        const summary = {
            scanned: 0,
            finalized: 0,
            requeued_phase1: 0,
            requeued_phase2: 0,
            skipped_guardrail: 0,
            skipped_not_stuck: 0,
            errors: [],
        };

        for (let index = 0; index < sessions.length; index += 1) {
            const session = sessions[index] || {};
            const sessionId = String(session?._id || "");
            summary.scanned += 1;

            if (!sessionId) {
                summary.skipped_not_stuck += 1;
                continue;
            }

            const hasFinal = speakingService.isUsableSpeakingAnalysis(session?.analysis);
            const hasPhase1 = speakingService.isUsableSpeakingAnalysis(session?.phase1_analysis);
            const hasPhase2 = speakingService.isUsableSpeakingAnalysis(session?.phase2_analysis);
            const ageMs = Math.max(0, Date.now() - toTimeValue(session?.timestamp || session?.createdAt || now));

            if (hasFinal || (!hasPhase1 && !hasPhase2) || ageMs < SPEAKING_STUCK_THRESHOLD_MS) {
                summary.skipped_not_stuck += 1;
                continue;
            }

            try {
                if (hasPhase1 && hasPhase2) {
                    if (dryRun) {
                        summary.finalized += 1;
                    } else {
                        const finalizeResult = await speakingService.finalizeSpeakingSessionById({ sessionId });
                        if (
                            finalizeResult?.finalized
                            || speakingService.isUsableSpeakingAnalysis(finalizeResult?.session?.analysis)
                        ) {
                            summary.finalized += 1;
                        } else {
                            summary.skipped_not_stuck += 1;
                        }
                    }
                    continue;
                }

                if (hasPhase2 && !hasPhase1) {
                    const phase1Count = Number(session?.phase1_auto_requeue_count || 0);
                    if (phase1Count >= 1) {
                        summary.skipped_guardrail += 1;
                        continue;
                    }

                    if (dryRun) {
                        summary.requeued_phase1 += 1;
                        continue;
                    }

                    const guarded = await SpeakingSession.findOneAndUpdate(
                        {
                            _id: sessionId,
                            status: { $ne: "completed" },
                            $or: [
                                { phase1_auto_requeue_count: { $exists: false } },
                                { phase1_auto_requeue_count: { $lt: 1 } },
                            ],
                        },
                        {
                            $inc: { phase1_auto_requeue_count: 1 },
                            $set: { phase1_last_requeue_at: new Date() },
                        },
                        { new: true },
                    ).lean();

                    if (!guarded) {
                        summary.skipped_guardrail += 1;
                        continue;
                    }

                    const repairTag = `backfill-${Date.now()}-${index}-p1`;
                    const queueResult = await speakingQueue.enqueueSpeakingAiPhase1Job({
                        sessionId,
                        force: true,
                        repairTag,
                    });
                    if (queueResult?.queued) {
                        summary.requeued_phase1 += 1;
                    } else {
                        summary.errors.push({
                            session_id: sessionId,
                            action: "requeue_phase1",
                            reason: queueResult?.reason || "queue_not_ready",
                        });
                    }
                    continue;
                }

                if (hasPhase1 && !hasPhase2) {
                    const uploadState = String(session?.audio_upload_state || "").trim().toLowerCase();
                    if (!["ready", "failed"].includes(uploadState)) {
                        summary.skipped_not_stuck += 1;
                        continue;
                    }

                    const phase2Count = Number(session?.phase2_auto_requeue_count || 0);
                    if (phase2Count >= 1) {
                        summary.skipped_guardrail += 1;
                        continue;
                    }

                    if (dryRun) {
                        summary.requeued_phase2 += 1;
                        continue;
                    }

                    const guarded = await SpeakingSession.findOneAndUpdate(
                        {
                            _id: sessionId,
                            status: { $ne: "completed" },
                            $or: [
                                { phase2_auto_requeue_count: { $exists: false } },
                                { phase2_auto_requeue_count: { $lt: 1 } },
                            ],
                        },
                        {
                            $inc: { phase2_auto_requeue_count: 1 },
                            $set: { phase2_last_requeue_at: new Date() },
                        },
                        { new: true },
                    ).lean();

                    if (!guarded) {
                        summary.skipped_guardrail += 1;
                        continue;
                    }

                    const repairTag = `backfill-${Date.now()}-${index}-p2`;
                    const queueResult = await speakingQueue.enqueueSpeakingAiPhase2Job({
                        sessionId,
                        force: true,
                        repairTag,
                    });
                    if (queueResult?.queued) {
                        summary.requeued_phase2 += 1;
                    } else {
                        summary.errors.push({
                            session_id: sessionId,
                            action: "requeue_phase2",
                            reason: queueResult?.reason || "queue_not_ready",
                        });
                    }
                    continue;
                }

                summary.skipped_not_stuck += 1;
            } catch (repairError) {
                summary.errors.push({
                    session_id: sessionId,
                    error: repairError?.message || String(repairError),
                });
            }
        }

        return res.json({
            success: true,
            data: {
                ...summary,
                dry_run: dryRun,
                window_hours: windowHours,
                stuck_threshold_ms: SPEAKING_STUCK_THRESHOLD_MS,
                as_of: now.toISOString(),
            },
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const retrySpeakingErrorLogs = async (req, res) => {
    try {
        const sessionId = String(req.params?.id || "").trim();
        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return sendControllerError(req, res, { statusCode: 400, message: "Invalid speaking session id" });
        }

        const session = await SpeakingSession.findById(sessionId)
            .select("_id status scoring_state error_logs_state")
            .lean();
        if (!session) {
            return sendControllerError(req, res, { statusCode: 404, message: "Speaking session not found" });
        }

        const { enqueueSpeakingErrorLogsJob } = await import("../queues/ai.queue.js");
        const repairTag = `manual-${Date.now()}`;
        const queueResult = await enqueueSpeakingErrorLogsJob({
            sessionId,
            force: true,
            repairTag,
        });

        return res.json({
            success: true,
            data: {
                session_id: sessionId,
                queued: Boolean(queueResult?.queued),
                job_id: queueResult?.jobId || null,
                queue: queueResult?.queue || null,
                reason: queueResult?.reason || null,
                repair_tag: repairTag,
                status: session?.status || null,
                scoring_state: session?.scoring_state || null,
                error_logs_state: session?.error_logs_state || null,
            },
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const retryFailedSpeakingErrorLogsBulk = async (req, res) => {
    try {
        const body = req.body || {};
        const windowHours = toPositiveInt(
            body.window_hours,
            SPEAKING_REPAIR_DEFAULT_WINDOW_HOURS,
            24 * 30,
        );
        const limit = toPositiveInt(
            body.limit,
            SPEAKING_REPAIR_DEFAULT_LIMIT,
            SPEAKING_REPAIR_MAX_LIMIT,
        );
        const now = new Date();
        const thresholdDate = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

        const sessions = await SpeakingSession.find({
            error_logs_state: "failed",
            $or: [
                { timestamp: { $gte: thresholdDate } },
                { createdAt: { $gte: thresholdDate } },
            ],
        })
            .sort({ timestamp: -1, createdAt: -1 })
            .limit(limit)
            .select("_id error_logs_state status scoring_state")
            .lean();

        const { enqueueSpeakingErrorLogsJob } = await import("../queues/ai.queue.js");

        const summary = {
            scanned: Array.isArray(sessions) ? sessions.length : 0,
            requeued: 0,
            skipped: 0,
            errors: [],
        };

        for (let index = 0; index < sessions.length; index += 1) {
            const session = sessions[index] || {};
            const sessionId = String(session?._id || "");
            if (!sessionId) {
                summary.skipped += 1;
                continue;
            }

            try {
                const repairTag = `bulk-${Date.now()}-${index}`;
                const queueResult = await enqueueSpeakingErrorLogsJob({
                    sessionId,
                    force: true,
                    repairTag,
                });

                if (queueResult?.queued) {
                    summary.requeued += 1;
                } else {
                    summary.skipped += 1;
                    summary.errors.push({
                        session_id: sessionId,
                        reason: queueResult?.reason || "queue_not_ready",
                    });
                }
            } catch (queueError) {
                summary.errors.push({
                    session_id: sessionId,
                    error: queueError?.message || String(queueError),
                });
            }
        }

        return res.json({
            success: true,
            data: {
                ...summary,
                window_hours: windowHours,
                limit,
                as_of: now.toISOString(),
            },
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


