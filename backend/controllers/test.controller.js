import mongoose from "mongoose";
import Test from "../models/Test.model.js";
import TestAttempt from "../models/TestAttempt.model.js";
import { parsePagination, buildPaginationMeta } from "../utils/pagination.js";
import { SubmissionError, submitExamFlow } from "../services/testSubmission.service.js";
import { handleControllerError, sendControllerError } from "../utils/controllerError.js";

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ALLOWED_TEST_TYPES = ['reading', 'listening', 'writing'];
const isTeacherOrAdminRequest = (req) => (
    req.user?.role === 'teacher' || req.user?.role === 'admin'
);
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

export const getAllTests = async (req, res) => {
    try {
        const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;
        const filter = buildTestFilter(req.query);

        const baseQuery = Test.find(filter)
            .populate('reading_passages', 'title')
            .populate('listening_sections', 'title')
            .populate('writing_tasks', 'title')
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
            // Fallback: Maybe it's a standalone Writing task ID?
            const Writing = (await import("../models/Writing.model.js")).default;
            const writingTask = await Writing.findById(id).lean();
            if (writingTask) {
                if (!privileged && writingTask.is_active === false) {
                    return sendControllerError(req, res, { statusCode: 404, message: "Test or Writing task not found"  });
                }
                return res.status(200).json({
                    success: true,
                    data: {
                        testId: writingTask._id,
                        title: writingTask.title,
                        type: 'writing',
                        is_real_test: writingTask.is_real_test || false,
                        duration: writingTask.time_limit || 60,
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
            return sendControllerError(req, res, { statusCode: 404, message: "Test or Writing task not found"  });
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


