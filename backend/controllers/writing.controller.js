import mongoose from "mongoose";
import Writing from "../models/Writing.model.js";
import WritingSubmission from "../models/WritingSubmission.model.js";
import TestAttempt from "../models/TestAttempt.model.js";
import User from "../models/User.model.js";
import { isAiAsyncModeEnabled } from "../config/queue.config.js";
import { enqueueWritingAiScoreJob, isAiQueueReady } from "../queues/ai.queue.js";
import { scoreWritingSubmissionById } from "../services/writingSubmissionScoring.service.js";
import { parsePagination, buildPaginationMeta } from "../utils/pagination.js";
import { handleControllerError, sendControllerError } from '../utils/controllerError.js';

const isTeacherOrAdminRequest = (req) => (
    req.user?.role === "teacher" || req.user?.role === "admin"
);

const sanitizeWritingForLearner = (writing) => ({
    _id: writing._id,
    title: writing.title,
    type: writing.type,
    prompt: writing.prompt,
    task_type: writing.task_type,
    image_url: writing.image_url || null,
    word_limit: writing.word_limit ?? null,
    essay_word_limit: writing.essay_word_limit ?? null,
    time_limit: writing.time_limit ?? null,
    is_active: writing.is_active !== false,
    is_real_test: Boolean(writing.is_real_test),
});

const canAccessSubmission = (submission, user) => {
    if (!user?.userId) return false;
    if (!submission?.user_id) return user.role === "admin" || user.role === "teacher";
    if (String(submission.user_id) === String(user.userId)) return true;
    return user.role === "admin" || user.role === "teacher";
};

const pickWritingPayload = (body = {}, { allowId = false } = {}) => {
    const allowedFields = [
        "title",
        "type",
        "prompt",
        "task_type",
        "image_url",
        "word_limit",
        "essay_word_limit",
        "time_limit",
        "sample_answer",
        "band_score",
        "is_active",
        "is_real_test",
    ];

    if (allowId) {
        allowedFields.push("_id");
    }

    return allowedFields.reduce((acc, field) => {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
            acc[field] = body[field];
        }
        return acc;
    }, {});
};

