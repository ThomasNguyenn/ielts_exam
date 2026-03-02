import mongoose from "mongoose";
import Test from "../models/Test.model.js";
import TestAttempt from "../models/TestAttempt.model.js";
import { parsePagination, buildPaginationMeta } from "../utils/pagination.js";
import { SubmissionError, submitExamFlow } from "../services/testSubmission.service.js";
import { handleControllerError, sendControllerError } from "../utils/controllerError.js";

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ALLOWED_TEST_TYPES = ['reading', 'listening', 'writing'];
const TRUTHY_QUERY_VALUES = new Set(['1', 'true', 'yes']);
const isTeacherOrAdminRequest = (req) => (
    req.user?.role === 'teacher' || req.user?.role === 'admin'
);
const parseTruthyQueryFlag = (value) => {
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined) return false;
    return TRUTHY_QUERY_VALUES.has(String(value).trim().toLowerCase());
};
const pickTestPayload = (body = {}, { allowId = false } = {}) => {
    const allowed = [
        "title",
        "category",
        "type",
        "duration",
        "full_audio",
        "is_active",
        "is_real_test",
        "reading_passages",
        "listening_sections",
        "writing_tasks",
    ];
    if (allowId) {
        allowed.push("_id");
    }

    return allowed.reduce((acc, field) => {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
            acc[field] = body[field];
        }
        return acc;
    }, {});
};

const buildTestFilter = (query = {}, { includeCategory = true } = {}) => {
    const filter = {};

    if (query.type && ALLOWED_TEST_TYPES.includes(query.type)) {
        filter.type = query.type;
    }

    if (includeCategory && query.category && query.category !== 'all') {
        filter.category = query.category;
    }

    if (query.q && String(query.q).trim()) {
        const safeRegex = new RegExp(escapeRegex(String(query.q).trim()), 'i');
        filter.$or = [
            { title: safeRegex },
            { _id: safeRegex },
            { category: safeRegex },
            { type: safeRegex }
        ];
    }

    return filter;
};

const normalizeReviewAnswer = (value) =>
    String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

const resolveQuestionText = (group = {}, question = {}) => {
    const direct = String(question?.text || "").trim();
    if (direct) return direct;
    return String(group?.instructions || group?.text || "").trim();
};

const buildObjectiveQuestionReview = ({ attempt, test, examType }) => {
    const detailedAnswers = Array.isArray(attempt?.detailed_answers) ? attempt.detailed_answers : [];
    const detailedByQuestionNumber = new Map();
    detailedAnswers.forEach((item) => {
        const key = Number(item?.question_number);
        if (!Number.isFinite(key)) return;
        if (!detailedByQuestionNumber.has(key)) {
            detailedByQuestionNumber.set(key, item);
        }
    });

    const questionReview = [];
    let runningIndex = 0;
    const sourceItems = examType === "listening"
        ? (test?.listening_sections || [])
        : (test?.reading_passages || []);

    sourceItems.forEach((item) => {
        (item?.question_groups || []).forEach((group) => {
            (group?.questions || []).forEach((question) => {
                const fallbackQuestionNumber = runningIndex + 1;
                const questionNumber = Number(question?.q_number) || fallbackQuestionNumber;
                const detail = detailedByQuestionNumber.get(questionNumber) || detailedAnswers[runningIndex] || null;

                const yourAnswerRaw = detail?.user_answer ?? "";
                const yourAnswer = Array.isArray(yourAnswerRaw) ? String(yourAnswerRaw[0] || "") : String(yourAnswerRaw || "");
                const isMultiSelectGroup = group?.type === 'mult_choice' && (group?.questions || []).length > 1;
                
                // For multi-select groups, always use the DB's authoritative correct_answers array per question.
                // For single-answer, use saved detail.correct_answer or fallback to DB.
                let correctAnswer;
                if (isMultiSelectGroup) {
                    correctAnswer = Array.isArray(question?.correct_answers) ? question.correct_answers : [];
                } else {
                    const raw = detail?.correct_answer 
                        ?? (Array.isArray(question?.correct_answers) ? question.correct_answers[0] : '')
                        ?? '';
                    correctAnswer = Array.isArray(raw) ? (raw[0] ?? '') : raw;
                }
                const isCorrect = typeof detail?.is_correct === "boolean"
                    ? detail.is_correct
                    : normalizeReviewAnswer(yourAnswer) !== "" &&
                    normalizeReviewAnswer(yourAnswer) === normalizeReviewAnswer(correctAnswer);

                questionReview.push({
                    question_number: questionNumber,
                    type: String(group?.type || detail?.question_type || "unknown"),
                    question_text: resolveQuestionText(group, question),
                    your_answer: yourAnswer,
                    correct_answer: correctAnswer,
                    options: Array.isArray(question?.option) && question.option.length > 0
                        ? question.option
                        : (group?.options || []),
                    headings: group?.headings || [],
                    is_correct: isCorrect,
                    explanation: String(question?.explanation || ""),
                    passage_reference: String(question?.passage_reference || ""),
                    item_type: examType,
                });
                runningIndex += 1;
            });
        });
    });

    return questionReview;
};

