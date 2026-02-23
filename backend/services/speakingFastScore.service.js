import OpenAI from "openai";
import { toFile } from "openai/uploads";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const DEFAULT_FILLER_WORDS = [
  "um",
  "uh",
  "like",
  "you know",
  "actually",
  "basically",
];

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const roundHalf = (value) => Math.round(Number(value || 0) * 2) / 2;

const parseFillerWords = () => {
  const fromEnv = String(process.env.SPEAKING_FILLER_WORDS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_FILLER_WORDS;
};

const resolveAudioFilename = (mimeType = "audio/webm") => {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("wav")) return "speaking-audio.wav";
  if (normalized.includes("mpeg") || normalized.includes("mp3")) return "speaking-audio.mp3";
  if (normalized.includes("ogg")) return "speaking-audio.ogg";
  if (normalized.includes("mp4")) return "speaking-audio.mp4";
  return "speaking-audio.webm";
};

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const tokenizeWords = (text = "") =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9'\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);

const splitSentences = (text = "") =>
  String(text || "")
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const detectGrammarProxyErrors = (transcript = "") => {
  const lower = String(transcript || "").toLowerCase();
  if (!lower.trim()) return 0;

  let errorCount = 0;

  const mismatchPatterns = [
    /\bi\s+is\b/g,
    /\bi\s+are\b/g,
    /\bhe\s+are\b/g,
    /\bshe\s+are\b/g,
    /\bit\s+are\b/g,
    /\bthey\s+is\b/g,
    /\bwe\s+is\b/g,
    /\byou\s+is\b/g,
    /\bdoesn'?t\s+\w+ed\b/g,
    /\bdidn'?t\s+\w+ed\b/g,
  ];

  mismatchPatterns.forEach((pattern) => {
    const matches = lower.match(pattern);
    if (matches?.length) errorCount += matches.length;
  });

  const repeatedWordMatches = lower.match(/\b([a-z']+)\s+\1\b/g);
  if (repeatedWordMatches?.length) {
    errorCount += repeatedWordMatches.length;
  }

  const verbHints = /\b(is|are|am|was|were|be|been|being|do|does|did|have|has|had|can|could|will|would|should|may|might|must|go|goes|went|make|makes|made|take|takes|took)\b/i;
  const sentences = splitSentences(lower);
  sentences.forEach((sentence) => {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (words.length >= 6 && !verbHints.test(sentence)) {
      errorCount += 1;
    }
  });

  return errorCount;
};

const extractAsrConfidence = (sttMeta = {}) => {
  const words = Array.isArray(sttMeta?.words) ? sttMeta.words : [];
  const wordConfidenceValues = words
    .map((word) => safeNumber(word?.confidence, NaN))
    .filter((value) => Number.isFinite(value));
  if (wordConfidenceValues.length > 0) {
    return clamp(
      wordConfidenceValues.reduce((sum, value) => sum + value, 0) / wordConfidenceValues.length,
      0,
      1,
    );
  }

  const segments = Array.isArray(sttMeta?.segments) ? sttMeta.segments : [];
  const logProbValues = segments
    .map((segment) => safeNumber(segment?.avg_logprob, NaN))
    .filter((value) => Number.isFinite(value));
  if (logProbValues.length > 0) {
    const avgLogProb = logProbValues.reduce((sum, value) => sum + value, 0) / logProbValues.length;
    const confidence = Math.exp(avgLogProb);
    return clamp(confidence, 0, 1);
  }

  return null;
};

const scoreWpm = (wpm) => {
  if (wpm <= 0) return 4.5;
  if (wpm < 70) return 3.5;
  if (wpm < 90) return 4.5;
  if (wpm < 110) return 5.5;
  if (wpm < 145) return 6.5;
  if (wpm < 170) return 7.0;
  if (wpm < 190) return 6.0;
  return 5.0;
};

const scorePauseRate = (pausePer100Words) => {
  if (pausePer100Words <= 8) return 7.5;
  if (pausePer100Words <= 12) return 6.5;
  if (pausePer100Words <= 18) return 5.5;
  if (pausePer100Words <= 25) return 4.5;
  return 3.5;
};

const scoreFillerDensity = (fillerDensity) => {
  if (fillerDensity <= 0.01) return 7.5;
  if (fillerDensity <= 0.03) return 6.5;
  if (fillerDensity <= 0.06) return 5.5;
  if (fillerDensity <= 0.1) return 4.5;
  return 3.5;
};

const scoreGrammarProxyRate = (grammarProxyErrorRate) => {
  if (grammarProxyErrorRate <= 0.2) return 7.0;
  if (grammarProxyErrorRate <= 0.4) return 6.0;
  if (grammarProxyErrorRate <= 0.7) return 5.0;
  if (grammarProxyErrorRate <= 1.0) return 4.0;
  return 3.0;
};

const scoreLexicalDiversity = (lexicalDiversity) => {
  if (lexicalDiversity >= 0.62) return 7.5;
  if (lexicalDiversity >= 0.55) return 6.8;
  if (lexicalDiversity >= 0.48) return 6.0;
  if (lexicalDiversity >= 0.42) return 5.2;
  if (lexicalDiversity >= 0.35) return 4.5;
  return 3.8;
};

export const transcribeWithWhisper = async ({ audioBuffer, mimeType }) => {
  if (!openai) {
    throw new Error("OpenAI API key is not configured");
  }
  if (!audioBuffer || !Buffer.isBuffer(audioBuffer)) {
    throw new Error("audioBuffer is required for Whisper transcription");
  }

  const sttModel = String(process.env.SPEAKING_STT_MODEL || "whisper-1").trim() || "whisper-1";
  const uploadable = await toFile(audioBuffer, resolveAudioFilename(mimeType), {
    type: String(mimeType || "audio/webm"),
  });

  const response = await openai.audio.transcriptions.create({
    file: uploadable,
    model: sttModel,
    response_format: "verbose_json",
    temperature: 0,
  });

  return {
    transcript: String(response?.text || "").trim(),
    sttMeta: {
      language: response?.language || null,
      duration: safeNumber(response?.duration, 0),
      segments: Array.isArray(response?.segments) ? response.segments : [],
      words: Array.isArray(response?.words) ? response.words : [],
    },
    source: `openai:${sttModel}`,
  };
};

export const extractFeatures = ({ transcript = "", metrics = {}, wpm = 0, sttMeta = {} }) => {
  const normalizedTranscript = String(transcript || "").trim();
  const words = tokenizeWords(normalizedTranscript);
  const wordCount = words.length;
  const sentenceCount = Math.max(splitSentences(normalizedTranscript).length, 1);

  const providedWpm = safeNumber(wpm, 0);
  const durationSecFromStt = safeNumber(sttMeta?.duration, 0);
  let resolvedWpm = providedWpm;
  if (!resolvedWpm && durationSecFromStt > 0 && wordCount > 0) {
    resolvedWpm = (wordCount / durationSecFromStt) * 60;
  }

  const pauseCount = safeNumber(metrics?.pauseCount, 0);
  const totalPauseDuration = safeNumber(metrics?.totalPauseDuration, 0);
  const avgPauseDuration = pauseCount > 0
    ? totalPauseDuration / pauseCount
    : safeNumber(metrics?.avgPauseDuration, 0);

  const fillers = parseFillerWords();
  const joinedLower = ` ${normalizedTranscript.toLowerCase()} `;
  let fillerCount = 0;
  fillers.forEach((filler) => {
    const escaped = filler.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = joinedLower.match(new RegExp(`\\b${escaped}\\b`, "g"));
    if (matches?.length) fillerCount += matches.length;
  });

  const uniqueWordCount = new Set(words).size;
  const rawTtr = wordCount > 0 ? uniqueWordCount / wordCount : 0;
  const lexicalLengthBoost = clamp(Math.sqrt(Math.max(wordCount, 1) / 30), 0.6, 1.25);
  const lexicalDiversity = clamp(rawTtr * lexicalLengthBoost, 0, 1);

  const grammarProxyErrorCount = detectGrammarProxyErrors(normalizedTranscript);
  const grammarProxyErrorRate = grammarProxyErrorCount / sentenceCount;

  const pausePer100Words = wordCount > 0 ? (pauseCount / wordCount) * 100 : pauseCount;
  const fillerDensity = wordCount > 0 ? fillerCount / wordCount : 0;
  const asrConfidence = extractAsrConfidence(sttMeta);

  return {
    wpm: resolvedWpm,
    pause_count: pauseCount,
    total_pause_ms: totalPauseDuration,
    avg_pause_ms: avgPauseDuration,
    filler_count: fillerCount,
    filler_density: fillerDensity,
    grammar_proxy_error_count: grammarProxyErrorCount,
    grammar_proxy_error_rate: grammarProxyErrorRate,
    lexical_diversity: lexicalDiversity,
    asr_confidence: asrConfidence,
    word_count: wordCount,
    sentence_count: sentenceCount,
    pause_per_100_words: pausePer100Words,
  };
};

export const computeProvisionalBandV1 = (features = {}) => {
  const fluencyFromWpm = scoreWpm(safeNumber(features.wpm, 0));
  const fluencyFromPause = scorePauseRate(safeNumber(features.pause_per_100_words, 0));
  const fluencyFromFiller = scoreFillerDensity(safeNumber(features.filler_density, 0));
  const fluencyRaw = 0.45 * fluencyFromWpm + 0.35 * fluencyFromPause + 0.2 * fluencyFromFiller;
  const fluency = roundHalf(clamp(fluencyRaw, 0, 9));

  const grammar = roundHalf(clamp(scoreGrammarProxyRate(safeNumber(features.grammar_proxy_error_rate, 0)), 0, 9));
  const lexical = roundHalf(clamp(scoreLexicalDiversity(safeNumber(features.lexical_diversity, 0)), 0, 9));

  const confidence = features.asr_confidence;
  let pronunciationRaw;
  if (confidence === null || confidence === undefined || !Number.isFinite(Number(confidence))) {
    pronunciationRaw = 0.6 * fluency + 0.4 * lexical;
  } else {
    const confidenceScore = clamp(2 + 7 * Number(confidence), 0, 9);
    pronunciationRaw = 0.55 * confidenceScore + 0.25 * fluency + 0.2 * lexical;
  }
  const pronunciation = roundHalf(clamp(pronunciationRaw, 0, 9));

  const finalBandRaw = 0.3 * fluency + 0.25 * grammar + 0.25 * lexical + 0.2 * pronunciation;
  const band = roundHalf(clamp(finalBandRaw, 0, 9));

  return {
    band_score: band,
    fluency_coherence: fluency,
    grammatical_range: grammar,
    lexical_resource: lexical,
    pronunciation,
  };
};

export const buildProvisionalAnalysis = (features = {}, provisional = {}) => {
  const hasConfidenceValue =
    features.asr_confidence !== null &&
    features.asr_confidence !== undefined &&
    Number.isFinite(Number(features.asr_confidence));
  const confidenceText = hasConfidenceValue
    ? `${Math.round(Number(features.asr_confidence) * 100)}%`
    : "N/A";

  return {
    band_score: safeNumber(provisional.band_score, 0),
    fluency_coherence: {
      score: safeNumber(provisional.fluency_coherence, 0),
      feedback: `WPM ${Math.round(safeNumber(features.wpm, 0))}, pauses ${Math.round(safeNumber(features.pause_count, 0))}, filler density ${(safeNumber(features.filler_density, 0) * 100).toFixed(1)}%.`,
    },
    lexical_resource: {
      score: safeNumber(provisional.lexical_resource, 0),
      feedback: `Lexical diversity ${(safeNumber(features.lexical_diversity, 0) * 100).toFixed(1)}% based on ${Math.round(safeNumber(features.word_count, 0))} words.`,
    },
    grammatical_range: {
      score: safeNumber(provisional.grammatical_range, 0),
      feedback: `Grammar proxy error rate ${safeNumber(features.grammar_proxy_error_rate, 0).toFixed(2)} per sentence.`,
    },
    pronunciation: {
      score: safeNumber(provisional.pronunciation, 0),
      feedback: `ASR confidence: ${confidenceText}. Pronunciation score is provisional and will be finalized by AI audio grading.`,
    },
    general_feedback: "This is a provisional score from the fast pipeline (STT + heuristics). The official score will be updated after full AI grading.",
    sample_answer: "Waiting for the final AI-generated model answer.",
  };
};

export const evaluateSpeakingProvisionalScore = async ({
  audioBuffer,
  mimeType,
  metrics = {},
  wpm = 0,
  fallbackTranscript = "",
} = {}) => {
  const fastPipelineEnabled = toBoolean(process.env.SPEAKING_FAST_PIPELINE, false);
  if (!fastPipelineEnabled) {
    return null;
  }

  let whisperResult = null;
  try {
    whisperResult = await transcribeWithWhisper({ audioBuffer, mimeType });
  } catch (error) {
    const fallback = String(fallbackTranscript || "").trim();
    if (!fallback) {
      throw error;
    }
    whisperResult = {
      transcript: fallback,
      sttMeta: {},
      source: "client_transcript_fallback",
    };
  }

  const transcript = whisperResult?.transcript || String(fallbackTranscript || "").trim();
  if (!transcript) {
    return null;
  }

  const features = extractFeatures({
    transcript,
    metrics,
    wpm,
    sttMeta: whisperResult?.sttMeta || {},
  });
  const provisional = computeProvisionalBandV1(features);
  const provisionalAnalysis = buildProvisionalAnalysis(features, provisional);

  return {
    transcript,
    features,
    provisionalAnalysis,
    provisionalSource: String(process.env.SPEAKING_PROVISIONAL_FORMULA_VERSION || "formula_v1"),
    sttSource: whisperResult?.source || "openai:whisper-1",
  };
};
