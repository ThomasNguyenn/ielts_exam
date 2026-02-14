import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Speaking from "../models/Speaking.model.js";
import SpeakingSession from "../models/SpeakingSession.js";
import { requestGeminiJsonWithFallback } from "../utils/aiClient.js";

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
  "general_feedback": "string (strict overall summary with top priority fixes)",
  "sample_answer": "string (Band 8.0+ model answer for this topic)"
}
`;

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
      generationConfig: { responseMimeType: "application/json" },
      timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 45000),
      maxAttempts: Number(process.env.GEMINI_MAX_ATTEMPTS || 3),
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
  session.status = "completed";
  session.ai_source = aiSource;
  await session.save();

  return {
    session,
    aiSource,
    analysis,
    skipped: false,
  };
};
