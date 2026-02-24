import mongoose from "mongoose";
import Test from "../models/Test.model.js";
import TestAttempt from "../models/TestAttempt.model.js";
import User from "../models/User.model.js";
import WritingSubmission from "../models/WritingSubmission.model.js";

const ATTEMPT_HISTORY_LIMIT = 10;
const MATCHING_QUESTION_TYPES = new Set([
    "matching_headings",
    "matching_features",
    "matching_information",
    "matching_info",
    "matching",
]);

export class SubmissionError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.name = "SubmissionError";
        this.statusCode = statusCode;
    }
}

export function normalizeAnswer(value) {
    if (value === null || value === undefined) return "";

    const normalized = String(value).trim().toLowerCase().replace(/\s+/g, " ");
    const mapping = {
        "not given": "not given",
        "not": "not given",
        "ng": "not given",
        "true": "true",
        "t": "true",
        "false": "false",
        "f": "false",
        "yes": "yes",
        "y": "yes",
        "no": "no",
        "n": "no",
    };

    return mapping[normalized] || normalized;
}

export function getCorrectAnswersList(test, examType) {
    const list = [];
    const processItem = (item) => {
        if (!item || !item.question_groups) return;
        for (const group of item.question_groups) {
            for (const question of group.questions || []) {
                list.push((question.correct_answers || []).map(normalizeAnswer));
            }
        }
    };

    const type = examType || test.type || "reading";
    if (type === "reading") {
        for (const passage of test.reading_passages || []) processItem(passage);
    } else if (type === "listening") {
        for (const section of test.listening_sections || []) processItem(section);
    }

    return list;
}

export async function loadExamData(testId) {
    let test = await Test.findById(testId)
        .populate("reading_passages")
        .populate("listening_sections")
        .populate("writing_tasks")
        .lean();

    if (test) {
        return test;
    }

    const Writing = (await import("../models/Writing.model.js")).default;
    const standaloneWritingTask = await Writing.findById(testId).lean();
    if (!standaloneWritingTask) {
        throw new SubmissionError(404, "Test or Writing task not found");
    }

    test = {
        _id: standaloneWritingTask._id,
        type: "writing",
        reading_passages: [],
        listening_sections: [],
        writing_tasks: [standaloneWritingTask],
    };

    return test;
}

export function validateSubmissionPayload({ examType, answers, writing }) {
    const safeAnswers = Array.isArray(answers) ? answers : [];
    const safeWriting = Array.isArray(writing) ? writing : [];

    if (examType !== "writing" && !Array.isArray(answers)) {
        throw new SubmissionError(400, "answers must be an array");
    }

    return { safeAnswers, safeWriting };
}

export async function resolveStudentIdentity(userId) {
    let studentName = "Anonymous";
    let studentEmail = "";

    if (!userId) {
        return { studentName, studentEmail };
    }

    const user = await User.findById(userId).select("name email").lean();
    if (!user) {
        return { studentName, studentEmail };
    }

    const fallbackName = user.email ? String(user.email).split("@")[0] : null;
    studentName = user.name || fallbackName || "Anonymous";
    studentEmail = user.email || "";
    return { studentName, studentEmail };
}

export function buildWritingAnswers({ safeWriting, writingTasks }) {
    return safeWriting
        .map((answer, index) => {
            const task = writingTasks?.[index];
            const answerText = typeof answer === "string" ? answer : String(answer ?? "");
            const trimmed = answerText.trim();
            if (!task || !trimmed) return null;

            const wordCount = trimmed.split(/\s+/).length;
            return {
                task_id: task._id || task.id || String(task),
                task_title: task.title || `Task ${index + 1}`,
                answer_text: answerText,
                word_count: wordCount,
            };
        })
        .filter(Boolean);
}

export async function handleWritingSubmissions({
    examType,
    safeWriting,
    writingTasks,
    testId,
    userId,
    attemptId,
    shouldSave,
    studentName,
    studentEmail,
}) {
    if (examType !== "writing" || safeWriting.length === 0) {
        return null;
    }

    const writingAnswers = buildWritingAnswers({ safeWriting, writingTasks });
    if (writingAnswers.length === 0) {
        return null;
    }

    const submission = await WritingSubmission.create({
        test_id: testId,
        writing_answers: writingAnswers,
        status: "pending",
        user_id: userId,
        attempt_id: shouldSave ? attemptId : null,
        student_name: studentName,
        student_email: studentEmail,
    });

    return submission._id;
}

