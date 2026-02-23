import TestAttempt from "../models/TestAttempt.model.js";
import { GoogleGenerativeAI } from "@google/generativeAI"; // We might use Gemini too, but prompt requested OpenAI. I'll use OpenAI since we have it.
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Helper for Levenshtein distance
function levenshteinDistance(s1, s2) {
    if (!s1 || !s2) return 0;
    const len1 = s1.length, len2 = s2.length;
    let matrix = [];
    for (let i = 0; i <= len1; i++) matrix[i] = [i];
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            if (s1.charAt(i - 1) == s2.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1) // deletion
                );
            }
        }
    }
    return matrix[len1][len2];
}

/**
 * Evaluates Reading and Listening errors asynchronously.
 * Uses string-matching heuristics first. If the error is cognitive (wrong option, wrong paragraph), 
 * it can fallback to an LLM.
 */
export async function evaluateObjectiveErrorsAsync(attemptId, questionReviewList, skill, studentHighlights = []) {
    try {
        const attempt = await TestAttempt.findById(attemptId);
        if (!attempt) return;

        const errorLogs = [];
        const unclassifiedErrorsForLLM = [];

        for (const q of questionReviewList) {
            if (q.is_correct) continue;

            const uAns = (q.your_answer || "").trim().toLowerCase();
            const cAns = (q.correct_answer || "").trim().toLowerCase();

            if (!uAns || uAns === "") {
                // Skipped question
                continue;
            }

            let errorCode = null;
            let errorCategory = "A. Answer-Level Errors";
            let cognitiveSkill = "R1. Literal Comprehension";

            const type = q.type || "unknown";

            // Heuristic 1: TFNG Confusion
            if (['true_false_not_given', 'yes_no_not_given'].includes(type)) {
                if ((uAns === 'false' || uAns === 'no') && cAns === 'not given') {
                    errorCode = skill === 'reading' ? 'R-T1' : 'L-T1';
                } else if (uAns === 'not given' && (cAns === 'false' || cAns === 'no')) {
                    errorCode = skill === 'reading' ? 'R-T2' : 'L-T2';
                } else if ((uAns === 'true' || uAns === 'yes') && cAns === 'not given') {
                    errorCode = skill === 'reading' ? 'R-T3' : 'L-T3';
                }
            }

            // Heuristic 2: Spelling & Plural
            else if (['short_answer', 'sentence_completion', 'summary_completion', 'note_completion', 'table_completion', 'diagram_completion'].includes(type) && uAns.length > 2 && cAns.length > 2) {
                if (uAns + 's' === cAns || uAns + 'es' === cAns || cAns + 's' === uAns || cAns + 'es' === uAns) {
                    errorCode = skill === 'reading' ? 'R-A2' : 'L-A2';
                    errorCategory = "A. Answer-Level Grammar";
                } else {
                    const dist = levenshteinDistance(uAns, cAns);
                    if (dist > 0 && dist <= 2 && Math.max(uAns.length, cAns.length) > 4) {
                        errorCode = skill === 'reading' ? 'R-A1' : 'L-A1';
                    }
                }
            }

            if (errorCode) {
                errorLogs.push({
                    task_type: type,
                    cognitive_skill: cognitiveSkill,
                    error_category: errorCategory,
                    error_code: errorCode,
                    question_number: q.question_number,
                    user_answer: q.your_answer,
                    correct_answer: q.correct_answer,
                    text_snippet: q.question_text,
                    explanation: `Hệ thống tự động phân loại: Từ được yêu cầu là '${cAns}', nhưng bạn điền '${uAns}'.`
                });
            } else {
                // Must be a cognitive gap, push to LLM queue 
                unclassifiedErrorsForLLM.push(q);
            }
        }

        // --- BACKGROUND LLM PROCESSING FOR COGNITIVE ERRORS ---
        if (unclassifiedErrorsForLLM.length > 0 && process.env.OPENAI_API_KEY) {
            try {
                const llmLogs = await runLLMTaxonomyClassification(unclassifiedErrorsForLLM, skill, studentHighlights);
                errorLogs.push(...llmLogs);
            } catch (llmError) {
                console.error("LLM Taxonomy error:", llmError);
            }
        }

        if (errorLogs.length > 0) {
            attempt.error_logs = errorLogs;
            await attempt.save();
            console.log(`Saved ${errorLogs.length} error logs for attempt ${attemptId}`);
        }

    } catch (e) {
        console.error("Error in taxonomy service:", e);
    }
}

async function runLLMTaxonomyClassification(questionsList, skill, studentHighlights = []) {
    if (questionsList.length === 0) return [];

    // Simplistic batch prompt
    const prompt = `
You are an IELTS taxonomy expert evaluating a student's INCORRECT answers for a ${skill} test.
Classify each error with the correct cognitive error code. 
Available Error Codes:
If Reading: 
- R-C1: Wrong Keyword Selection.
- R-C3: Main Idea Confusion.
- R-C4: Detail Trap (chose a distractor).
- R-C5: Scope Error (reading wrong paragraph).
If Listening:
- L-C1: Distractor Trap.
- L-C2: Missed Signpost.
- L-C3: Accent/Linking Audio misunderstanding.

Respond with a JSON object containing an "errors" array. IMPORTANT: The "explanation" field MUST be written in Vietnamese:
{
  "errors": [
    { "question_number": 1, "error_code": "R-C4", "explanation": "Giải thích ngắn gọn bằng tiếng Việt" }
  ]
}

Questions:
${questionsList.map(q =>
        `Q${q.question_number}: Text: "${q.question_text}", User Answer: "${q.your_answer}", Correct Answer: "${q.correct_answer}", Options: ${JSON.stringify(q.options)}`
    ).join("\n")}

${studentHighlights && studentHighlights.length > 0 ? `The student highlighted the following phrases in the passage:\n- ${studentHighlights.join('\n- ')}\nUse these highlights to judge if they had 'Wrong Keyword Selection' (highlighted correct info but answered wrong) or 'Scope Error' (highlighted wrong area).` : ""}
`;

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "You output strict JSON." }, { role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    // The model might return {"errors": [ ... ]} or just the array if handled differently.
    const classifiedArray = Array.isArray(parsed) ? parsed : (parsed.errors || parsed.data || Object.values(parsed)[0] || []);

    return classifiedArray.map(c => {
        const originalQ = questionsList.find(q => q.question_number === c.question_number);
        if (!originalQ) return null;
        return {
            task_type: originalQ.type,
            cognitive_skill: "Cognitive Processing",
            error_category: "Cognitive Error",
            error_code: c.error_code || (skill === 'reading' ? 'R-UNCLASSIFIED' : 'L-UNCLASSIFIED'),
            question_number: originalQ.question_number,
            user_answer: originalQ.your_answer,
            correct_answer: originalQ.correct_answer,
            student_highlights: studentHighlights,
            text_snippet: originalQ.question_text,
            explanation: c.explanation || "Được phân loại bởi AI."
        };
    }).filter(Boolean);
}
