import TestAttempt from "../models/TestAttempt.model.js";
import OpenAI from "openai";
import {
    createTaxonomyErrorLog,
    getFallbackErrorCode,
    isValidErrorCodeForSkill,
    listErrorCodesForSkill,
    normalizeQuestionType,
    normalizeSkillDomain,
} from "./taxonomy.registry.js";

const openai = process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

const OBJECTIVE_SKILLS = new Set(["reading", "listening"]);
const TFNG_TYPES = new Set(["true_false_not_given", "yes_no_not_given"]);
const COMPLETION_TYPES = new Set([
    "short_answer",
    "sentence_completion",
    "summary_completion",
    "note_completion",
    "table_completion",
    "diagram_completion",
    "form_completion",
]);

const pluralCandidates = (word) => {
    const base = String(word || "");
    return [base + "s", base + "es"];
};

const normalizeAnswer = (value) => String(value || "").trim().toLowerCase();

const defaultExplanation = (uAns, cAns) =>
    `Automatic classification: expected '${cAns || "N/A"}' but got '${uAns || "N/A"}'.`;

// Helper for Levenshtein distance
function levenshteinDistance(s1, s2) {
    if (!s1 || !s2) return 0;
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix = [];
    for (let i = 0; i <= len1; i += 1) matrix[i] = [i];
    for (let j = 0; j <= len2; j += 1) matrix[0][j] = j;

    for (let i = 1; i <= len1; i += 1) {
        for (let j = 1; j <= len2; j += 1) {
            if (s1.charAt(i - 1) === s2.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1),
                );
            }
        }
    }
    return matrix[len1][len2];
}

const buildErrorLog = ({
    question,
    skillDomain,
    errorCode,
    explanation,
    studentHighlights,
    detectionMethod,
    confidence,
    secondaryErrorCodes = [],
}) => {
    return createTaxonomyErrorLog({
        skillDomain,
        taskType: question?.type || "unknown",
        questionType: normalizeQuestionType(question?.type || "unknown"),
        errorCode,
        questionNumber: question?.question_number,
        userAnswer: question?.your_answer,
        correctAnswer: question?.correct_answer,
        studentHighlights,
        textSnippet: question?.question_text,
        explanation: explanation || defaultExplanation(question?.your_answer, question?.correct_answer),
        detectionMethod: detectionMethod || "system",
        confidence,
        secondaryErrorCodes,
    });
};

export const classifyObjectiveHeuristic = ({ question, skillDomain }) => {
    const type = normalizeQuestionType(question?.type || "unknown");
    const uAns = normalizeAnswer(question?.your_answer);
    const cAns = normalizeAnswer(question?.correct_answer);

    if (!uAns) {
        if (skillDomain === "reading" && COMPLETION_TYPES.has(type)) {
            return {
                errorCode: "R-A6",
                confidence: 0.95,
                explanation: "Automatic classification: incomplete answer (blank response).",
            };
        }
        return null;
    }

    if (TFNG_TYPES.has(type) && skillDomain === "reading") {
        const isFalseLike = uAns === "false" || uAns === "no";
        const correctFalseLike = cAns === "false" || cAns === "no";
        const isTrueLike = uAns === "true" || uAns === "yes";
        const correctTrueLike = cAns === "true" || cAns === "yes";

        if ((isFalseLike && cAns === "not given") || (uAns === "not given" && correctFalseLike)) {
            return {
                errorCode: "R-T1",
                confidence: 0.97,
                explanation: defaultExplanation(uAns, cAns),
            };
        }
        if ((isTrueLike && correctFalseLike) || (isFalseLike && correctTrueLike)) {
            return {
                errorCode: "R-T2",
                confidence: 0.96,
                explanation: defaultExplanation(uAns, cAns),
            };
        }
        if (isTrueLike && cAns === "not given") {
            return {
                errorCode: "R-T3",
                confidence: 0.94,
                explanation: defaultExplanation(uAns, cAns),
            };
        }
    }

    if (COMPLETION_TYPES.has(type) && uAns.length > 2 && cAns.length > 2) {
        const pluralMismatch = pluralCandidates(uAns).includes(cAns) || pluralCandidates(cAns).includes(uAns);
        if (pluralMismatch) {
            return {
                errorCode: skillDomain === "reading" ? "R-A2" : "L-A2",
                confidence: 0.95,
                explanation: defaultExplanation(uAns, cAns),
            };
        }

        const dist = levenshteinDistance(uAns, cAns);
        if (dist > 0 && dist <= 2 && Math.max(uAns.length, cAns.length) > 4) {
            return {
                errorCode: skillDomain === "reading" ? "R-A1" : "L-A1",
                confidence: 0.9,
                explanation: defaultExplanation(uAns, cAns),
            };
        }
    }

    return null;
};