export function gradeExam({ test, examType, safeAnswers }) {
    const correctList = getCorrectAnswersList(test, examType);
    const total = correctList.length;
    let score = 0;
    const userNormalized = safeAnswers.map((answer) => normalizeAnswer(answer));
    const questionReview = [];

    const processItemForReview = (item, itemType) => {
        if (!item || !item.question_groups) return;

        let questionIndex = questionReview.length;
        for (const group of item.question_groups) {
            const groupQuestions = Array.isArray(group.questions) ? group.questions : [];

            if (group.type === "mult_choice" && groupQuestions.length > 1) {
                const groupCorrectPool = groupQuestions.map((question) =>
                    (question.correct_answers || []).map(normalizeAnswer),
                );

                for (const question of groupQuestions) {
                    const userAnswer = questionIndex < userNormalized.length ? userNormalized[questionIndex] : "";
                    const matchIndex = groupCorrectPool.findIndex(
                        (variants) => variants && variants.includes(userAnswer),
                    );
                    const isCorrect = matchIndex !== -1;

                    if (isCorrect) {
                        score += 1;
                        groupCorrectPool[matchIndex] = null;
                    }

                    const finalCorrectAnswer =
                        question.correct_answers && question.correct_answers.length > 0
                            ? question.correct_answers[0]
                            : "";

                    questionReview.push({
                        question_number: question.q_number,
                        type: group.type,
                        question_text: question.text,
                        your_answer: safeAnswers[questionIndex] || "",
                        correct_answer: finalCorrectAnswer,
                        options:
                            question.option && question.option.length > 0
                                ? question.option
                                : (group.options || []),
                        headings: group.headings || [],
                        is_correct: isCorrect,
                        explanation: question.explanation || "",
                        passage_reference: question.passage_reference || "",
                        item_type: itemType,
                    });
                    questionIndex += 1;
                }
                continue;
            }

            for (const question of groupQuestions) {
                const correctOptions = correctList[questionIndex] || [];
                const userAnswer = questionIndex < userNormalized.length ? userNormalized[questionIndex] : "";
                let isCorrect = correctOptions.length > 0 && correctOptions.includes(userAnswer);

                if (!isCorrect && MATCHING_QUESTION_TYPES.has(group.type)) {
                    const headings = group.headings || [];
                    const selectedHeading = headings.find(
                        (heading) => normalizeAnswer(heading.id) === userAnswer,
                    );

                    if (selectedHeading) {
                        const clean = (value) =>
                            String(value || "")
                                .toLowerCase()
                                .replace(/^[ivx]+\.?\s*/i, "")
                                .trim();
                        const cleanedHeadingText = clean(selectedHeading.text);
                        const normalizedHeadingText = normalizeAnswer(selectedHeading.text);

                        if (
                            correctOptions.some((option) => {
                                if (option === normalizedHeadingText) return true;
                                if (clean(option) === cleanedHeadingText) return true;
                                if (normalizeAnswer(option) === normalizeAnswer(selectedHeading.id)) return true;
                                return false;
                            })
                        ) {
                            isCorrect = true;
                        }
                    }
                }

                if (isCorrect) {
                    score += 1;
                }

                const finalCorrectAnswer =
                    question.correct_answers && question.correct_answers.length > 0
                        ? question.correct_answers[0]
                        : (correctOptions[0] || "");

                questionReview.push({
                    question_number: question.q_number,
                    type: group.type,
                    question_text: question.text,
                    your_answer: safeAnswers[questionIndex] || "",
                    correct_answer: finalCorrectAnswer,
                    options:
                        question.option && question.option.length > 0
                            ? question.option
                            : (group.options || []),
                    headings: group.headings || [],
                    is_correct: isCorrect,
                    explanation: question.explanation || "",
                    passage_reference: question.passage_reference || "",
                    item_type: itemType,
                });
                questionIndex += 1;
            }
        }
    };

    if (examType === "reading") {
        for (const passage of test.reading_passages || []) processItemForReview(passage, "reading");
    } else if (examType === "listening") {
        for (const section of test.listening_sections || []) processItemForReview(section, "listening");
    }

    let skipped = 0;
    for (let index = 0; index < total; index += 1) {
        const answer = userNormalized[index];
        if (!answer || answer === "") {
            skipped += 1;
        }
    }

    const wrong = total - score - skipped;
    const percentage = total ? Math.round((score / total) * 100) : null;

    return {
        score,
        total,
        wrong,
        skipped,
        percentage,
        questionReview,
    };
}

export async function persistAttempt({
    shouldSave,
    attemptId,
    userId,
    testId,
    examType,
    score,
    total,
    wrong,
    skipped,
    percentage,
    timeTaken,
    studentHighlights,
    questionReview,
}) {
    if (!shouldSave || !attemptId || !userId) {
        return;
    }

    const isWriting = examType === "writing";
    await TestAttempt.create({
        _id: attemptId,
        user_id: userId,
        test_id: testId,
        type: examType,
        score: isWriting ? null : score,
        total: isWriting ? null : total,
        wrong: isWriting ? null : wrong,
        skipped: isWriting ? null : skipped,
        percentage: isWriting ? null : percentage,
        time_taken_ms: typeof timeTaken === "number" ? timeTaken : null,
        submitted_at: new Date(),
        student_highlights: Array.isArray(studentHighlights) ? studentHighlights : [],
        detailed_answers: questionReview.map((question) => ({
            question_number: question.question_number,
            question_type: question.type,
            is_correct: question.is_correct,
            user_answer: question.your_answer,
            correct_answer: question.correct_answer,
        })),
    });

    const attempts = await TestAttempt.find({ user_id: userId, test_id: testId })
        .sort({ submitted_at: -1 })
        .select("_id")
        .lean();

    if (attempts.length <= ATTEMPT_HISTORY_LIMIT) {
        return;
    }

    const toDelete = attempts.slice(ATTEMPT_HISTORY_LIMIT).map((attempt) => attempt._id);
    if (toDelete.length === 0) {
        return;
    }

    await TestAttempt.deleteMany({ _id: { $in: toDelete } });
    await WritingSubmission.deleteMany({ attempt_id: { $in: toDelete } });
}

