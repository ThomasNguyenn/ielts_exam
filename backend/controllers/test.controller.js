import mongoose from "mongoose";
import Test from "../models/Test.model.js";
import TestAttempt from "../models/TestAttempt.model.js";
import WritingSubmission from "../models/WritingSubmission.model.js";

export const getAllTests = async (req, res) => {
    try {
        const tests = await Test.find({});
        res.status(200).json({ success: true, data: tests });
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
        res.status(200).json({ success: true, data: updatedTest });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }

};

export const deleteTest = async (req, res) => {
    const { id } = req.params;
    try {
        await Test.findByIdAndDelete(id);
        res.status(201).json({ success: true, message: "Delete Success" });
    } catch (error) {
        res.status(404).json({ success: false, message: "Can not find and delete" });
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
            .populate('writing_tasks');
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
        const test = await Test.findById(id)
            .populate('reading_passages')
            .populate('listening_sections')
            .populate('writing_tasks');
        if (!test) {
            return res.status(404).json({ success: false, message: "Test not found" });
        }
        const examType = test.type || 'reading';
        const reading = examType === 'reading'
            ? (test.reading_passages || []).map((p) => stripForExam(p.toObject ? p.toObject() : p))
            : [];
        const listening = examType === 'listening'
            ? (test.listening_sections || []).map((s) => stripForExam(s.toObject ? s.toObject() : s))
            : [];
        const writing = examType === 'writing'
            ? (test.writing_tasks || []).map((w) => stripForWritingExam(w.toObject ? w.toObject() : w))
            : [];
        res.status(200).json({
            success: true,
            data: {
                testId: test._id,
                title: test.title,
                type: examType,
                duration: test.duration || (examType === 'reading' ? 60 : examType === 'listening' ? 35 : 45),
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
    const normalized = String(val || '').trim().toLowerCase();
    // For true_false_notgiven questions, treat "not given" as equivalent to "not"
    if (normalized === 'not given' || normalized === 'not') {
        return 'not';
    }
    return normalized;
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
            .populate('writing_tasks');
        if (!test) {
            return res.status(404).json({ success: false, message: "Test not found" });
        }
        const examType = test.type || 'reading';

        const userId = req.user?.userId;
        const attemptId = userId ? new mongoose.Types.ObjectId() : null;

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

            if (writingAnswers.length > 0) {
                await WritingSubmission.create({
                    test_id: id,
                    writing_answers: writingAnswers,
                    status: 'pending',
                    user_id: userId,
                    attempt_id: attemptId,
                    student_name: studentName,
                    student_email: studentEmail
                });
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
                for (const q of g.questions || []) {
                    const correctOptions = correctList[qIndex] || [];
                    const userAnswer = qIndex < userNormalized.length ? userNormalized[qIndex] : "";
                    const isCorrect = correctOptions.length && correctOptions.includes(userAnswer);
                    if (isCorrect) score++;

                    questionReview.push({
                        question_number: q.q_number,
                        type: g.type,
                        question_text: q.text,
                        your_answer: answers[qIndex] || "",
                        correct_answer: correctOptions[0] || "",
                        options: q.option || [],
                        is_correct: isCorrect,
                        explanation: q.explanation || "",
                        item_type: itemType,
                    });
                    qIndex++;
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

        // Store attempt for logged-in users
        if (userId && attemptId) {
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
            });
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
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
};
