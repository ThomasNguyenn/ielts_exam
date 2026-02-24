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

const buildFallbackAnalysis = (clientTranscript) => ({
  transcript: clientTranscript || "Transcript unavailable",
  band_score: 0,
  fluency_coherence: { score: 0, feedback: "AI scoring temporarily unavailable." },
  lexical_resource: { score: 0, feedback: "AI scoring temporarily unavailable." },
  grammatical_range: { score: 0, feedback: "AI scoring temporarily unavailable." },
  pronunciation: { score: 0, feedback: "AI scoring temporarily unavailable." },
  general_feedback: "He thong tam thoi khong cham duoc bai noi. Bai nop van da duoc luu.",
  sample_answer: "N/A",
});

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
  clientWPM,
  parsedMetrics,
  clientTranscript,
}) => `
You are both:
1) A STRICT IELTS Speaking examiner (official IELTS descriptors), and
2) An ELSA-style pronunciation coach (segmentals + suprasegmentals).

TOPIC / QUESTION:
"${topicPrompt}"

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
  "sample_answer": "string (Band 7.0+ model answer for this topic)"
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

  const clientTranscript = session.transcript || "";
  const clientWPM = Number(session?.metrics?.wpm || 0);
  const parsedMetrics = session?.metrics?.pauses || {};
  const prompt = buildStrictSpeakingPrompt({
    topicPrompt: topic.prompt,
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
    analysis = aiResponse.data;
    aiSource = aiResponse.model;
  } catch (aiError) {
    console.error("Speaking AI fallback triggered:", {
      error: aiError.message,
      models: GEMINI_MODELS,
      mimeType: usedMimeType,
      audioBytes,
    });
    analysis = buildFallbackAnalysis(clientTranscript);
  }

  session.transcript = analysis.transcript || clientTranscript || "";
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