export async function awardGamification({ shouldSave, userId }) {
    if (!shouldSave || !userId) {
        return { xpResult: null, newlyUnlocked: [] };
    }

    try {
        const [{ addXP, XP_TEST_COMPLETION }, { checkAchievements }] = await Promise.all([
            import("./gamification.service.js"),
            import("./achievement.service.js"),
        ]);

        const xpResult = await addXP(userId, XP_TEST_COMPLETION, "test");
        const newlyUnlocked = await checkAchievements(userId);
        return { xpResult, newlyUnlocked };
    } catch (error) {
        console.error("awardGamification failed:", error);
        return { xpResult: null, newlyUnlocked: [] };
    }
}

export function triggerTaxonomy({
    shouldSave,
    examType,
    attemptId,
    questionReview,
    studentHighlights,
}) {
    if (!shouldSave || !attemptId) {
        return;
    }

    if (examType !== "reading" && examType !== "listening") {
        return;
    }

    import("./taxonomy.service.js")
        .then(({ evaluateObjectiveErrorsAsync }) =>
            evaluateObjectiveErrorsAsync(attemptId, questionReview, examType, studentHighlights),
        )
        .catch((error) => {
            console.error("Error running taxonomy service:", error);
        });
}

export function buildSubmitExamResponse({
    examType,
    test,
    score,
    total,
    wrong,
    questionReview,
    timeTaken,
    safeWriting,
    xpResult,
    newlyUnlocked,
    writingSubmissionId,
}) {
    const readingScore = examType === "reading" ? score : 0;
    const readingTotal = examType === "reading" ? total : 0;
    const listeningScore = examType === "listening" ? score : 0;
    const listeningTotal = examType === "listening" ? total : 0;
    const writingCount = examType === "writing" ? (test.writing_tasks || []).length : 0;

    return {
        score,
        total,
        wrong,
        readingScore,
        readingTotal,
        listeningScore,
        listeningTotal,
        writingCount,
        question_review: questionReview,
        timeTaken: typeof timeTaken === "number" ? timeTaken : 0,
        writing_answers: examType === "writing" ? safeWriting : [],
        xpResult,
        achievements: newlyUnlocked,
        writingSubmissionId: writingSubmissionId || null,
    };
}

export async function submitExamFlow({ testId, userId, body = {} }) {
    const { answers, writing, timeTaken, student_highlights: studentHighlights } = body;

    const test = await loadExamData(testId);
    const examType = test.type || "reading";
    const { safeAnswers, safeWriting } = validateSubmissionPayload({
        examType,
        answers,
        writing,
    });

    const attemptId = userId ? new mongoose.Types.ObjectId() : null;
    const isPractice = body.isPractice === true;
    const shouldSave = Boolean(userId && attemptId && !isPractice);

    const { studentName, studentEmail } = await resolveStudentIdentity(userId);
    const writingSubmissionId = await handleWritingSubmissions({
        examType,
        safeWriting,
        writingTasks: test.writing_tasks || [],
        testId,
        userId,
        attemptId,
        shouldSave,
        studentName,
        studentEmail,
    });

    const gradeResult = gradeExam({ test, examType, safeAnswers });

    await persistAttempt({
        shouldSave,
        attemptId,
        userId,
        testId,
        examType,
        score: gradeResult.score,
        total: gradeResult.total,
        wrong: gradeResult.wrong,
        skipped: gradeResult.skipped,
        percentage: gradeResult.percentage,
        timeTaken,
        studentHighlights,
        questionReview: gradeResult.questionReview,
    });

    const { xpResult, newlyUnlocked } = await awardGamification({ shouldSave, userId });

    triggerTaxonomy({
        shouldSave,
        examType,
        attemptId,
        questionReview: gradeResult.questionReview,
        studentHighlights,
    });

    return buildSubmitExamResponse({
        examType,
        test,
        score: gradeResult.score,
        total: gradeResult.total,
        wrong: gradeResult.wrong,
        questionReview: gradeResult.questionReview,
        timeTaken,
        safeWriting,
        xpResult,
        newlyUnlocked,
        writingSubmissionId,
    });
}
