import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Speaking from "../models/Speaking.model.js";
import SpeakingSession from "../models/SpeakingSession.js";
import cloudinary from "../utils/cloudinary.js";
import { requestGeminiJsonWithFallback } from "../utils/aiClient.js";
import { createTaxonomyErrorLog } from "./taxonomy.registry.js";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

const normalizeGeminiModel = (modelName, fallbackModel) => {
  const normalized = String(modelName || "").trim();
  if (!normalized) return fallbackModel;

  // Legacy 1.5 models are not available on current generateContent endpoint.
  if (normalized === "gemini-1.5-flash") {
    return "gemini-2.0-flash";
  }

  return normalized;
};

const primaryModel = normalizeGeminiModel(
  process.env.GEMINI_PRIMARY_MODEL,
  "gemini-2.5-flash",
);
const fallbackModel = normalizeGeminiModel(
  process.env.GEMINI_FALLBACK_MODEL,
  "gemini-2.0-flash",
);
const GEMINI_MODELS = [primaryModel, fallbackModel].filter(
  (model, index, list) => Boolean(model) && list.indexOf(model) === index,
);
const SPEAKING_GEMINI_TIMEOUT_MS = Number(
  process.env.SPEAKING_GEMINI_TIMEOUT_MS || process.env.GEMINI_TIMEOUT_MS || 30000,
);
const SPEAKING_GEMINI_MAX_ATTEMPTS = Number(
  process.env.SPEAKING_GEMINI_MAX_ATTEMPTS || process.env.GEMINI_MAX_ATTEMPTS || 2,
);
const SPEAKING_ANALYSIS_MAX_OUTPUT_TOKENS = Number(
  process.env.SPEAKING_ANALYSIS_MAX_OUTPUT_TOKENS || 1200,
);
const SPEAKING_MOCK_MAX_OUTPUT_TOKENS = Number(
  process.env.SPEAKING_MOCK_MAX_OUTPUT_TOKENS || 220,
);

const isHttpUrl = (value) => /^https?:\/\//i.test(String(value || ""));

const isSupportedAudioMime = (mimeType) =>
  /^audio\/(webm|wav|x-wav|mpeg|mp3|ogg|mp4)$/i.test(String(mimeType || ""));

const normalizeGeminiAudioMimeType = (preferredMimeType, fetchedContentType) => {
  const preferred = String(preferredMimeType || "").split(";")[0].trim();
  const fetched = String(fetchedContentType || "").split(";")[0].trim();

  if (isSupportedAudioMime(preferred)) {
    return preferred;
  }

  if (isSupportedAudioMime(fetched)) {
    return fetched;
  }

  return "audio/webm";
};

const toAudioPart = async (audioSource, mimeType) => {
  let fileBuffer;
  let fetchedContentType = "";

  if (isHttpUrl(audioSource)) {
    const response = await fetch(audioSource);
    if (!response.ok) {
      throw new Error(`Unable to fetch remote audio: ${response.status}`);
    }

    fetchedContentType = response.headers.get("content-type") || "";

    const arrayBuffer = await response.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
  } else {
    fileBuffer = await fs.promises.readFile(audioSource);
  }

  const resolvedMimeType = normalizeGeminiAudioMimeType(mimeType, fetchedContentType);

  return {
    inlineData: {
      data: fileBuffer.toString("base64"),
      mimeType: resolvedMimeType,
    },
  };
};

const normalizeSpeakingPart = (value) => {
  const parsed = Number(value);
  if ([1, 2, 3].includes(parsed)) return parsed;
  return 0;
};