export const getAllTests = async (req, res) => {
    try {
        const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;
        const filter = buildTestFilter(req.query);
        const includeQuestionGroupTypes = parseTruthyQueryFlag(req.query.includeQuestionGroupTypes);
        const readingSelect = includeQuestionGroupTypes ? 'title question_groups.type' : 'title';
        const listeningSelect = includeQuestionGroupTypes ? 'title question_groups.type' : 'title';

        const baseQuery = Test.find(filter)
            .populate('reading_passages', readingSelect)
            .populate('listening_sections', listeningSelect)
            .populate('writing_tasks', 'title task_type writing_task_type')
            .sort({ created_at: -1 });

        if (!shouldPaginate) {
            const tests = await baseQuery.lean();
            return res.status(200).json({ success: true, data: tests });
        }

        const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 12, maxLimit: 100 });
        const [tests, totalItems] = await Promise.all([
            baseQuery.skip(skip).limit(limit).lean(),
            Test.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: tests,
            pagination: buildPaginationMeta({ page, limit, totalItems })
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const getTestCategories = async (req, res) => {
    try {
        const filter = buildTestFilter(req.query, { includeCategory: false });

        const rows = await Test.aggregate([
            { $match: filter },
            {
                $project: {
                    category: {
                        $trim: {
                            input: { $ifNull: ['$category', ''] }
                        }
                    }
                }
            },
            {
                $addFields: {
                    category: {
                        $cond: [{ $eq: ['$category', ''] }, 'Uncategorized', '$category']
                    }
                }
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const data = rows.map((row) => ({
            category: row._id,
            count: row.count
        }));

        res.status(200).json({ success: true, data });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Get latest attempt per test for the logged-in user
export const getMyLatestAttempts = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return sendControllerError(req, res, { statusCode: 401, message: "Unauthorized"  });
        }

        const attempts = await TestAttempt.aggregate([
            { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
            { $sort: { submitted_at: -1 } },
            {
                $group: {
                    _id: "$test_id",
                    latest: { $first: "$$ROOT" },
                },
            },
            {
                $project: {
                    _id: 0,
                    test_id: "$_id",
                    type: "$latest.type",
                    score: "$latest.score",
                    total: "$latest.total",
                    wrong: "$latest.wrong",
                    percentage: "$latest.percentage",
                    submitted_at: "$latest.submitted_at",
                },
            },
        ]);

        res.status(200).json({ success: true, data: attempts });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Get latest + best attempt per test for the logged-in user
export const getMyAttemptSummary = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return sendControllerError(req, res, { statusCode: 401, message: "Unauthorized"  });
        }

        const userObjectId = new mongoose.Types.ObjectId(userId);

        const latest = await TestAttempt.aggregate([
            { $match: { user_id: userObjectId } },
            { $sort: { submitted_at: -1 } },
            {
                $group: {
                    _id: "$test_id",
                    latest: { $first: "$$ROOT" },
                },
            },
            {
                $project: {
                    _id: 0,
                    test_id: "$_id",
                    latest: {
                        type: "$latest.type",
                        score: "$latest.score",
                        total: "$latest.total",
                        wrong: "$latest.wrong",
                        percentage: "$latest.percentage",
                        submitted_at: "$latest.submitted_at",
                    },
                },
            },
        ]);

        const best = await TestAttempt.aggregate([
            { $match: { user_id: userObjectId, percentage: { $ne: null } } },
            { $sort: { percentage: -1, submitted_at: -1 } },
            {
                $group: {
                    _id: "$test_id",
                    best: { $first: "$$ROOT" },
                },
            },
            {
                $project: {
                    _id: 0,
                    test_id: "$_id",
                    best: {
                        type: "$best.type",
                        score: "$best.score",
                        total: "$best.total",
                        wrong: "$best.wrong",
                        percentage: "$best.percentage",
                        submitted_at: "$best.submitted_at",
                    },
                },
            },
        ]);

        const bestMap = {};
        best.forEach((b) => {
            bestMap[b.test_id] = b.best;
        });

        const summary = latest.map((l) => ({
            test_id: l.test_id,
            latest: l.latest,
            best: bestMap[l.test_id] || null,
        }));

        res.status(200).json({ success: true, data: summary });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Get all attempts for a test for the logged-in user
export const getMyTestAttempts = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        if (!userId) {
            return sendControllerError(req, res, { statusCode: 401, message: "Unauthorized"  });
        }
        const attempts = await TestAttempt.find({ user_id: userId, test_id: id })
            .sort({ submitted_at: -1 })
            .lean();
        res.status(200).json({ success: true, data: attempts });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

// Get a specific objective attempt result with question explanations for review mode.
export const getMyAttemptResult = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { attemptId } = req.params;
        if (!userId) {
            return sendControllerError(req, res, { statusCode: 401, message: "Unauthorized" });
        }
        if (!mongoose.Types.ObjectId.isValid(attemptId)) {
            return sendControllerError(req, res, { statusCode: 404, message: "Attempt not found" });
        }

        const attempt = await TestAttempt.findOne({
            _id: attemptId,
            user_id: userId,
        }).lean();
        if (!attempt) {
            return sendControllerError(req, res, { statusCode: 404, message: "Attempt not found" });
        }

        const examType = String(attempt?.type || "").toLowerCase();
        if (examType !== "reading" && examType !== "listening") {
            return sendControllerError(req, res, {
                statusCode: 400,
                message: "Only reading/listening attempts support detailed review",
            });
        }

        const test = await Test.findById(attempt.test_id)
            .populate("reading_passages")
            .populate("listening_sections")
            .lean();
        if (!test) {
            return sendControllerError(req, res, { statusCode: 404, message: "Test not found" });
        }

        const questionReview = buildObjectiveQuestionReview({ attempt, test, examType });
        const total = Number.isFinite(Number(attempt?.total)) ? Number(attempt.total) : questionReview.length;
        const score = Number.isFinite(Number(attempt?.score))
            ? Number(attempt.score)
            : questionReview.filter((item) => item?.is_correct).length;
        const skipped = Number.isFinite(Number(attempt?.skipped))
            ? Number(attempt.skipped)
            : questionReview.filter((item) => !String(item?.your_answer || "").trim()).length;
        const wrong = Number.isFinite(Number(attempt?.wrong))
            ? Number(attempt.wrong)
            : Math.max(0, total - score - skipped);
        const percentage = Number.isFinite(Number(attempt?.percentage))
            ? Number(attempt.percentage)
            : (total > 0 ? Math.round((score / total) * 100) : null);

        const exam = {
            testId: test._id,
            title: test.title,
            type: examType,
            is_real_test: Boolean(test.is_real_test),
            duration: test.duration || (examType === "reading" ? 60 : 35),
            full_audio: test.full_audio || null,
            reading: examType === "reading" ? (test.reading_passages || []).map((p) => stripForExam(p)) : [],
            listening: examType === "listening" ? (test.listening_sections || []).map((s) => stripForExam(s)) : [],
            writing: [],
        };

        return res.status(200).json({
            success: true,
            data: {
                attempt: {
                    _id: attempt._id,
                    test_id: attempt.test_id,
                    type: examType,
                    score,
                    total,
                    wrong,
                    skipped,
                    percentage,
                    time_taken_ms: Number.isFinite(Number(attempt?.time_taken_ms)) ? Number(attempt.time_taken_ms) : null,
                    submitted_at: attempt.submitted_at || null,
                },
                exam,
                question_review: questionReview,
            },
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const createTest = async (req, res) => {
    const test = pickTestPayload(req.body, { allowId: true }); // user will send this data by api

    if (!test.title) {
        return sendControllerError(req, res, { statusCode: 400, message: "Please provide all info"  });
    }

    const newTest = new Test(test);

    try {
        await newTest.save();
        res.status(201).json({ success: true, data: newTest });
    }
    catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const updateTest = async (req, res) => {
    const { id } = req.params;

    const test = pickTestPayload(req.body);
    if (Object.keys(test).length === 0) {
        return sendControllerError(req, res, { statusCode: 400, message: "No valid update fields provided"  });
    }

    try {
        const updatedTest = await Test.findByIdAndUpdate(id, test, { new: true });
        if (!updatedTest) {
            return sendControllerError(req, res, { statusCode: 404, message: "Test not found"  });
        }
        return res.status(200).json({ success: true, data: updatedTest });
    } catch (error) {
        return handleControllerError(req, res, error);
    }

};

export const deleteTest = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedTest = await Test.findByIdAndDelete(id);
        if (!deletedTest) {
            return sendControllerError(req, res, { statusCode: 404, message: "Test not found"  });
        }
        return res.status(200).json({ success: true, message: "Delete Success" });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const renumberTestQuestions = async (req, res) => {
    const { id } = req.params;
    try {
        const test = await Test.findById(id)
            .populate('reading_passages')
            .populate('listening_sections');

        if (!test) {
            return sendControllerError(req, res, { statusCode: 404, message: "Test not found"  });
        }

        let currentQNum = 1;

        // Helper to renumber an item (Passage or Section)
        const renumberItem = async (item, modelName) => {
            if (!item || !item.question_groups) return;

            let modified = false;
            item.question_groups.forEach(g => {
                g.questions.forEach(q => {
                    q.q_number = currentQNum++;
                    modified = true;
                });
            });

            if (modified) {
                // Save the underlying document
                if (modelName === 'Passage') {
                    await mongoose.model('Passage').findByIdAndUpdate(item._id, { question_groups: item.question_groups });
                } else if (modelName === 'Section') {
                    await mongoose.model('Section').findByIdAndUpdate(item._id, { question_groups: item.question_groups });
                }
            }
        };

        const type = test.type || 'reading';

        if (type === 'reading') {
            for (const p of test.reading_passages || []) {
                await renumberItem(p, 'Passage');
            }
        } else if (type === 'listening') {
            for (const s of test.listening_sections || []) {
                await renumberItem(s, 'Section');
            }
        }

        res.status(200).json({ success: true, message: `Renumbered questions 1 to ${currentQNum - 1}` });

    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const getTheTestById = async (req, res) => {
    const { id } = req.params;
    try {
        const test = await Test.findById(id)
            .populate('reading_passages')
            .populate('listening_sections')
            .populate('writing_tasks')
            .lean();
        if (!test) {
            return sendControllerError(req, res, { statusCode: 404, message: "Test not found"  });
        }
        if (!isTeacherOrAdminRequest(req) && test.is_active === false) {
            return sendControllerError(req, res, { statusCode: 404, message: "Test not found"  });
        }

        if (isTeacherOrAdminRequest(req)) {
            return res.status(200).json({ success: true, data: test });
        }

        const examType = test.type || 'reading';
        const sanitized = {
            _id: test._id,
            title: test.title,
            category: test.category,
            type: examType,
            duration: test.duration,
            is_active: Boolean(test.is_active),
            is_real_test: Boolean(test.is_real_test),
            full_audio: test.full_audio || null,
            reading_passages: examType === 'reading'
                ? (test.reading_passages || []).map((p) => stripForExam(p))
                : [],
            listening_sections: examType === 'listening'
                ? (test.listening_sections || []).map((s) => stripForExam(s))
                : [],
            writing_tasks: examType === 'writing'
                ? (test.writing_tasks || []).map((w) => stripForWritingExam(w))
                : [],
        };

        return res.status(200).json({ success: true, data: sanitized });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

/** Strip correct_answers and explanation from items for student exam */
function stripForExam(item) {
    if (!item) return null;
    return {
        _id: item._id,
        title: item.title,
        content: item.content,
        audio_url: item.audio_url || null,
        question_groups: (item.question_groups || []).map((g) => ({
            type: g.type,
            group_layout: g.group_layout, // Include group_layout
            instructions: g.instructions,
            text: g.text, // Include summary text
            headings: g.headings,
            options: g.options, // Include summary options
            questions: (g.questions || []).map((q) => ({
                q_number: q.q_number,
                text: q.text,
                option: q.option || [],
            })),
        })),
    };
}

/** Strip writing task for exam (return title, prompt, and image_url) */
function stripForWritingExam(item) {
    if (!item) return null;
    return {
        _id: item._id,
        title: item.title,
        prompt: item.prompt,
        image_url: item.image_url || null,
    };
}

export const getExamData = async (req, res) => {
    const { id } = req.params;
    try {
        const privileged = isTeacherOrAdminRequest(req);
        let test = await Test.findById(id)
            .populate('reading_passages')
            .populate('listening_sections')
            .populate('writing_tasks')
            .lean();

        if (!test) {
            const Passage = (await import("../models/Passage.model.js")).default;
            const Section = (await import("../models/Section.model.js")).default;
            const Writing = (await import("../models/Writing.model.js")).default;

            const [passage, section, writingTask] = await Promise.all([
                Passage.findById(id).lean(),
                Section.findById(id).lean(),
                Writing.findById(id).lean(),
            ]);

            if (passage) {
                if (!privileged && passage.is_active === false) {
                    return sendControllerError(req, res, { statusCode: 404, message: "Standalone passage not found"  });
                }

                return res.status(200).json({
                    success: true,
                    data: {
                        testId: passage._id,
                        title: passage.title,
                        type: 'reading',
                        is_real_test: false,
                        is_standalone: true,
                        standalone_type: 'reading',
                        duration: 20,
                        full_audio: null,
                        reading: [stripForExam(passage)],
                        listening: [],
                        writing: [],
                    },
                });
            }

            if (section) {
                if (!privileged && section.is_active === false) {
                    return sendControllerError(req, res, { statusCode: 404, message: "Standalone section not found"  });
                }

                return res.status(200).json({
                    success: true,
                    data: {
                        testId: section._id,
                        title: section.title,
                        type: 'listening',
                        is_real_test: false,
                        is_standalone: true,
                        standalone_type: 'listening',
                        duration: 10,
                        full_audio: null,
                        reading: [],
                        listening: [stripForExam(section)],
                        writing: [],
                    },
                });
            }

            if (writingTask) {
                if (!privileged && writingTask.is_active === false) {
                    return sendControllerError(req, res, { statusCode: 404, message: "Standalone writing task not found"  });
                }
                return res.status(200).json({
                    success: true,
                    data: {
                        testId: writingTask._id,
                        title: writingTask.title,
                        type: 'writing',
                        is_real_test: writingTask.is_real_test || false,
                        is_standalone: true,
                        standalone_type: 'writing',
                        duration: writingTask.time_limit || 60,
                        full_audio: null,
                        reading: [],
                        listening: [],
                        writing: [{
                            _id: writingTask._id,
                            title: writingTask.title,
                            prompt: writingTask.prompt,
                            image_url: writingTask.image_url,
                            task_type: writingTask.task_type
                        }],
                    },
                });
            }

            return sendControllerError(req, res, { statusCode: 404, message: "Test not found"  });
        }
        if (!privileged && test.is_active === false) {
            return sendControllerError(req, res, { statusCode: 404, message: "Test or Writing task not found"  });
        }
        const examType = test.type || 'reading';
        const reading = examType === 'reading'
            ? (test.reading_passages || []).map((p) => stripForExam(p))
            : [];
        const listening = examType === 'listening'
            ? (test.listening_sections || []).map((s) => stripForExam(s))
            : [];
        const writing = examType === 'writing'
            ? (test.writing_tasks || []).map((w) => stripForWritingExam(w))
            : [];
        res.status(200).json({
            success: true,
            data: {
                testId: test._id,
                title: test.title,
                type: examType,
                is_real_test: test.is_real_test || false,
                duration: test.duration || (examType === 'reading' ? 60 : examType === 'listening' ? 35 : 45),
                full_audio: test.full_audio || null,
                reading,
                listening,
                writing,
            },
        });
    } catch (error) {
        return handleControllerError(req, res, error);
    }
};

export const submitExam = async (req, res) => {
    const { id: testId } = req.params;

    try {
        const data = await submitExamFlow({
            testId,
            userId: req.user?.userId,
            body: req.body || {},
        });

        res.status(200).json({ success: true, data });
    } catch (error) {
        if (error instanceof SubmissionError) {
            return res.status(error.statusCode).json({ success: false, message: error.message });
        }

        return handleControllerError(req, res, error);
    }
};