/**
 * Evaluates Reading and Listening errors asynchronously.
 * Uses string-matching heuristics first. If the error is cognitive (wrong option, wrong paragraph),
 * it can fallback to an LLM.
 */
export async function evaluateObjectiveErrorsAsync(attemptId, questionReviewList, skill, studentHighlights = []) {
    try {
        const skillDomain = normalizeSkillDomain(skill);
        if (!OBJECTIVE_SKILLS.has(skillDomain)) {
            console.warn(`[TAXONOMY] Unsupported skill '${skill}'. Supported: reading/listening.`);
            return;
        }

        const reviewList = Array.isArray(questionReviewList) ? questionReviewList : [];
        console.log(`[TAXONOMY] Starting evaluation for attempt ${attemptId}. Skill: ${skillDomain}, Questions to review: ${reviewList.length}`);

        const attempt = await TestAttempt.findById(attemptId);
        if (!attempt) {
            console.error(`[TAXONOMY] Attempt not found in DB: ${attemptId}`);
            return;
        }

        const errorLogs = [];
        const unclassifiedErrorsForLLM = [];

        for (const q of reviewList) {
            if (q.is_correct) continue;

            const heuristic = classifyObjectiveHeuristic({ question: q, skillDomain });
            if (heuristic?.errorCode) {
                errorLogs.push(buildErrorLog({
                    question: q,
                    skillDomain,
                    errorCode: heuristic.errorCode,
                    explanation: heuristic.explanation,
                    studentHighlights,
                    detectionMethod: "heuristic",
                    confidence: heuristic.confidence,
                }));
                continue;
            }

            unclassifiedErrorsForLLM.push(q);
        }

        console.log(`[TAXONOMY] Found ${errorLogs.length} heuristic errors. Sending ${unclassifiedErrorsForLLM.length} errors to LLM...`);

        if (unclassifiedErrorsForLLM.length > 0 && openai) {
            try {
                const llmLogs = await runLLMTaxonomyClassification(unclassifiedErrorsForLLM, skillDomain, studentHighlights);
                errorLogs.push(...llmLogs);
            } catch (llmError) {
                console.error("LLM Taxonomy error:", llmError);
            }
        }

        if (errorLogs.length > 0) {
            attempt.error_logs = errorLogs;
            await attempt.save();
            console.log(`[TAXONOMY] Saved ${errorLogs.length} total error logs for attempt ${attemptId}`);
        } else {
            console.log(`[TAXONOMY] No error logs generated for attempt ${attemptId}`);
        }
    } catch (e) {
        console.error("Error in taxonomy service:", e);
    }
}

async function runLLMTaxonomyClassification(questionsList, skill, studentHighlights = []) {
    if (questionsList.length === 0 || !openai) return [];

    const skillDomain = normalizeSkillDomain(skill);
    const fallbackCode = getFallbackErrorCode(skillDomain);
    const availableCodes = listErrorCodesForSkill(skillDomain).filter((code) => !code.endsWith("UNCLASSIFIED"));
    const allowedCodesText = availableCodes.join(", ");

    const prompt = `
You are an IELTS taxonomy expert evaluating incorrect answers for a ${skillDomain} test.
Pick one primary error code from this allowed list only:
${allowedCodesText}

Return strict JSON with this schema:
{
  "errors": [
    {
      "question_number": 1,
      "error_code": "R-C4",
      "secondary_error_codes": ["R-C2"],
      "confidence": 0.72,
      "explanation": "Giai thich ngan gon bang tieng Viet"
    }
  ]
}

Questions:
${questionsList.map((q) =>
        `Q${q.question_number}: Type="${normalizeQuestionType(q.type)}", Text="${q.question_text}", User Answer="${q.your_answer}", Correct Answer="${q.correct_answer}", Options=${JSON.stringify(q.options)}`,
    ).join("\n")}

${studentHighlights && studentHighlights.length > 0
        ? `The student highlighted the following phrases in the passage:\n- ${studentHighlights.join("\n- ")}\nUse these highlights to judge keyword/scope related errors.`
        : ""}
`;

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: "You output strict JSON." },
            { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
    });

    const parsed = JSON.parse(response.choices?.[0]?.message?.content || "{}");
    const classifiedArray = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.errors) ? parsed.errors : []);

    return classifiedArray
        .map((c) => {
            const originalQ = questionsList.find((q) => q.question_number === c.question_number);
            if (!originalQ) return null;

            const rawCode = String(c.error_code || "").trim().toUpperCase();
            const resolvedCode = isValidErrorCodeForSkill(rawCode, skillDomain) ? rawCode : fallbackCode;

            return buildErrorLog({
                question: originalQ,
                skillDomain,
                errorCode: resolvedCode,
                explanation: c.explanation || "Duoc phan loai boi AI.",
                studentHighlights,
                detectionMethod: "llm",
                confidence: c.confidence,
                secondaryErrorCodes: c.secondary_error_codes,
            });
        })
        .filter(Boolean);
}
