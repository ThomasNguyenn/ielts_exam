import OpenAI from "openai";
import dotenv from "dotenv";
import { requestOpenAIJsonWithFallback } from "../utils/aiClient.js";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const hasOpenAiCredentials = Boolean(OPENAI_API_KEY);

const OPENAI_MODELS = [
  process.env.OPENAI_PRIMARY_MODEL || "gpt-4o",
  process.env.OPENAI_FALLBACK_MODEL || "gpt-4o-mini",
];

const normalizeText = (value = "") => String(value ?? "").trim();

const parseNumber = (value, fallback) => {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const clampHomeworkQuizGenerationConfig = ({
  questionCount = 4,
  optionsPerQuestion = 4,
} = {}) => ({
  questionCount: clamp(parseNumber(questionCount, 4), 1, 20),
  optionsPerQuestion: clamp(parseNumber(optionsPerQuestion, 4), 2, 6),
});

const toOptionTextList = (options = [], desiredCount = 4) => {
  const normalized = (Array.isArray(options) ? options : [])
    .map((item) => {
      if (typeof item === "string") return normalizeText(item);
      if (!item || typeof item !== "object") return "";
      return normalizeText(item.text || item.value || item.label || "");
    })
    .filter(Boolean);

  const padded = normalized.length >= desiredCount
    ? normalized.slice(0, desiredCount)
    : [
      ...normalized,
      ...Array.from({ length: desiredCount - normalized.length }, (_, index) => `Option ${normalized.length + index + 1}`),
    ];

  return padded;
};

const buildFallbackQuestions = ({ prompt, questionCount, optionsPerQuestion }) =>
  Array.from({ length: questionCount }, (_, questionIndex) => ({
    question: `Question ${questionIndex + 1}: ${prompt.slice(0, 90) || "Add question text"}`,
    options: Array.from({ length: optionsPerQuestion }, (_, optionIndex) => `Option ${optionIndex + 1}`),
  }));

const normalizeAiQuizPayload = ({ parsed, prompt, questionCount, optionsPerQuestion }) => {
  const rawQuestions = Array.isArray(parsed?.questions) ? parsed.questions : [];
  const normalizedQuestions = rawQuestions
    .map((question, questionIndex) => {
      const questionText = normalizeText(
        question?.question || question?.text || question?.prompt || question?.stem || "",
      ) || `Question ${questionIndex + 1}`;

      return {
        question: questionText,
        options: toOptionTextList(question?.options, optionsPerQuestion),
      };
    })
    .filter((question) => normalizeText(question.question));

  if (!normalizedQuestions.length) {
    return buildFallbackQuestions({ prompt, questionCount, optionsPerQuestion });
  }

  const fixedQuestionCount = normalizedQuestions.length >= questionCount
    ? normalizedQuestions.slice(0, questionCount)
    : [
      ...normalizedQuestions,
      ...buildFallbackQuestions({
        prompt,
        questionCount: questionCount - normalizedQuestions.length,
        optionsPerQuestion,
      }),
    ];

  return fixedQuestionCount.map((question) => ({
    question: normalizeText(question.question) || "Question",
    options: toOptionTextList(question.options, optionsPerQuestion),
  }));
};

export const generateHomeworkQuizBlock = async ({
  prompt,
  passageText = "",
  questionCount = 4,
  optionsPerQuestion = 4,
} = {}) => {
  const normalizedPrompt = normalizeText(prompt);
  if (!normalizedPrompt) {
    throw new Error("prompt is required");
  }

  const normalizedPassageText = normalizeText(passageText);
  const clampedConfig = clampHomeworkQuizGenerationConfig({ questionCount, optionsPerQuestion });

  const systemPrompt = `
You are an assistant that creates quiz question blocks for homework lessons.
Return strict JSON only with this exact shape:
{
  "questions": [
    {
      "question": "string",
      "options": ["string", "string"]
    }
  ]
}

Rules:
1) Return exactly ${clampedConfig.questionCount} questions.
2) Each question must contain exactly ${clampedConfig.optionsPerQuestion} options.
3) Do NOT include answer keys or explanations.
4) Keep language concise and classroom-ready.
`;

  const userPrompt = `
Teacher prompt:
${normalizedPrompt}

Passage context (optional):
${normalizedPassageText || "[No passage context provided]"}
`;

  if (!hasOpenAiCredentials) {
    return {
      questions: buildFallbackQuestions({
        prompt: normalizedPrompt,
        questionCount: clampedConfig.questionCount,
        optionsPerQuestion: clampedConfig.optionsPerQuestion,
      }),
      meta: {
        model: null,
        fallback: true,
      },
    };
  }

  const aiResult = await requestOpenAIJsonWithFallback({
    openai,
    models: OPENAI_MODELS,
    createPayload: (model) => ({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2200,
      temperature: 0.5,
      response_format: { type: "json_object" },
    }),
    timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS || 45000),
    maxAttempts: Number(process.env.OPENAI_MAX_ATTEMPTS || 3),
  });

  return {
    questions: normalizeAiQuizPayload({
      parsed: aiResult?.data || {},
      prompt: normalizedPrompt,
      questionCount: clampedConfig.questionCount,
      optionsPerQuestion: clampedConfig.optionsPerQuestion,
    }),
    meta: {
      model: aiResult?.meta?.model || aiResult?.model || null,
      fallback: false,
    },
  };
};