export const getAllWritings = async (req, res) => {
    try {
        const privileged = isTeacherOrAdminRequest(req);
        const writings = await Writing.find(privileged ? {} : { is_active: true });
        if (privileged) {
            return res.status(200).json({ success: true, data: writings });
        }

        const sanitized = writings.map((writing) => sanitizeWritingForLearner(writing));
        return res.status(200).json({ success: true, data: sanitized });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const createWriting = async (req, res) => {
    const writing = pickWritingPayload(req.body, { allowId: true });

    if (!writing._id || !writing.title || !writing.prompt) {
        return sendControllerError(req, res, { statusCode: 400, message: "Please provide _id, title, and prompt"  });
    }

    const newWriting = new Writing(writing);

    try {
        await newWriting.save();
        res.status(201).json({ success: true, data: newWriting });
    }
    catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const updateWriting = async (req, res) => {
    const { id } = req.params;

    const writing = pickWritingPayload(req.body);
    if (Object.keys(writing).length === 0) {
        return sendControllerError(req, res, { statusCode: 400, message: "No valid update fields provided"  });
    }

    try {
        const updatedWriting = await Writing.findByIdAndUpdate(id, writing, { new: true });
        if (!updatedWriting) {
            return sendControllerError(req, res, { statusCode: 404, message: "Writing not found"  });
        }
        return res.status(200).json({ success: true, data: updatedWriting });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const deleteWriting = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedWriting = await Writing.findByIdAndDelete(id);
        if (!deletedWriting) {
            return sendControllerError(req, res, { statusCode: 404, message: "Writing not found"  });
        }
        return res.status(200).json({ success: true, message: "Delete Success" });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const getWritingById = async (req, res) => {
    const { id } = req.params;
    try {
        const privileged = isTeacherOrAdminRequest(req);
        const writing = await Writing.findById(id);
        if (!writing) {
            return sendControllerError(req, res, { statusCode: 404, message: "Writing not found"  });
        }

        if (!privileged && writing.is_active === false) {
            return sendControllerError(req, res, { statusCode: 404, message: "Writing not found"  });
        }

        if (privileged) {
            return res.status(200).json({ success: true, data: writing });
        }

        return res.status(200).json({ success: true, data: sanitizeWritingForLearner(writing) });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

/** Get writing for exam (without sample answer and band score) */
export const getWritingExam = async (req, res) => {
    const { id } = req.params;
    try {
        const privileged = isTeacherOrAdminRequest(req);
        const writing = await Writing.findById(id);
        if (!writing) {
            return sendControllerError(req, res, { statusCode: 404, message: "Writing not found"  });
        }
        if (!privileged && writing.is_active === false) {
            return sendControllerError(req, res, { statusCode: 404, message: "Writing not found"  });
        }
        res.status(200).json({
            success: true,
            data: {
                _id: writing._id,
                title: writing.title,
                type: 'writing', // Explicitly set type for Exam.jsx
                is_real_test: writing.is_real_test || false,
                duration: writing.time_limit || 60, // Default to 60m if not set
                writing: [{
                    _id: writing._id,
                    title: writing.title,
                    prompt: writing.prompt,
                    image_url: writing.image_url,
                    task_type: writing.task_type
                }],
                reading_passages: [],
                listening_sections: []
            },
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

/** Submit writing answer */
export const submitWriting = async (req, res) => {
    const { id } = req.params; // Writing Task ID
    const { answer, student_name, student_email, test_id, gradingMode = "standard" } = req.body || {};
    const userId = req.user?.userId; // Get user ID if authenticated

    if (!answer) {
        return sendControllerError(req, res, { statusCode: 400, message: "Answer is required"  });
    }

    try {
        const writing = await Writing.findById(id);
        if (!writing) {
            console.warn(`[SubmitWriting] Writing task not found: ${id}`);
            return sendControllerError(req, res, { statusCode: 404, message: "Writing not found"  });
        }

        const trimmedAnswer = (answer || '').trim();
        if (!trimmedAnswer) {
            return sendControllerError(req, res, { statusCode: 400, message: "Answer is required and cannot be empty"  });
        }

        // Calculate word count
        const wordCount = trimmedAnswer.split(/\s+/).filter(w => w.length > 0).length;
        const newSubmission = await WritingSubmission.create({
            test_id: test_id || undefined,
            user_id: userId,
            student_name: student_name || 'Anonymous',
            student_email: student_email,
            writing_answers: [{
                task_id: writing._id,
                task_title: writing.title,
                answer_text: trimmedAnswer,
                word_count: wordCount
            }],
            status: gradingMode === "ai" ? "processing" : "pending"
        });

        let xpResult = null;
        let newlyUnlocked = [];

        if (userId) {
            const { addXP, XP_WRITING_SUBMIT } = await import("../services/gamification.service.js");
            xpResult = await addXP(userId, XP_WRITING_SUBMIT, 'writing');

            const { checkAchievements } = await import("../services/achievement.service.js");
            newlyUnlocked = await checkAchievements(userId);
        }

        if (gradingMode !== "ai") {
            return res.status(200).json({
                success: true,
                data: {
                    submissionId: newSubmission._id,
                    status: newSubmission.status,
                    xpResult,
                    achievements: newlyUnlocked
                },
            });
        }

        const shouldQueue = isAiAsyncModeEnabled() && isAiQueueReady();
        if (shouldQueue) {
            try {
                const queueResult = await enqueueWritingAiScoreJob({
                    submissionId: String(newSubmission._id),
                    force: true,
                });

                if (queueResult.queued) {
                    return res.status(202).json({
                        success: true,
                        data: {
                            submissionId: newSubmission._id,
                            status: "processing",
                            queued: true,
                            jobId: queueResult.jobId,
                            xpResult,
                            achievements: newlyUnlocked
                        },
                    });
                }
            } catch (queueError) {
                console.warn("Writing enqueue failed, falling back to sync scoring:", queueError.message);
            }
        }

        const scored = await scoreWritingSubmissionById({
            submissionId: String(newSubmission._id),
            force: true,
        });

        return res.status(200).json({
            success: true,
            data: {
                submissionId: newSubmission._id,
                ...(scored.aiResult || {}),
                queued: false,
                xpResult,
                achievements: newlyUnlocked
            },
        });

    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

/** Get pending submissions for teacher */
/** Get submissions with status filtering */
export const getSubmissions = async (req, res) => {
    try {
        const { status, startDate, endDate } = req.query;
        const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
        const filter = {};
        if (status) filter.status = status;

        if (startDate && endDate) {
            filter.submitted_at = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const totalItems = await WritingSubmission.countDocuments(filter);

        const submissions = await WritingSubmission.find(filter)
            .sort({ submitted_at: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            data: submissions,
            pagination: buildPaginationMeta({ page, limit, totalItems }),
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

/** Get submission by ID for grading */
export const getSubmissionById = async (req, res) => {
    const { id } = req.params;
    try {
        // Validate ObjectId format - if invalid, return 404 instead of crashing
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendControllerError(req, res, { statusCode: 404, message: "Submission not found"  });
        }

        const submission = await WritingSubmission.findById(id);
        if (!submission) {
            return sendControllerError(req, res, { statusCode: 404, message: "Submission not found"  });
        }

        // Populate task details (images, prompts) for each writing answer
        const enrichedAnswers = await Promise.all(
            submission.writing_answers.map(async (answer) => {
                const taskDetails = await Writing.findById(answer.task_id).select('title prompt image_url task_type');
                return {
                    ...answer.toObject(),
                    task_prompt: taskDetails?.prompt || '',
                    task_image: taskDetails?.image_url || null,
                    task_type: taskDetails?.task_type || 'Task 1'
                };
            })
        );

        const enrichedSubmission = {
            ...submission.toObject(),
            writing_answers: enrichedAnswers
        };

        res.status(200).json({ success: true, data: enrichedSubmission });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

/** Get submission status for async AI scoring */
export const getSubmissionStatus = async (req, res) => {
    const { id } = req.params;
    try {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return sendControllerError(req, res, { statusCode: 404, message: "Submission not found"  });
        }

        const submission = await WritingSubmission.findById(id).lean();
        if (!submission) {
            return sendControllerError(req, res, { statusCode: 404, message: "Submission not found"  });
        }

        if (!canAccessSubmission(submission, req.user)) {
            return sendControllerError(req, res, { statusCode: 403, message: "Forbidden"  });
        }

        return res.status(200).json({
            success: true,
            data: {
                _id: submission._id,
                status: submission.status,
                score: submission.score ?? null,
                is_ai_graded: !!submission.is_ai_graded,
                ai_result: submission.ai_result || null,
                writing_answers: submission.writing_answers || [],
                submitted_at: submission.submitted_at,
                updatedAt: submission.updatedAt,
            },
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

/** Score a submission */
export const scoreSubmission = async (req, res) => {
    const { id } = req.params; // Submission ID
    const { scores, feedback } = req.body; // Array of scores or single score object

    try {
        const submission = await WritingSubmission.findById(id);

        if (!submission) {
            return sendControllerError(req, res, { statusCode: 404, message: "Submission not found"  });
        }

        const user = await User.findById(req.user?.userId);
        const graderName = user ? user.name : 'Teacher';

        const incomingScores = Array.isArray(scores)
            ? scores
            : (scores && typeof scores === "object" ? [scores] : []);

        if (incomingScores.length === 0 && !feedback) {
            return sendControllerError(req, res, { statusCode: 400, message: "scores or feedback is required"  });
        }

        if (incomingScores.length > 0) {
            const defaultTaskId = submission.writing_answers?.[0]?.task_id;
            submission.scores = incomingScores.map((entry) => {
                const parsedScore = Number(entry?.score);
                return {
                    task_id: entry?.task_id || defaultTaskId || null,
                    score: Number.isFinite(parsedScore) ? parsedScore : null,
                    feedback: String(entry?.feedback || "").trim(),
                    scored_at: new Date(),
                    scored_by: graderName
                };
            });
        } else {
            submission.scores = [{
                task_id: submission.writing_answers?.[0]?.task_id || null,
                score: null,
                feedback: String(feedback || "").trim(),
                scored_at: new Date(),
                scored_by: graderName
            }];
        }

        submission.status = 'scored';

        const scoreTaskIds = submission.scores.map((item) => item?.task_id).filter(Boolean);
        const writingTasks = scoreTaskIds.length > 0
            ? await Writing.find({ _id: { $in: scoreTaskIds } }).select("_id task_type").lean()
            : [];
        const taskTypeById = new Map(writingTasks.map((task) => [String(task._id), task.task_type]));

        const normalizedScores = submission.scores.map((item) => ({
            ...item,
            task_type: taskTypeById.get(String(item.task_id || "")) || null,
        }));
        const validScores = normalizedScores.filter((item) => Number.isFinite(item.score));

        let finalScore = null;
        if (validScores.length > 0) {
            const task1 = validScores.find((item) => item.task_type === "task1");
            const task2 = validScores.find((item) => item.task_type === "task2");

            if (task1 && task2) {
                finalScore = Math.round((((task2.score * 2) + task1.score) / 3) * 2) / 2;
            } else {
                const avg = validScores.reduce((sum, item) => sum + item.score, 0) / validScores.length;
                finalScore = Math.round(avg * 2) / 2;
            }
        }

        if (finalScore !== null) {
            submission.score = finalScore;
        }

        await submission.save();

        if (submission.attempt_id && finalScore !== null) {
            const attemptTask1 = validScores.find((item) => item.task_type === "task1") || validScores[0] || null;
            const attemptTask2 = validScores.find((item) => item.task_type === "task2") || validScores[1] || null;
            const combinedFeedback = validScores
                .map((item) => String(item.feedback || "").trim())
                .filter(Boolean)
                .join("\n\n");

            await TestAttempt.findByIdAndUpdate(submission.attempt_id, {
                score: finalScore,
                total: 9,
                percentage: Math.round((finalScore / 9) * 100),
                status: "scored",
                writing_details: {
                    task1_score: attemptTask1?.score ?? null,
                    task2_score: attemptTask2?.score ?? null,
                    feedback: combinedFeedback
                }
            });
        }

        res.status(200).json({ success: true, data: submission });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

/** Regenerate ID for a writing task (Fix for manual/invalid IDs) */
export const regenerateWritingId = async (req, res) => {
    const { id } = req.params; // Old ID (likely a string like "writing-1")

    try {
        const Writing = (await import("../models/Writing.model.js")).default;
        const Test = (await import("../models/Test.model.js")).default;

        // 1. Find the original writing task
        const oldWriting = await Writing.findById(id).lean();
        if (!oldWriting) {
            return sendControllerError(req, res, { statusCode: 404, message: "Writing task not found"  });
        }

        // 2. Create new ID
        const newId = new mongoose.Types.ObjectId();

        // 3. Create new writing document
        const newWritingData = { ...oldWriting, _id: newId };
        delete newWritingData.__v; // Remove version key

        const newWriting = new Writing(newWritingData);
        await newWriting.save();

        // 4. Find all Tests that reference the old ID
        // The field is `writing_tasks` which is an array of String refs
        const tests = await Test.find({ writing_tasks: id });

        // 5. Update each test
        let updatedTestsCount = 0;
        for (const test of tests) {
            const index = test.writing_tasks.indexOf(id);
            if (index !== -1) {
                test.writing_tasks[index] = newId.toString(); // Store as string to match schema
                await test.save();
                updatedTestsCount++;
            }
        }

        // 6. Delete old writing task
        await Writing.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            data: {
                oldId: id,
                newId: newId,
                updatedTests: updatedTestsCount
            },
            message: `Successfully migrated ID and updated ${updatedTestsCount} linked tests.`
        });

    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

/** AI Score a submission (Single Task Focus) */
export const scoreSubmissionAI = async (req, res) => {
    const { id } = req.params; // Submission ID
    try {
        const submission = await WritingSubmission.findById(id);
        if (!submission) {
            return sendControllerError(req, res, { statusCode: 404, message: "Submission not found"  });
        }

        if (!canAccessSubmission(submission, req.user)) {
            return sendControllerError(req, res, { statusCode: 403, message: "Forbidden"  });
        }

        // For Single Task mode, we check the first answer
        if (!submission.writing_answers || submission.writing_answers.length === 0) {
            return sendControllerError(req, res, { statusCode: 400, message: "No writing answers found in submission"  });
        }

        const shouldQueue = isAiAsyncModeEnabled() && isAiQueueReady();
        if (shouldQueue) {
            try {
                await WritingSubmission.findByIdAndUpdate(id, { status: "processing" });
                const queueResult = await enqueueWritingAiScoreJob({
                    submissionId: String(id),
                    force: true,
                });

                if (queueResult.queued) {
                    return res.status(202).json({
                        success: true,
                        data: {
                            submissionId: id,
                            status: "processing",
                            queued: true,
                            jobId: queueResult.jobId,
                        },
                    });
                }
            } catch (queueError) {
                console.warn("Writing enqueue failed, falling back to sync scoring:", queueError.message);
            }
        }

        const scored = await scoreWritingSubmissionById({
            submissionId: String(id),
            force: true,
        });

        return res.status(200).json({ success: true, data: scored.submission });

    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

/** Upload image to Cloudinary */
export const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return sendControllerError(req, res, { statusCode: 400, message: "No file uploaded"  });
        }

        const cloudinary = (await import("../utils/cloudinary.js")).default;

        // Upload from buffer
        const b64 = Buffer.from(req.file.buffer).toString("base64");
        let dataURI = "data:" + req.file.mimetype + ";base64," + b64;

        const result = await cloudinary.uploader.upload(dataURI, {
            folder: "ielts-writing-task1",
        });

        res.status(200).json({
            success: true,
            data: {
                url: result.secure_url,
                public_id: result.public_id
            }
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};