const formatSubQuestionLines = (subQuestions = []) => {
  const lines = (Array.isArray(subQuestions) ? subQuestions : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .map((item) => `- ${item}`);
  return lines.length ? lines.join("\n") : "- None";
};

const buildSampleAnswerRequirements = ({ topicPart = 0, subQuestions = [] } = {}) => {
  const part = normalizeSpeakingPart(topicPart);
  if (part === 1) {
    return [
      "- sample_answer must be for IELTS Speaking Part 1.",
      "- Length: 3-5 short spoken sentences (around 45-70 words).",
      "- Style: natural and personal; direct answer + one reason + one quick example.",
      "- Do not sound like an essay or use overly formal transitions.",
    ].join("\n");
  }

  if (part === 2) {
    return [
      "- sample_answer must be for IELTS Speaking Part 2 cue-card monologue.",
      "- Length: around 120-170 words, one coherent monologue.",
      "- Structure: short opening, 2-3 developed details, brief closing reflection.",
      "- Cover all cue points when relevant:",
      formatSubQuestionLines(subQuestions),
      "- Keep spoken rhythm markers (e.g., 'Well', 'I remember', 'What stood out was').",
    ].join("\n");
  }

  if (part === 3) {
    return [
      "- sample_answer must be for IELTS Speaking Part 3 discussion.",
      "- Length: 4-6 analytical spoken sentences (around 90-130 words).",
      "- Include comparison/trade-off, cause-effect, and a concrete example.",
      "- End with a clear position/conclusion sentence.",
      "- Tone should be mature and academic but still conversational.",
    ].join("\n");
  }

  return [
    "- sample_answer should match IELTS Speaking style for the detected question type.",
    "- Keep answer natural spoken English, not essay writing.",
  ].join("\n");
};

const buildPartAwareFallbackSampleAnswer = ({ topicPart = 0, topicPrompt = "" } = {}) => {
  const part = normalizeSpeakingPart(topicPart);
  const prompt = String(topicPrompt || "").trim();

  if (part === 1) {
    return `I usually enjoy this topic because it is part of my daily life. For me, it is both practical and interesting. A simple example is that I often do it with my friends on weekends, so it feels natural and enjoyable.`;
  }

  if (part === 2) {
    return `I would like to talk about ${prompt || "a memorable experience"}. I first got involved in it a few years ago, and it left a strong impression on me. What I remember most is how it changed my routine and made me more confident. It also taught me to be more patient and organized. Overall, it was an important experience that I still think about today.`;
  }

  if (part === 3) {
    return `In my opinion, this issue has both benefits and drawbacks. On the one hand, it can improve people's quality of life and create more opportunities. On the other hand, if it is not managed well, it may lead to long-term social problems. For example, many communities experience both convenience and pressure at the same time. So I believe balanced policies are essential.`;
  }

  return "A model answer is temporarily unavailable.";
};

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const roundHalf = (value) => Math.round(safeNumber(value, 0) * 2) / 2;

const normalizeHeatmapStatus = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["excellent", "needs_work", "error", "neutral"].includes(normalized)) {
    return normalized;
  }
  return "neutral";
};

const normalizeFocusPriority = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["high", "medium", "low"].includes(normalized)) return normalized;
  return "medium";
};

