import mongoose from "mongoose";
import Test from "../models/Test.model.js";
import TestAttempt from "../models/TestAttempt.model.js";
import WritingSubmission from "../models/WritingSubmission.model.js";
import { parsePagination, buildPaginationMeta } from "../utils/pagination.js";

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const getAllTests = async (req, res) => {
    try {
        const shouldPaginate = req.query.page !== undefined || req.query.limit !== undefined;
        const filter = {};

        if (req.query.type && ['reading', 'listening', 'writing'].includes(req.query.type)) {
            filter.type = req.query.type;
        }

        if (req.query.category && req.query.category !== 'all') {
            filter.category = req.query.category;
        }

        if (req.query.q && String(req.query.q).trim()) {
            const safeRegex = new RegExp(escapeRegex(String(req.query.q).trim()), 'i');
            filter.$or = [
                { title: safeRegex },
                { _id: safeRegex },
                { category: safeRegex },
                { type: safeRegex }
            ];
        }

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
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Get latest attempt per test for the logged-in user
export const getMyLatestAttempts = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
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
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Get latest + best attempt per test for the logged-in user
export const getMyAttemptSummary = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
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
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Get all attempts for a test for the logged-in user
export const getMyTestAttempts = async (req, res) => {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const attempts = await TestAttempt.find({ user_id: userId, test_id: id })
            .sort({ submitted_at: -1 })
            .lean();
        res.status(200).json({ success: true, data: attempts });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const createTest = async (req, res) => {
    const test = req.body; // user will send this data by api

    if (!test.title) {
        return res.status(400).json({ success: false, message: "Please provide all info" });
    }

    const newTest = new Test(test);

    try {
        await newTest.save();
        res.status(201).json({ success: true, data: newTest });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateTest = async (req, res) => {
    const { id } = req.params;

    const test = req.body;

    try {
        const updatedTest = await Test.findByIdAndUpdate(id, test, { new: true });
        if (!updatedTest) {
            return res.status(404).json({ success: false, message: "Test not found" });
        }
        return res.status(200).json({ success: true, data: updatedTest });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server Error" });
    }

};

export const deleteTest = async (req, res) => {
    const { id } = req.params;
    try {
        const deletedTest = await Test.findByIdAndDelete(id);
        if (!deletedTest) {
            return res.status(404).json({ success: false, message: "Test not found" });
        }
        return res.status(200).json({ success: true, message: "Delete Success" });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

export const renumberTestQuestions = async (req, res) => {
    const { id } = req.params;
    try {
        const test = await Test.findById(id)
            .populate('reading_passages')
            .populate('listening_sections');

        if (!test) {
            return res.status(404).json({ success: false, message: "Test not found" });
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
        console.error(error);
        res.status(500).json({ success: false, message: "Server Error: " + error.message });
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
            return res.status(404).json({ success: false, message: "Test not found" });
        }
        res.status(200).json({ success: true, data: test });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
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
            return res.status(404).json({ success: false, message: "Test or Writing task not found" });
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
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/** Normalize answer for comparison */
function normalizeAnswer(val) {
    if (val === null || val === undefined) return '';
    const normalized = String(val).trim().toLowerCase().replace(/\s+/g, ' ');

    // Mapping for common IELTS abbreviations and variations to canonical values
    const mapping = {
        'not given': 'not given',
        'not': 'not given',
        'ng': 'not given',
        'true': 'true',
        't': 'true',
        'false': 'false',
        'f': 'false',
        'yes': 'yes',
        'y': 'yes',
        'no': 'no',
        'n': 'no'
    };

    return mapping[normalized] || normalized;
}

/** Build flat list of correct_answers (one per question) in exam order; optional type filter */
function getCorrectAnswersList(test, examType) {
    const list = [];
    const processItem = (item) => {
        if (!item || !item.question_groups) return;
        for (const g of item.question_groups) {
            for (const q of g.questions || []) {
                list.push((q.correct_answers || []).map(normalizeAnswer));
            }
        }
    };
    const type = examType || test.type || 'reading';
    if (type === 'reading') {
        for (const p of test.reading_passages || []) processItem(p);
    } else if (type === 'listening') {
        for (const s of test.listening_sections || []) processItem(s);
    }
    // Writing type doesn't have correct answers for scoring
    return list;
}

export const submitExam = async (req, res) => {
    const { id } = req.params;
    const { answers, writing, timeTaken } = req.body || {};
    if (!Array.isArray(answers)) {
        return res.status(400).json({ success: false, message: "answers must be an array" });
    }
    try {
        const test = await Test.findById(id)
            .populate('reading_passages')
            .populate('listening_sections')
            .populate('writing_tasks')
            .lean();
        if (!test) {
            return res.status(404).json({ success: false, message: "Test not found" });
        }
        const examType = test.type || 'reading';



        const userId = req.user?.userId;
        const attemptId = userId ? new mongoose.Types.ObjectId() : null;

        // Check if this is a practice run (don't save history)
        const isPractice = req.body.isPractice === true;
        const shouldSave = userId && attemptId && !isPractice;

        let studentName = 'Anonymous';
        let studentEmail = '';

        if (userId) {
            const User = (await import("../models/User.model.js")).default;
            const user = await User.findById(userId);
            if (user) {
                studentName = user.name || user.email.split('@')[0];
                studentEmail = user.email;
            }
        }

        // Save writing submissions if this is a writing test
        if (examType === 'writing' && writing && Array.isArray(writing) && writing.length > 0) {
            const writingAnswers = writing.map((answer, index) => {
                const task = test.writing_tasks[index];
                const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;
                return {
                    task_id: task._id,
                    task_title: task.title,
                    answer_text: answer,
                    word_count: wordCount,
                };
            }).filter(w => w.answer_text.trim()); // Only save non-empty answers

            // We must save writing submission if it's a writing test, even if it's practice mode, 
            // because AI scoring needs a submission ID.
            if (writingAnswers.length > 0) {
                // If it's practice, we might not have attemptId, but we still need a submission.
                // WE MUST CREATE IT.
                const submission = await WritingSubmission.create({
                    test_id: id,
                    writing_answers: writingAnswers,
                    status: 'pending',
                    user_id: userId,
                    attempt_id: shouldSave ? attemptId : null, // Only link if attempt is saved
                    student_name: studentName,
                    student_email: studentEmail
                });
                // Expose the submission ID for frontend redirect
                res.locals.writingSubmissionId = submission._id;
            }
        }

        const correctList = getCorrectAnswersList(test, examType);
        const total = correctList.length;
        let score = 0;
        const userNormalized = answers.map((a) => normalizeAnswer(a));

        // Build detailed question review data
        const questionReview = [];
        const processItemForReview = (item, itemType) => {
            if (!item || !item.question_groups) return;
            let qIndex = questionReview.length;
            for (const g of item.question_groups) {
                // SPECIAL LOGIC: Multi-select (Choose N) - Order Independent Grading
                if (g.type === 'mult_choice' && g.questions.length > 1) {
                    // 1. Build Pool of needed answers (array of arrays of valid synonyms)
                    // e.g. [ ['a'], ['c'] ]
                    let groupCorrectPool = [];
                    g.questions.forEach(q => {
                        groupCorrectPool.push((q.correct_answers || []).map(normalizeAnswer));
                    });

                    for (const q of g.questions || []) {
                        const userAnswer = qIndex < userNormalized.length ? userNormalized[qIndex] : "";
                        let isCorrect = false;

                        // Find if userAnswer matches ANY set in the pool
                        // We iterate the pool to find a match that hasn't been used yet
                        const matchIndex = groupCorrectPool.findIndex(variants => variants && variants.includes(userAnswer));

                        if (matchIndex !== -1) {
                            isCorrect = true;
                            // Mark this option set as used so it cannot be matched again
                            // (Prevents getting double points for entering "A" twice if "A" is only valid once)
                            groupCorrectPool[matchIndex] = null;
                        }

                        if (isCorrect) score++;

                        const finalCorrectAnswer = (q.correct_answers && q.correct_answers.length > 0) ? q.correct_answers[0] : "";

                        questionReview.push({
                            question_number: q.q_number,
                            type: g.type,
                            question_text: q.text,
                            your_answer: answers[qIndex] || "",
                            correct_answer: finalCorrectAnswer,
                            options: (q.option && q.option.length > 0) ? q.option : (g.options || []),
                            headings: g.headings || [],
                            is_correct: isCorrect,
                            explanation: q.explanation || "",
                            item_type: itemType,
                        });
                        qIndex++;
                    }

                } else {
                    // STANDARD LOGIC
                    for (const q of g.questions || []) {
                        const correctOptions = correctList[qIndex] || [];
                        const userAnswer = qIndex < userNormalized.length ? userNormalized[qIndex] : "";
                        let isCorrect = correctOptions.length && correctOptions.includes(userAnswer);

                        // Special logic for Matching Headings / Features / Information
                        if (!isCorrect && (g.type === 'matching_headings' || g.type === 'matching_features' || g.type === 'matching_information')) {
                            const headings = g.headings || [];
                            // Find the heading object selected by the user (userAnswer is the ID)
                            // Note: userAnswer is normalized (lowercase). Heading IDs are usually "i", "ii", or "A", "B". 
                            // We try to match normalized ID.
                            const selectedHeading = headings.find(h => normalizeAnswer(h.id) === userAnswer);

                            if (selectedHeading) {
                                // Helper to clean roman numerals (i., ii., etc) for text comparison
                                const clean = (str) => (str || '').toLowerCase().replace(/^[ivx]+\.?\s*/i, '').trim();
                                const cleanedHeadingText = clean(selectedHeading.text);
                                const normalizedHeadingText = normalizeAnswer(selectedHeading.text);

                                // Check against all valid correct options
                                if (correctOptions.some(opt => {
                                    // 1. Check if option matches Heading Text exactly (normalized)
                                    if (opt === normalizedHeadingText) return true;
                                    // 2. Check if option matches Heading Text without Roman numerals
                                    if (clean(opt) === cleanedHeadingText) return true;
                                    // 3. Check if option is an ID that matches the selected heading ID (already covered by initial check, but for completeness)
                                    if (normalizeAnswer(opt) === normalizeAnswer(selectedHeading.id)) return true;
                                    return false;
                                })) {
                                    isCorrect = true;
                                }
                            }
                        }

                        if (isCorrect) score++;

                        const finalCorrectAnswer = (q.correct_answers && q.correct_answers.length > 0) ? q.correct_answers[0] : (correctOptions[0] || "");

                        // Persistent file logging REMOVED for performance
                        // import('fs').then(fs => {
                        //     const logData = `[${new Date().toISOString()}] Q${q.q_number}: type=${g.type}, userAnswer="${userAnswer}", correctAlternatives=${JSON.stringify(correctOptions)}, finalCorrectAnswer="${finalCorrectAnswer}", matches=${isCorrect}\n`;
                        //     fs.appendFileSync('exam_debug.log', logData);
                        // });

                        questionReview.push({
                            question_number: q.q_number,
                            type: g.type,
                            question_text: q.text,
                            your_answer: answers[qIndex] || "",
                            correct_answer: finalCorrectAnswer,
                            options: (q.option && q.option.length > 0) ? q.option : (g.options || []),
                            headings: g.headings || [], // Include headings for matching questions
                            is_correct: isCorrect,
                            explanation: q.explanation || "",
                            item_type: itemType,
                        });
                        qIndex++;
                    }
                }
            }
        };

        if (examType === 'reading') {
            for (const p of test.reading_passages || []) processItemForReview(p, 'reading');
        } else if (examType === 'listening') {
            for (const s of test.listening_sections || []) processItemForReview(s, 'listening');
        }

        let skipped = 0;
        for (let i = 0; i < total; i++) {
            const ans = userNormalized[i];
            if (!ans || ans === '') {
                skipped++;
            }
        }

        const answeredWrong = total - score - skipped;
        const wrong = answeredWrong;

        const percentage = total ? Math.round((score / total) * 100) : null;
        const readingScore = examType === 'reading' ? score : 0;
        const readingTotal = examType === 'reading' ? total : 0;
        const listeningScore = examType === 'listening' ? score : 0;
        const listeningTotal = examType === 'listening' ? total : 0;
        const writingCount = examType === 'writing' ? (test.writing_tasks || []).length : 0;

        // Store attempt for logged-in users (if not practice mode)
        let xpResult = null;
        if (shouldSave) {
            const isWriting = examType === 'writing';
            await TestAttempt.create({
                _id: attemptId,
                user_id: userId,
                test_id: id,
                type: examType,
                score: isWriting ? null : score,
                total: isWriting ? null : total,
                wrong: isWriting ? null : wrong,
                skipped: isWriting ? null : skipped,
                percentage: isWriting ? null : percentage,
                time_taken_ms: typeof timeTaken === 'number' ? timeTaken : null,
                submitted_at: new Date(),
                detailed_answers: questionReview.map(q => ({
                    question_number: q.question_number,
                    question_type: q.type,
                    is_correct: q.is_correct,
                    user_answer: q.your_answer,
                    correct_answer: q.correct_answer
                }))
            });

            // Optimisation: Keep only latest 10 attempts
            const attempts = await TestAttempt.find({ user_id: userId, test_id: id })
                .sort({ submitted_at: -1 })
                .select('_id');

            if (attempts.length > 10) {
                const toDelete = attempts.slice(10).map(a => a._id);
                if (toDelete.length > 0) {
                    await TestAttempt.deleteMany({ _id: { $in: toDelete } });
                    // Also clean up related writing submissions if any
                    await WritingSubmission.deleteMany({ attempt_id: { $in: toDelete } });
                }
            }

            // Award XP
            const { addXP, XP_TEST_COMPLETION } = await import("../services/gamification.service.js");
            xpResult = await addXP(userId, XP_TEST_COMPLETION);
        }

        res.status(200).json({
            success: true,
            data: {
                score,
                total,
                wrong,
                readingScore,
                readingTotal,
                listeningScore,
                listeningTotal,
                writingCount,
                question_review: questionReview,
                timeTaken: typeof timeTaken === 'number' ? timeTaken : 0,
                writing_answers: examType === 'writing' ? writing : [],
                xpResult, // Return XP gain info
                writingSubmissionId: res.locals.writingSubmissionId || null, // Return submission ID for AI redirect
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
