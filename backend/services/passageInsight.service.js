import { GoogleGenerativeAI } from "@google/generative-ai";
import { requestGeminiJsonWithFallback } from "../utils/aiClient.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const PASSAGE_INSIGHT_MODELS = ["gemini-2.0-flash"];
const PASSAGE_REFERENCE_MAX_LENGTH = 220;

const normalizeWhitespace = (value = "") =>
  String(value || "").replace(/\s+/g, " ").trim();

const toShortReference = (rawReference = "") => {
  const normalized = normalizeWhitespace(rawReference).replace(/^["']|["']$/g, "");
  if (!normalized) return "";
  if (normalized.length <= PASSAGE_REFERENCE_MAX_LENGTH) return normalized;

  const firstSentence = normalized.match(/^(.{1,220}?[\.\!\?])(\s|$)/);
  if (firstSentence?.[1]) {
    return normalizeWhitespace(firstSentence[1]).slice(0, PASSAGE_REFERENCE_MAX_LENGTH);
  }

  return normalized.slice(0, PASSAGE_REFERENCE_MAX_LENGTH).trim();
};

const flattenQuestions = (questionGroups = []) => {
  const rows = [];
  (Array.isArray(questionGroups) ? questionGroups : []).forEach((group, groupIndex) => {
    const groupType = String(group?.type || "").trim();
    const groupInstructions = normalizeWhitespace(group?.instructions || "");
    const groupText = normalizeWhitespace(group?.text || "");
    const sharedOptions = Array.isArray(group?.options)
      ? group.options
          .map((option) => ({
            label: normalizeWhitespace(option?.id || option?.label || ""),
            text: normalizeWhitespace(option?.text || option?.id || ""),
          }))
          .filter((option) => option.text)
      : [];
    const sharedHeadings = Array.isArray(group?.headings)
      ? group.headings
          .map((heading) => ({
            label: normalizeWhitespace(heading?.id || heading?.label || ""),
            text: normalizeWhitespace(heading?.text || heading?.id || ""),
          }))
          .filter((heading) => heading.text)
      : [];

    (Array.isArray(group?.questions) ? group.questions : []).forEach((question, questionIndex) => {
      const questionOptions = Array.isArray(question?.option) && question.option.length
        ? question.option
            .map((option) => ({
              label: normalizeWhitespace(option?.label || ""),
              text: normalizeWhitespace(option?.text || ""),
            }))
            .filter((option) => option.text)
        : [];
      const isMatchingType = groupType.startsWith("matching");

      rows.push({
        group_index: groupIndex,
        question_index: questionIndex,
        q_number: Number(question?.q_number) || null,
        type: groupType,
        instructions: groupInstructions,
        group_text: groupText,
        question_text: normalizeWhitespace(question?.text || ""),
        options: questionOptions.length
          ? questionOptions
          : isMatchingType
            ? sharedHeadings
            : sharedOptions,
        headings: sharedHeadings,
        correct_answers: Array.isArray(question?.correct_answers)
          ? question.correct_answers.map((answer) => normalizeWhitespace(answer)).filter(Boolean)
          : [],
        existing_explanation: normalizeWhitespace(question?.explanation || ""),
        existing_passage_reference: normalizeWhitespace(question?.passage_reference || ""),
      });
    });
  });
  return rows;
};

const buildPrompt = ({
  title,
  source,
  passageContent,
  questionRows,
}) => `
You are an IELTS teacher assistant.

Task:
Generate "explanation" and "passage_reference" for each question from one IELTS Reading passage.

Output requirements:
1) explanation:
- Vietnamese language.
- Clear and concise.
- MUST include at least one short English quote from the passage when citing evidence. Keep the quote in original English and wrap quote with double quotes.
- Do not translate the quoted evidence.
- Must be consistent with correct_answers when provided.

2) passage_reference:
- English only.
- Very concise evidence phrase/sentence used to identify the answer.
- DO NOT return whole paragraph.
- Maximum 20 words whenever possible.

3) Keep exact group_index and question_index from input.
4) If evidence is unclear, return empty strings for both fields.
5) Return strict JSON only.
6) For matching types, prioritize heading IDs/text and correct_answers as grading truth.

Context:
- Passage title: ${JSON.stringify(title || "")}
- Source: ${JSON.stringify(source || "")}
- Passage content:
${JSON.stringify(passageContent || "")}

Questions:
${JSON.stringify(questionRows, null, 2)}

Return JSON with this exact shape:
{
  "questions": [
    {
      "group_index": 0,
      "question_index": 0,
      "explanation": "string",
      "passage_reference": "string"
    }
  ]
}
`;

export const generatePassageQuestionInsights = async ({
  title = "",
  source = "",
  content = "",
  question_groups = [],
  overwrite_existing = false,
}) => {
  if (!genAI) {
    const error = new Error("Gemini API key is not configured");
    error.statusCode = 503;
    throw error;
  }

  const normalizedContent = normalizeWhitespace(content);
  if (!normalizedContent) {
    const error = new Error("Passage content is required");
    error.statusCode = 400;
    throw error;
  }

  const flatQuestions = flattenQuestions(question_groups);
  const targetQuestions = flatQuestions.filter((question) => {
    if (overwrite_existing) return true;
    return !question.existing_explanation || !question.existing_passage_reference;
  });

  if (!targetQuestions.length) {
    return { model: "gemini-2.0-flash", questions: [] };
  }

  const prompt = buildPrompt({
    title: normalizeWhitespace(title),
    source: normalizeWhitespace(source),
    passageContent: normalizedContent,
    questionRows: targetQuestions,
  });

  const aiResponse = await requestGeminiJsonWithFallback({
    genAI,
    models: PASSAGE_INSIGHT_MODELS,
    contents: [prompt],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 45000),
    maxAttempts: Number(process.env.GEMINI_MAX_ATTEMPTS || 2),
  });

  const rawRows = Array.isArray(aiResponse?.data?.questions) ? aiResponse.data.questions : [];
  const allowedKeys = new Set(targetQuestions.map((row) => `${row.group_index}:${row.question_index}`));
  const normalizedRows = rawRows
    .map((row) => {
      const groupIndex = Number(row?.group_index);
      const questionIndex = Number(row?.question_index);
      if (!Number.isInteger(groupIndex) || !Number.isInteger(questionIndex)) return null;

      const key = `${groupIndex}:${questionIndex}`;
      if (!allowedKeys.has(key)) return null;

      return {
        group_index: groupIndex,
        question_index: questionIndex,
        explanation: normalizeWhitespace(row?.explanation || ""),
        passage_reference: toShortReference(row?.passage_reference || ""),
      };
    })
    .filter(Boolean);

  return {
    model: aiResponse.model || "gemini-2.0-flash",
    questions: normalizedRows,
  };
};