const splitTranscriptWords = (transcript = "") =>
  (String(transcript || "").match(/[A-Za-z0-9']+/g) || [])
    .map((word) => String(word || "").trim())
    .filter(Boolean);

const extractWordsFromSnippet = (snippet = "") =>
  splitTranscriptWords(snippet)
    .map((word) => word.toLowerCase())
    .filter((word) => word.length >= 3);

const buildHeatmapFromTranscript = (transcript = "", errorLogs = []) => {
  const words = splitTranscriptWords(transcript).slice(0, 140);
  if (words.length === 0) return [];

  const statusMap = new Map();
  (Array.isArray(errorLogs) ? errorLogs : []).forEach((log) => {
    const code = String(log?.code || log?.error_code || "").trim().toUpperCase();
    if (!code) return;

    const status = code.startsWith("S-P")
      ? "error"
      : (code.startsWith("S-F") ? "needs_work" : "neutral");
    extractWordsFromSnippet(log?.snippet || log?.text_snippet || "").forEach((word) => {
      const existing = statusMap.get(word);
      if (existing === "error") return;
      if (existing === "needs_work" && status === "neutral") return;
      statusMap.set(word, status);
    });
  });

  return words.map((word) => ({
    word,
    status: statusMap.get(word.toLowerCase()) || "neutral",
    note: "",
  }));
};

const normalizeHeatmapEntries = (value = []) =>
  (Array.isArray(value) ? value : [])
    .map((item) => ({
      word: String(item?.word || "").trim(),
      status: normalizeHeatmapStatus(item?.status),
      note: String(item?.note || "").trim(),
    }))
    .filter((item) => item.word)
    .slice(0, 180);

const focusTitleByCode = {
  "S-P1": "Word Stress",
  "S-P2": "Sentence Stress",
  "S-P3": "Sound Substitution",
  "S-P4": "Intonation Control",
};

const buildFocusAreasFromErrorLogs = (errorLogs = []) => {
  const fallbackFocus = [];
  (Array.isArray(errorLogs) ? errorLogs : [])
    .filter((log) => String(log?.code || log?.error_code || "").trim().toUpperCase().startsWith("S-P"))
    .forEach((log) => {
      const code = String(log?.code || log?.error_code || "").trim().toUpperCase();
      const title = focusTitleByCode[code] || "Pronunciation Focus";
      const description = String(log?.explanation || "").trim();
      fallbackFocus.push({
        title,
        priority: code === "S-P3" || code === "S-P4" ? "high" : "medium",
        description: description || "Review this pronunciation pattern and practice with short shadowing drills.",
      });
    });

  const unique = [];
  const seen = new Set();
  fallbackFocus.forEach((item) => {
    const key = `${item.title}::${item.priority}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(item);
  });

  return unique.slice(0, 4);
};

const normalizeFocusAreas = (value = []) =>
  (Array.isArray(value) ? value : [])
    .map((item) => ({
      title: String(item?.title || "").trim(),
      priority: normalizeFocusPriority(item?.priority),
      description: String(item?.description || "").trim(),
    }))
    .filter((item) => item.title || item.description)
    .slice(0, 6);

const normalizeVocabularyUpgrades = (value = []) =>
  (Array.isArray(value) ? value : [])
    .map((item) => ({
      original: String(item?.original || "").trim(),
      suggestion: String(item?.suggestion || "").trim(),
      reason: String(item?.reason || "").trim(),
    }))
    .filter((item) => item.original || item.suggestion)
    .slice(0, 8);

const normalizeGrammarCorrections = (value = []) =>
  (Array.isArray(value) ? value : [])
    .map((item) => ({
      original: String(item?.original || "").trim(),
      corrected: String(item?.corrected || "").trim(),
      reason: String(item?.reason || "").trim(),
    }))
    .filter((item) => item.original || item.corrected)
    .slice(0, 8);

const buildLexicalUpgradesFromErrorLogs = (errorLogs = []) =>
  (Array.isArray(errorLogs) ? errorLogs : [])
    .filter((log) => String(log?.code || log?.error_code || "").trim().toUpperCase().startsWith("S-L"))
    .map((log) => ({
      original: String(log?.snippet || log?.text_snippet || "").trim(),
      suggestion: "Use a more precise academic phrase.",
      reason: String(log?.explanation || "").trim(),
    }))
    .filter((item) => item.original)
    .slice(0, 6);

const buildGrammarFixesFromErrorLogs = (errorLogs = []) =>
  (Array.isArray(errorLogs) ? errorLogs : [])
    .filter((log) => String(log?.code || log?.error_code || "").trim().toUpperCase().startsWith("S-G"))
    .map((log) => ({
      original: String(log?.snippet || log?.text_snippet || "").trim(),
      corrected: "Use the corrected grammar structure for this phrase.",
      reason: String(log?.explanation || "").trim(),
    }))
    .filter((item) => item.original)
    .slice(0, 6);

const derivePitchVariationLabel = (pronunciationScore, pauseCount) => {
  if (pronunciationScore >= 7 && pauseCount <= 8) return "Good";
  if (pronunciationScore >= 6) return "Acceptable";
  return "Needs Work";
};

const normalizeAnalysisPayload = (rawAnalysis, {
  topicPart = 0,
  topicPrompt = "",
  transcriptFallback = "",
  fallbackWpm = 0,
  pauseCount = 0,
} = {}) => {
  const source = rawAnalysis && typeof rawAnalysis === "object" ? rawAnalysis : {};
  const errorLogs = Array.isArray(source.error_logs) ? source.error_logs : [];
  const transcript = String(source.transcript || transcriptFallback || "").trim();

  const fluencyScore = roundHalf(clamp(safeNumber(source?.fluency_coherence?.score, 0), 0, 9));
  const lexicalScore = roundHalf(clamp(safeNumber(source?.lexical_resource?.score, 0), 0, 9));
  const grammarScore = roundHalf(clamp(safeNumber(source?.grammatical_range?.score, 0), 0, 9));
  const pronunciationScore = roundHalf(clamp(safeNumber(source?.pronunciation?.score, 0), 0, 9));

  const explicitBand = safeNumber(source.band_score, NaN);
  const computedBand = roundHalf((fluencyScore + lexicalScore + grammarScore + pronunciationScore) / 4);
  const bandScore = Number.isFinite(explicitBand)
    ? roundHalf(clamp(explicitBand, 0, 9))
    : computedBand;

  const modelHeatmap = normalizeHeatmapEntries(source.pronunciation_heatmap);
  const fallbackHeatmap = buildHeatmapFromTranscript(transcript, errorLogs);
  const heatmap = modelHeatmap.length > 0 ? modelHeatmap : fallbackHeatmap;

  const modelFocus = normalizeFocusAreas(source.focus_areas);
  const fallbackFocus = buildFocusAreasFromErrorLogs(errorLogs);
  const focusAreas = modelFocus.length > 0 ? modelFocus : fallbackFocus;

  const modelVocab = normalizeVocabularyUpgrades(source.vocabulary_upgrades);
  const fallbackVocab = buildLexicalUpgradesFromErrorLogs(errorLogs);
  const vocabularyUpgrades = modelVocab.length > 0 ? modelVocab : fallbackVocab;

  const modelGrammar = normalizeGrammarCorrections(source.grammar_corrections);
  const fallbackGrammar = buildGrammarFixesFromErrorLogs(errorLogs);
  const grammarCorrections = modelGrammar.length > 0 ? modelGrammar : fallbackGrammar;

  const normalizedPace = Math.round(Math.max(0, safeNumber(source?.intonation_pacing?.pace_wpm, fallbackWpm)));
  const normalizedPauseCount = Math.max(0, safeNumber(pauseCount, 0));
  const pitchVariation = String(
    source?.intonation_pacing?.pitch_variation || derivePitchVariationLabel(pronunciationScore, normalizedPauseCount),
  ).trim();
  const intonationFeedback = String(source?.intonation_pacing?.feedback || "").trim();

  const nextStepFallback = focusAreas[0]?.description
    || "Practice this topic one more time with slower pacing and clearer stress.";
  const nextStep = String(source.next_step || nextStepFallback).trim();

  return {
    ...source,
    transcript,
    band_score: bandScore,
    fluency_coherence: {
      score: fluencyScore,
      feedback: String(source?.fluency_coherence?.feedback || "No fluency feedback.").trim(),
    },
    lexical_resource: {
      score: lexicalScore,
      feedback: String(source?.lexical_resource?.feedback || "No lexical feedback.").trim(),
    },
    grammatical_range: {
      score: grammarScore,
      feedback: String(source?.grammatical_range?.feedback || "No grammar feedback.").trim(),
    },
    pronunciation: {
      score: pronunciationScore,
      feedback: String(source?.pronunciation?.feedback || "No pronunciation feedback.").trim(),
    },
    general_feedback: String(source.general_feedback || "No overall feedback.").trim(),
    sample_answer: String(
      source.sample_answer || buildPartAwareFallbackSampleAnswer({ topicPart, topicPrompt }),
    ).trim(),
    pronunciation_heatmap: heatmap,
    focus_areas: focusAreas,
    intonation_pacing: {
      pace_wpm: normalizedPace,
      pitch_variation: pitchVariation || "Needs Work",
      feedback: intonationFeedback,
    },
    vocabulary_upgrades: vocabularyUpgrades,
    grammar_corrections: grammarCorrections,
    next_step: nextStep,
    error_logs: errorLogs,
  };
};

const buildFallbackAnalysis = (
  clientTranscript,
  {
    topicPart = 0,
    topicPrompt = "",
    fallbackWpm = 0,
    pauseCount = 0,
  } = {},
) => normalizeAnalysisPayload({
  transcript: clientTranscript || "Transcript unavailable",
  band_score: 0,
  fluency_coherence: { score: 0, feedback: "AI scoring temporarily unavailable." },
  lexical_resource: { score: 0, feedback: "AI scoring temporarily unavailable." },
  grammatical_range: { score: 0, feedback: "AI scoring temporarily unavailable." },
  pronunciation: { score: 0, feedback: "AI scoring temporarily unavailable." },
  general_feedback: "He thong tam thoi khong cham duoc bai noi. Bai nop van da duoc luu.",
  sample_answer: buildPartAwareFallbackSampleAnswer({ topicPart, topicPrompt }),
  pronunciation_heatmap: [],
  focus_areas: [],
  intonation_pacing: {
    pace_wpm: Math.round(Math.max(0, safeNumber(fallbackWpm, 0))),
    pitch_variation: "Needs Work",
    feedback: "Not enough data for intonation analysis.",
  },
  vocabulary_upgrades: [],
  grammar_corrections: [],
  next_step: "Try re-recording with clearer pronunciation and better pacing.",
  error_logs: [],
}, {
  topicPart,
  topicPrompt,
  transcriptFallback: clientTranscript,
  fallbackWpm,
  pauseCount,
});

const hasUsableAnalysisPayload = (analysis) => (
  Boolean(analysis) && typeof analysis === "object" && Object.keys(analysis).length > 0
);

const cleanupSessionAudioFromCloudinary = async (session) => {
  const publicId = String(session?.audioPublicId || "").trim();
  if (!publicId) return;

  try {
    const destroyResult = await cloudinary.uploader.destroy(publicId, {
      resource_type: "video",
      invalidate: true,
    });

    const result = String(destroyResult?.result || "").toLowerCase();
    if (result === "ok" || result === "not found") {
      session.audioDeletedAt = new Date();
      session.audioPublicId = null;
      await session.save();
      return;
    }

    console.warn("Cloudinary audio cleanup returned unexpected result:", {
      publicId,
      result: destroyResult?.result,
    });
  } catch (cleanupError) {
    console.warn("Cloudinary audio cleanup failed:", {
      publicId,
      error: cleanupError.message,
    });
  }
};

const buildStrictSpeakingPrompt = ({
  topicPrompt,
  topicPart,
  subQuestions,
  clientWPM,
  parsedMetrics,
  clientTranscript,
}) => `
You are both:
1) A STRICT IELTS Speaking examiner (official IELTS descriptors), and
2) An ELSA-style pronunciation coach (segmentals + suprasegmentals).

TOPIC / QUESTION:
"${topicPrompt}"

EXAM PART:
- Part: ${normalizeSpeakingPart(topicPart) || "unknown"}
- Cue points / follow-up prompts:
${formatSubQuestionLines(subQuestions)}

SYSTEM METRICS:
- WPM: ${clientWPM}
- Pause count: ${parsedMetrics.pauseCount || 0}
- Total pause duration (ms): ${parsedMetrics.totalPauseDuration || 0}
- Longest pause (ms): ${parsedMetrics.longestPause || 0}
- Avg pause duration (ms): ${parsedMetrics.avgPauseDuration || 0}
- Client transcript: "${clientTranscript || "(none)"}"

CRITICAL RULES (STRICT SCORING):
- You MUST listen to the audio first. Transcript is secondary.
- If transcript conflicts with audio, trust the audio.
- Score exactly 4 IELTS criteria:
  Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation.
- Each criterion score must be 0.0 to 9.0 in 0.5 steps only.
- Overall band_score must be the average of 4 criteria, rounded to nearest 0.5.
- Do NOT be lenient. Do NOT inflate scores.
- If pronunciation causes frequent misunderstanding, pronunciation <= 5.5.
- If fluency has frequent long pauses and broken delivery, fluency_coherence <= 6.0.
- If grammar errors are frequent and reduce clarity, grammatical_range <= 5.5.
- If ideas are underdeveloped with short/simple answers, fluency_coherence <= 5.5.
- Do not award band >= 7.0 unless performance is consistently strong across all 4 criteria.

PRONUNCIATION MUST FOLLOW ELSA-STYLE ANALYSIS:
- Segmentals: vowel/consonant substitutions and unclear phonemes.
- Final endings: specifically check missing -s / -es / -ed / final consonants.
- Word stress errors.
- Sentence stress and thought-grouping.
- Intonation and rhythm (flat/unnatural patterns).
- Connected speech (linking/reduction) issues.

ERROR TAXONOMY BẮT BUỘC (error_logs array):
Trích xuất lỗi rõ ràng từ transcript và gán đúng mã "code":
[Fluency] S-F1 Excessive Pause, S-F2 Filler Overuse, S-F3 Self-correction Overuse, S-F4 Disorganized Idea
[Lexical] S-L1 Repetition, S-L2 Incorrect Word Form, S-L3 Limited Vocabulary, S-L4 Misused Collocation
[Grammar] S-G1 Tense Error, S-G2 Agreement Error, S-G3 Simple Sentence Overuse, S-G4 Structure Breakdown
[Pronunciation] S-P1 Word Stress Error, S-P2 Sentence Stress Error, S-P3 Sound Substitution, S-P4 Intonation Flat
Cần chỉ ra ít nhất 3-5 lỗi cụ thể nhất lưu vào "error_logs".

OUTPUT LANGUAGE:
- Feedback in Vietnamese.
- Keep examples concrete from the student's production.
- sample_answer must be in natural spoken English.

MODEL ANSWER REQUIREMENTS (MUST FOLLOW PART):
${buildSampleAnswerRequirements({ topicPart, subQuestions })}

RETURN ONLY VALID JSON (no markdown, no extra text):
{
  "transcript": "string (best ASR transcript from audio)",
  "band_score": number,
  "fluency_coherence": { "score": number, "feedback": "string" },
  "lexical_resource": { "score": number, "feedback": "string" },
  "grammatical_range": { "score": number, "feedback": "string" },
  "pronunciation": {
    "score": number,
    "feedback": "string with these sections: Am nguyen am, Am cuoi, Trong am, Ngu dieu, Nhip dieu, Ke hoach hanh dong"
  },
  "error_logs": [
    {
      "code": "string (e.g. S-F1, S-L2, S-G3, S-P4)",
      "snippet": "string (extract from transcript)",
      "explanation": "string (Vietnamese explanation)"
    }
  ],
  "general_feedback": "string (strict overall summary with top priority fixes)",
  "sample_answer": "string (Band 7.0+ model answer for this topic)",
  "pronunciation_heatmap": [
    {
      "word": "string (word from transcript)",
      "status": "excellent | needs_work | error | neutral",
      "note": "string (short reason)"
    }
  ],
  "focus_areas": [
    {
      "title": "string",
      "priority": "high | medium | low",
      "description": "string"
    }
  ],
  "intonation_pacing": {
    "pace_wpm": number,
    "pitch_variation": "string",
    "feedback": "string"
  },
  "vocabulary_upgrades": [
    {
      "original": "string",
      "suggestion": "string",
      "reason": "string"
    }
  ],
  "grammar_corrections": [
    {
      "original": "string",
      "corrected": "string",
      "reason": "string"
    }
  ],
  "next_step": "string"
}
`;

const MAX_MOCK_EXAMINER_TURNS = Number(process.env.SPEAKING_MOCK_MAX_TURNS || 6);

const normalizeMockTurnsForPrompt = (turns = []) =>
  (Array.isArray(turns) ? turns : [])
    .filter((turn) => ["examiner", "candidate"].includes(String(turn?.role || "")))
    .map((turn) => ({
      role: String(turn.role).toLowerCase(),
      message: String(turn.message || "").trim(),
    }))
    .filter((turn) => turn.message)
    .slice(-12);

const buildMockExaminerPrompt = ({
  topicPrompt,
  topicPart,
  subQuestions,
  transcript,
  turns,
  latestAnswer,
}) => `
You are simulating a real IELTS Speaking examiner in conversational mode.
This is mainly for Part 3 pressure handling.

TOPIC:
"${topicPrompt}"

PART:
${topicPart}

REFERENCE SUB-QUESTIONS:
${(subQuestions || []).map((q) => `- ${q}`).join("\n") || "- None"}

INITIAL CANDIDATE ANSWER TRANSCRIPT:
"${transcript || "(none)"}"

CHAT HISTORY:
${turns.map((turn, index) => `${index + 1}. ${turn.role.toUpperCase()}: ${turn.message}`).join("\n") || "(empty)"}

LATEST CANDIDATE ANSWER:
"${latestAnswer || "(start interview)"}"

RULES:
- Ask ONE follow-up question at a time.
- Question must connect to the candidate's previous answer.
- Keep examiner tone direct and slightly challenging, like real Part 3.
- Use abstract reasoning style (cause, comparison, long-term impact, policy, trade-off).
- Follow-up question max 24 words.
- Give one short pressure coaching line in Vietnamese.
- End when the interview already reached enough depth or examiner turns >= ${MAX_MOCK_EXAMINER_TURNS}.

Return ONLY valid JSON:
{
  "next_question": "string",
  "pressure_feedback": "string (Vietnamese, 1 sentence)",
  "should_end": boolean,
  "final_assessment": "string (Vietnamese, 2-4 sentences, only meaningful when should_end=true)"
}
`;

const buildMockExaminerFallback = ({ topicPrompt, turns }) => {
  const examinerTurns = (turns || []).filter((turn) => turn.role === "examiner").length;
  const shouldEnd = examinerTurns >= MAX_MOCK_EXAMINER_TURNS;

  if (shouldEnd) {
    return {
      nextQuestion: "",
      pressureFeedback: "Giữ bình tĩnh, trả lời theo cấu trúc: ý chính -> lý do -> ví dụ.",
      shouldEnd: true,
      finalAssessment:
        "Bạn đã hoàn thành phần mô phỏng hội thoại. Hãy cải thiện chiều sâu lập luận bằng cách nêu nguyên nhân, hệ quả, và ví dụ cụ thể trong mỗi câu trả lời.",
      aiSource: "fallback",
    };
  }

  return {
    nextQuestion: `How would you justify your view if someone strongly disagreed with you about ${topicPrompt}?`,
    pressureFeedback: "Câu trả lời nên rõ quan điểm, có so sánh và ví dụ ngắn để tăng tính thuyết phục.",
    shouldEnd: false,
    finalAssessment: "",
    aiSource: "fallback",
  };
};

export const generateMockExaminerFollowUp = async ({
  topicPrompt,
  topicPart = 3,
  subQuestions = [],
  transcript = "",
  turns = [],
  latestAnswer = "",
} = {}) => {
  const normalizedTurns = normalizeMockTurnsForPrompt(turns);
  const examinerTurnCount = normalizedTurns.filter((turn) => turn.role === "examiner").length;
  if (examinerTurnCount >= MAX_MOCK_EXAMINER_TURNS) {
    return buildMockExaminerFallback({ topicPrompt, turns: normalizedTurns });
  }

  const prompt = buildMockExaminerPrompt({
    topicPrompt,
    topicPart,
    subQuestions,
    transcript,
    turns: normalizedTurns,
    latestAnswer,
  });

  try {
    if (!genAI) {
      throw new Error("Gemini API key is not configured");
    }

    const aiResponse = await requestGeminiJsonWithFallback({
      genAI,
      models: GEMINI_MODELS,
      contents: [prompt],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: SPEAKING_MOCK_MAX_OUTPUT_TOKENS,
      },
      timeoutMs: SPEAKING_GEMINI_TIMEOUT_MS,
      maxAttempts: SPEAKING_GEMINI_MAX_ATTEMPTS,
    });

    const payload = aiResponse.data || {};
    const shouldEnd = Boolean(payload.should_end);
    const nextQuestion = String(payload.next_question || "").trim();
    const pressureFeedback = String(payload.pressure_feedback || "").trim();
    const finalAssessment = String(payload.final_assessment || "").trim();

    if (!shouldEnd && !nextQuestion) {
      throw new Error("Mock examiner returned empty follow-up question");
    }

    return {
      nextQuestion,
      pressureFeedback,
      shouldEnd,
      finalAssessment,
      aiSource: aiResponse.model,
    };
  } catch (error) {
    console.warn("Mock examiner fallback triggered:", error.message);
    return buildMockExaminerFallback({ topicPrompt, turns: normalizedTurns });
  }
};

export const scoreSpeakingSessionById = async ({ sessionId, force = false } = {}) => {
  const session = await SpeakingSession.findById(sessionId);
  if (!session) {
    const error = new Error("Speaking session not found");
    error.statusCode = 404;
    throw error;
  }

  if (session.status === "completed" && session.analysis?.band_score !== undefined && !force) {
    return {
      session,
      aiSource: session.ai_source || "cached",
      analysis: session.analysis,
      skipped: true,
    };
  }

  const topic = await Speaking.findById(session.questionId);
  if (!topic) {
    const error = new Error("Speaking topic not found");
    error.statusCode = 404;
    throw error;
  }

  const clientTranscript = String(session.transcript || "").trim();
  const clientWPM = Number(session?.metrics?.wpm || 0);
  const parsedMetrics = session?.metrics?.pauses || {};
  const prompt = buildStrictSpeakingPrompt({
    topicPrompt: topic.prompt,
    topicPart: topic.part,
    subQuestions: topic.sub_questions || [],
    clientWPM,
    parsedMetrics,
    clientTranscript,
  });

  let analysis;
  let aiSource = "fallback";
  let usedMimeType = session.audioMimeType || "audio/webm";
  let audioBytes = 0;

  try {
    if (!genAI) {
      throw new Error("Gemini API key is not configured");
    }
    const audioPart = await toAudioPart(
      session.audioUrl,
      session.audioMimeType || "audio/webm",
    );
    usedMimeType = audioPart.inlineData.mimeType;
    audioBytes = Buffer.byteLength(audioPart.inlineData.data || "", "base64");
    const aiResponse = await requestGeminiJsonWithFallback({
      genAI,
      models: GEMINI_MODELS,
      contents: [prompt, audioPart],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: SPEAKING_ANALYSIS_MAX_OUTPUT_TOKENS,
      },
      timeoutMs: SPEAKING_GEMINI_TIMEOUT_MS,
      maxAttempts: SPEAKING_GEMINI_MAX_ATTEMPTS,
    });
    analysis = normalizeAnalysisPayload(aiResponse.data, {
      topicPart: topic.part,
      topicPrompt: topic.prompt,
      transcriptFallback: clientTranscript,
      fallbackWpm: clientWPM,
      pauseCount: parsedMetrics.pauseCount || 0,
    });
    aiSource = aiResponse.model;
  } catch (aiError) {
    console.error("Speaking AI fallback triggered:", {
      error: aiError.message,
      models: GEMINI_MODELS,
      mimeType: usedMimeType,
      audioBytes,
    });
    if (hasUsableAnalysisPayload(session?.provisional_analysis)) {
      analysis = normalizeAnalysisPayload(session.provisional_analysis, {
        topicPart: topic.part,
        topicPrompt: topic.prompt,
        transcriptFallback: clientTranscript,
        fallbackWpm: clientWPM,
        pauseCount: parsedMetrics.pauseCount || 0,
      });
      aiSource = session?.provisional_source
        ? `provisional:${session.provisional_source}`
        : "provisional_fallback";
    } else {
      analysis = buildFallbackAnalysis(clientTranscript, {
        topicPart: topic.part,
        topicPrompt: topic.prompt,
        fallbackWpm: clientWPM,
        pauseCount: parsedMetrics.pauseCount || 0,
      });
    }
  }

  // Keep the canonical session transcript if it already exists (typically from STT),
  // and only fall back to model-returned transcript when no transcript is available.
  const modelTranscript = String(analysis?.transcript || "").trim();
  session.transcript = clientTranscript || modelTranscript || "";
  session.analysis = analysis;

  // Extract Error Taxonomy Logs
  if (Array.isArray(analysis.error_logs) && analysis.error_logs.length > 0) {
    const taskType = topic.part ? `part${topic.part}` : "speaking";
    const speakingFallbackByPrefix = {
      "S-F": {
        cognitiveSkill: "S-FC. Fluency & Coherence",
        errorCategory: "Fluency & Coherence",
        taxonomyDimension: "fluency_coherence",
      },
      "S-L": {
        cognitiveSkill: "S-LR. Lexical Resource",
        errorCategory: "Lexical Resource",
        taxonomyDimension: "lexical",
      },
      "S-G": {
        cognitiveSkill: "S-GRA. Grammatical Range & Accuracy",
        errorCategory: "Grammar",
        taxonomyDimension: "grammar",
      },
      "S-P": {
        cognitiveSkill: "S-PR. Pronunciation",
        errorCategory: "Pronunciation",
        taxonomyDimension: "pronunciation",
      },
    };

    session.error_logs = analysis.error_logs
      .map((log) => {
        const sourceCode = String(log?.code || log?.error_code || "").trim().toUpperCase();
        const normalizedLog = createTaxonomyErrorLog({
          skillDomain: "speaking",
          taskType,
          questionType: taskType,
          errorCode: sourceCode || "S-UNCLASSIFIED",
          textSnippet: String(log?.snippet || log?.text_snippet || ""),
          explanation: String(log?.explanation || ""),
          detectionMethod: "llm",
          confidence: log?.confidence,
          secondaryErrorCodes: log?.secondary_error_codes,
        });

        if (normalizedLog.error_code === "S-UNCLASSIFIED") {
          const fallback =
            speakingFallbackByPrefix[sourceCode.slice(0, 3)] || null;
          normalizedLog.cognitive_skill = fallback?.cognitiveSkill || normalizedLog.cognitive_skill;
          normalizedLog.error_category = fallback?.errorCategory || normalizedLog.error_category;
          normalizedLog.taxonomy_dimension = fallback?.taxonomyDimension || normalizedLog.taxonomy_dimension;
        }

        return normalizedLog;
      })
      .filter(Boolean);
  }

  session.status = "completed";
  session.scoring_state = "completed";
  session.ai_source = aiSource;
  await session.save();

  const submitTs = new Date(session.timestamp || session.createdAt || Date.now()).getTime();
  const submitToFinalMs = Number.isFinite(submitTs) ? Math.max(0, Date.now() - submitTs) : null;
  const provisionalBand = Number(session?.provisional_analysis?.band_score);
  const finalBand = Number(analysis?.band_score);
  const bandDiff = Number.isFinite(provisionalBand) && Number.isFinite(finalBand)
    ? Math.abs(finalBand - provisionalBand)
    : null;
  console.log(JSON.stringify({
    event: "speaking_final_score_ready",
    session_id: String(session._id),
    submit_to_final_ms: submitToFinalMs,
    provisional_final_band_diff: bandDiff,
  }));

  await cleanupSessionAudioFromCloudinary(session);

  return {
    session,
    aiSource,
    analysis,
    skipped: false,
  };
};
