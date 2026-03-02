import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Speaking from "../models/Speaking.model.js";
import SpeakingSession from "../models/SpeakingSession.js";
import cloudinary from "../utils/cloudinary.js";
import { requestGeminiJsonWithFallback } from "../utils/aiClient.js";
import { createTaxonomyErrorLog } from "./taxonomy.registry.js";
import { transcribeWithWhisper } from "./speakingFastScore.service.js";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

const normalizeGeminiModel = (modelName, fallbackModel) => {
  const normalized = String(modelName || "").trim();
  if (!normalized) return fallbackModel;

  // Legacy 1.5 models are not available on current generateContent endpoint.
  if (normalized === "gemini-1.5-flash") {
    return "gemini-2.5-flash";
  }

  return normalized;
};

const primaryModel = normalizeGeminiModel(
  process.env.GEMINI_PRIMARY_MODEL,
  "gemini-3-flash-preview",
);
const fallbackModel = normalizeGeminiModel(
  process.env.GEMINI_FALLBACK_MODEL,
  "gemini-2.5-flash",
);
const GEMINI_MODELS = [primaryModel, fallbackModel].filter(
  (model, index, list) => Boolean(model) && list.indexOf(model) === index,
);
const phase1PrimaryModel = normalizeGeminiModel(
  process.env.SPEAKING_PHASE1_PRIMARY_MODEL,
  "gemini-2.5-flash",
);
const phase1FallbackModel = normalizeGeminiModel(
  process.env.SPEAKING_PHASE1_FALLBACK_MODEL,
  fallbackModel,
);
const SPEAKING_PHASE1_MODELS = [phase1PrimaryModel, phase1FallbackModel].filter(
  (model, index, list) => Boolean(model) && list.indexOf(model) === index,
);
const SPEAKING_GEMINI_TIMEOUT_MS = Number(
  process.env.SPEAKING_GEMINI_TIMEOUT_MS || process.env.GEMINI_TIMEOUT_MS || 30000,
);
const SPEAKING_GEMINI_MAX_ATTEMPTS = Number(
  process.env.SPEAKING_GEMINI_MAX_ATTEMPTS || process.env.GEMINI_MAX_ATTEMPTS || 2,
);
const SPEAKING_PHASE1_TIMEOUT_MS = Number(
  process.env.SPEAKING_PHASE1_TIMEOUT_MS || 20000,
);
const SPEAKING_PHASE2_TIMEOUT_MS = Number(
  process.env.SPEAKING_PHASE2_TIMEOUT_MS || SPEAKING_GEMINI_TIMEOUT_MS || 30000,
);
const SPEAKING_PHASE1_MAX_OUTPUT_TOKENS = Number(
  process.env.SPEAKING_PHASE1_MAX_OUTPUT_TOKENS || 6000,
);
const SPEAKING_PHASE2_MAX_OUTPUT_TOKENS = Number(
  process.env.SPEAKING_PHASE2_MAX_OUTPUT_TOKENS || 6000,
);
const SPEAKING_ANALYSIS_MAX_OUTPUT_TOKENS = Number(
  process.env.SPEAKING_ANALYSIS_MAX_OUTPUT_TOKENS
  || process.env.GEMINI_ANALYSIS_MAX_OUTPUT_TOKENS
  || 1600,
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

const readAudioSourceBuffer = async (audioSource) => {
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

  return {
    fileBuffer,
    fetchedContentType,
  };
};

const toAudioPart = async (audioSource, mimeType) => {
  const { fileBuffer, fetchedContentType } = await readAudioSourceBuffer(audioSource);

  const resolvedMimeType = normalizeGeminiAudioMimeType(mimeType, fetchedContentType);

  return {
    inlineData: {
      data: fileBuffer.toString("base64"),
      mimeType: resolvedMimeType,
    },
  };
};

const toAudioBufferWithMime = async (audioSource, mimeType) => {
  const { fileBuffer, fetchedContentType } = await readAudioSourceBuffer(audioSource);
  return {
    fileBuffer,
    mimeType: normalizeGeminiAudioMimeType(mimeType, fetchedContentType),
  };
};

const normalizeSpeakingPart = (value) => {
  const parsed = Number(value);
  if ([1, 2, 3].includes(parsed)) return parsed;
  return 0;
};

const extractCueCardLines = (cueCard = "") =>
  String(cueCard || "")
    .split(/\r?\n/)
    .map((item) => String(item || "").replace(/^[\s\-*â€¢]+/, "").trim())
    .filter(Boolean);

const resolveTopicCuePoints = (topic = {}) => {
  const part = normalizeSpeakingPart(topic?.part);
  if (part !== 2) {
    return Array.isArray(topic?.sub_questions) ? topic.sub_questions : [];
  }

  const cueCardLines = extractCueCardLines(topic?.cue_card || "");
  if (cueCardLines.length > 0) return cueCardLines;

  return Array.isArray(topic?.sub_questions) ? topic.sub_questions : [];
};

const formatSubQuestionLines = (subQuestions = []) => {
  const lines = (Array.isArray(subQuestions) ? subQuestions : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .map((item) => `- ${item}`);
  return lines.length ? lines.join("\n") : "- None";
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

const toBandScoreOrNull = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    return roundHalf(clamp(value, 0, 9));
  }

  const raw = String(value || "").trim();
  if (!raw) return null;
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) {
    return roundHalf(clamp(numeric, 0, 9));
  }

  const matched = raw.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!matched) return null;
  const extracted = Number(matched[1]);
  if (!Number.isFinite(extracted)) return null;
  return roundHalf(clamp(extracted, 0, 9));
};

const chooseScoreWithFallback = (primaryScore, fallbackScore) => {
  const primary = toBandScoreOrNull(primaryScore);
  const fallback = toBandScoreOrNull(fallbackScore);
  if (primary !== null && primary > 0) return primary;
  if (fallback !== null && fallback > 0) return fallback;
  if (primary !== null) return primary;
  if (fallback !== null) return fallback;
  return 0;
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

const splitTranscriptSentences = (transcript = "") =>
  String(transcript || "")
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const GRAMMAR_PROXY_RULES = [
  {
    code: "S-G2",
    pattern: /\bi\s+is\b/gi,
    corrected: "I am",
    explanation: "Loi hoa hop chu ngu dong tu (I + am).",
  },
  {
    code: "S-G2",
    pattern: /\bi\s+are\b/gi,
    corrected: "I am",
    explanation: "Loi hoa hop chu ngu dong tu (I + am).",
  },
  {
    code: "S-G2",
    pattern: /\bhe\s+are\b/gi,
    corrected: "he is",
    explanation: "Loi hoa hop chu ngu dong tu ngoi thu ba so it.",
  },
  {
    code: "S-G2",
    pattern: /\bshe\s+are\b/gi,
    corrected: "she is",
    explanation: "Loi hoa hop chu ngu dong tu ngoi thu ba so it.",
  },
  {
    code: "S-G2",
    pattern: /\bit\s+are\b/gi,
    corrected: "it is",
    explanation: "Loi hoa hop chu ngu dong tu ngoi thu ba so it.",
  },
  {
    code: "S-G2",
    pattern: /\bthey\s+is\b/gi,
    corrected: "they are",
    explanation: "Loi hoa hop chu ngu dong tu so nhieu.",
  },
  {
    code: "S-G2",
    pattern: /\bwe\s+is\b/gi,
    corrected: "we are",
    explanation: "Loi hoa hop chu ngu dong tu so nhieu.",
  },
  {
    code: "S-G2",
    pattern: /\byou\s+is\b/gi,
    corrected: "you are",
    explanation: "Loi hoa hop chu ngu dong tu so nhieu.",
  },
  {
    code: "S-G1",
    pattern: /\b(didn'?t)\s+([a-z]+)ed\b/gi,
    corrected: "$1 $2",
    explanation: "Sau 'did not' can dung dong tu nguyen mau.",
  },
  {
    code: "S-G1",
    pattern: /\b(doesn'?t)\s+([a-z]+)ed\b/gi,
    corrected: "$1 $2",
    explanation: "Sau 'does not' can dung dong tu nguyen mau.",
  },
  {
    code: "S-G2",
    pattern: /\bthere\s+is\s+([a-z]+s)\b/gi,
    corrected: "there are $1",
    explanation: "Danh tu so nhieu can di voi 'there are'.",
  },
  {
    code: "S-G1",
    pattern: /\b(yesterday|last\s+\w+|[0-9]+\s+years?\s+ago)\b[^.!?]{0,40}\b(go|come|eat|do|make|take|see|get|buy)\b/gi,
    corrected: null,
    explanation: "Moc thoi gian qua khu thuong can thi qua khu don.",
  },
  {
    code: "S-G3",
    pattern: /\b([a-z']+)\s+\1\b/gi,
    corrected: null,
    explanation: "Lap tu lien tiep, cau truc cau chua on dinh.",
  },
];

const collectRegexMatches = (text = "", pattern) => {
  if (!(pattern instanceof RegExp)) return [];
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const regex = new RegExp(pattern.source, flags);
  const matches = [];

  let matched = regex.exec(text);
  while (matched) {
    const snippet = String(matched[0] || "").trim();
    if (snippet) {
      matches.push({
        snippet,
        groups: Array.isArray(matched) ? matched.slice(1) : [],
      });
    }
    if (matched[0] === "") regex.lastIndex += 1;
    matched = regex.exec(text);
  }

  return matches;
};

const buildCorrectedPhraseFromMatch = (template, groups = []) => {
  if (!template) return "";
  return String(template).replace(/\$(\d+)/g, (_, idx) => String(groups[Number(idx) - 1] || ""));
};

const collectGrammarProxyFindingsForCalibration = (transcript = "") => {
  const lower = String(transcript || "").toLowerCase().trim();
  if (!lower) return [];

  const findings = [];
  const seen = new Set();

  GRAMMAR_PROXY_RULES.forEach((rule) => {
    collectRegexMatches(lower, rule.pattern).forEach((match) => {
      const snippet = String(match?.snippet || "").trim();
      if (!snippet) return;
      const key = `${rule.code}::${snippet}`;
      if (seen.has(key)) return;
      seen.add(key);
      findings.push({
        code: rule.code,
        snippet,
        corrected: buildCorrectedPhraseFromMatch(rule.corrected, match.groups),
        explanation: rule.explanation,
      });
    });
  });

  const verbHints = /\b(is|are|am|was|were|be|been|being|do|does|did|have|has|had|can|could|will|would|should|may|might|must|go|goes|went|make|makes|made|take|takes|took)\b/i;
  const sentences = splitTranscriptSentences(lower);
  sentences.forEach((sentence) => {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (words.length < 7 || verbHints.test(sentence)) return;
    const snippet = sentence.slice(0, 80).trim();
    if (!snippet) return;
    const key = `S-G4::${snippet}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({
      code: "S-G4",
      snippet,
      corrected: "",
      explanation: "Cau dai nhung co dau hieu thieu dong tu/chua hoan chinh cau truc.",
    });
  });

  return findings.slice(0, 12);
};

const detectGrammarProxyErrorsForCalibration = (transcript = "") => {
  const lower = String(transcript || "").toLowerCase().trim();
  if (!lower) {
    return {
      errorCount: 0,
      sentenceCount: 1,
      errorRate: 0,
      findings: [],
    };
  }

  const findings = collectGrammarProxyFindingsForCalibration(lower);
  const errorCount = findings.length;
  const sentenceCount = Math.max(splitTranscriptSentences(lower).length, 1);
  return {
    errorCount,
    sentenceCount,
    errorRate: errorCount / sentenceCount,
    findings,
  };
};

const buildGrammarProxyErrorLogs = (findings = []) =>
  (Array.isArray(findings) ? findings : [])
    .map((item) => ({
      code: String(item?.code || "S-G4").trim().toUpperCase(),
      snippet: String(item?.snippet || "").trim(),
      explanation: String(item?.explanation || "Loi ngu phap can duoc sua.").trim(),
    }))
    .filter((item) => item.code && item.snippet)
    .slice(0, 8);

const buildGrammarProxyCorrections = (findings = []) =>
  (Array.isArray(findings) ? findings : [])
    .map((item) => ({
      original: String(item?.snippet || "").trim(),
      corrected: String(item?.corrected || "").trim() || "Use a grammatically correct version of this phrase.",
      reason: String(item?.explanation || "Fix grammar structure.").trim(),
    }))
    .filter((item) => item.original)
    .slice(0, 8);

const mergeGrammarCorrections = (primary = [], fallback = []) => {
  const output = [];
  const seen = new Set();

  [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(fallback) ? fallback : [])]
    .forEach((item) => {
      const original = String(item?.original || "").trim();
      if (!original) return;
      const key = original.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      output.push({
        original,
        corrected: String(item?.corrected || "").trim() || "Use a grammatically correct version of this phrase.",
        reason: String(item?.reason || "").trim() || "Fix grammar structure.",
      });
    });

  return output.slice(0, 8);
};

const countErrorLogsByPrefix = (errorLogs = [], prefix = "") => {
  const normalizedPrefix = String(prefix || "").trim().toUpperCase();
  if (!normalizedPrefix) return 0;
  return (Array.isArray(errorLogs) ? errorLogs : [])
    .filter((log) => String(log?.code || log?.error_code || "").trim().toUpperCase().startsWith(normalizedPrefix))
    .length;
};

const countHeatmapStatus = (heatmapEntries = [], targetStatus = "") => {
  const target = String(targetStatus || "").trim().toLowerCase();
  if (!target) return 0;
  return (Array.isArray(heatmapEntries) ? heatmapEntries : [])
    .filter((entry) => String(entry?.status || "").trim().toLowerCase() === target)
    .length;
};

const extractAsrConfidenceRatio = (feedback = "") => {
  const raw = String(feedback || "").trim();
  if (!raw) return null;

  const percentMatched = raw.match(/asr\s*confidence\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*%/i);
  if (percentMatched) {
    const parsed = Number(percentMatched[1]);
    if (Number.isFinite(parsed)) return clamp(parsed / 100, 0, 1);
  }

  const ratioMatched = raw.match(/asr\s*confidence\s*[:\-]?\s*(0(?:\.[0-9]+)?|1(?:\.0+)?)\b/i);
  if (ratioMatched) {
    const parsed = Number(ratioMatched[1]);
    if (Number.isFinite(parsed)) return clamp(parsed, 0, 1);
  }

  return null;
};

const isProvisionalLikeSource = (source = "") => {
  const normalized = String(source || "").trim().toLowerCase();
  if (!normalized) return false;
  return normalized === "fallback" || normalized.includes("provisional");
};

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

const filterErrorLogsByPrefixes = (errorLogs = [], prefixes = []) => {
  const normalizedPrefixes = (Array.isArray(prefixes) ? prefixes : [])
    .map((prefix) => String(prefix || "").trim().toUpperCase())
    .filter(Boolean);

  if (normalizedPrefixes.length === 0) return [];

  return (Array.isArray(errorLogs) ? errorLogs : [])
    .filter((log) => {
      const code = String(log?.code || log?.error_code || "").trim().toUpperCase();
      return normalizedPrefixes.some((prefix) => code.startsWith(prefix));
    });
};

const dedupeErrorLogs = (errorLogs = []) => {
  const seen = new Set();
  const output = [];

  (Array.isArray(errorLogs) ? errorLogs : []).forEach((log) => {
    const code = String(log?.code || log?.error_code || "").trim().toUpperCase();
    const snippet = String(log?.snippet || log?.text_snippet || "").trim().toLowerCase();
    const key = `${code}::${snippet}`;
    if (!code || seen.has(key)) return;
    seen.add(key);
    output.push(log);
  });

  return output;
};

const normalizePhase1Payload = (rawPhase1, {
  topicPart = 0,
  topicPrompt = "",
} = {}) => {
  const source = rawPhase1 && typeof rawPhase1 === "object" ? rawPhase1 : {};
  const lexicalScore = toBandScoreOrNull(source?.lexical_resource?.score);
  const grammarScore = toBandScoreOrNull(source?.grammatical_range?.score);

  return {
    lexical_resource: {
      score: lexicalScore,
      feedback: String(source?.lexical_resource?.feedback || "No lexical feedback.").trim(),
    },
    grammatical_range: {
      score: grammarScore,
      feedback: String(source?.grammatical_range?.feedback || "No grammar feedback.").trim(),
    },
    vocabulary_upgrades: normalizeVocabularyUpgrades(source?.vocabulary_upgrades),
    grammar_corrections: normalizeGrammarCorrections(source?.grammar_corrections),
    sample_answer: String(
      source?.sample_answer || buildPartAwareFallbackSampleAnswer({ topicPart, topicPrompt }),
    ).trim(),
    general_feedback: String(source?.general_feedback || "Phase 1 analysis ready.").trim(),
    error_logs: dedupeErrorLogs(filterErrorLogsByPrefixes(source?.error_logs, ["S-L", "S-G"])),
  };
};

const pruneStoredPhase1Analysis = (phase1Analysis) => {
  if (!phase1Analysis || typeof phase1Analysis !== "object") {
    return phase1Analysis;
  }

  const {
    sample_answer: _sampleAnswer,
    general_feedback: _generalFeedback,
    ...rest
  } = phase1Analysis;

  return rest;
};

const normalizePhase2Payload = (rawPhase2, {
  transcript = "",
  fallbackWpm = 0,
  pauseCount = 0,
} = {}) => {
  const source = rawPhase2 && typeof rawPhase2 === "object" ? rawPhase2 : {};
  const fluencyScore = toBandScoreOrNull(source?.fluency_coherence?.score);
  const pronunciationScore = toBandScoreOrNull(source?.pronunciation?.score);
  const errorLogs = dedupeErrorLogs(filterErrorLogsByPrefixes(source?.error_logs, ["S-F", "S-P"]));

  const modelHeatmap = normalizeHeatmapEntries(source?.pronunciation_heatmap);
  const heatmap = modelHeatmap.length > 0
    ? modelHeatmap
    : buildHeatmapFromTranscript(transcript, errorLogs);
  const modelFocus = normalizeFocusAreas(source?.focus_areas);
  const focusAreas = modelFocus.length > 0
    ? modelFocus
    : buildFocusAreasFromErrorLogs(errorLogs);

  const normalizedPace = Math.round(Math.max(0, safeNumber(source?.intonation_pacing?.pace_wpm, fallbackWpm)));
  const pitchVariation = String(
    source?.intonation_pacing?.pitch_variation || derivePitchVariationLabel(safeNumber(pronunciationScore, 0), pauseCount),
  ).trim();

  const nextStepFallback = focusAreas[0]?.description
    || "Practice this topic one more time with slower pacing and clearer stress.";

  return {
    fluency_coherence: {
      score: fluencyScore,
      feedback: String(source?.fluency_coherence?.feedback || "No fluency feedback.").trim(),
    },
    pronunciation: {
      score: pronunciationScore,
      feedback: String(source?.pronunciation?.feedback || "No pronunciation feedback.").trim(),
    },
    pronunciation_heatmap: heatmap,
    focus_areas: focusAreas,
    intonation_pacing: {
      pace_wpm: normalizedPace,
      pitch_variation: pitchVariation || "Needs Work",
      feedback: String(source?.intonation_pacing?.feedback || "").trim(),
    },
    next_step: String(source?.next_step || nextStepFallback).trim(),
    general_feedback: String(source?.general_feedback || "Phase 2 analysis ready.").trim(),
    error_logs: errorLogs,
  };
};

const extractTaxonomyErrorLogs = (analysis, topicPart) => {
  if (!Array.isArray(analysis?.error_logs) || analysis.error_logs.length === 0) {
    return [];
  }

  const taskType = topicPart ? `part${topicPart}` : "speaking";
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

  return analysis.error_logs
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
        const fallback = speakingFallbackByPrefix[sourceCode.slice(0, 3)] || null;
        normalizedLog.cognitive_skill = fallback?.cognitiveSkill || normalizedLog.cognitive_skill;
        normalizedLog.error_category = fallback?.errorCategory || normalizedLog.error_category;
        normalizedLog.taxonomy_dimension = fallback?.taxonomyDimension || normalizedLog.taxonomy_dimension;
      }

      return normalizedLog;
    })
    .filter(Boolean);
};

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

const buildPhase1Prompt = ({
  transcript,
}) => `
You are a STRICT IELTS Speaking examiner focusing ONLY on:
1) Lexical Resource
2) Grammatical Range & Accuracy

Student Answer:
"${transcript || "(none)"}"

RULES:
- Evaluate only lexical_resource and grammatical_range.
- Score each criterion in 0.5 steps from 0.0 to 9.0.
- Be strict and evidence-based. Do not inflate scores.
- Run a grammar checklist before scoring: tense consistency, subject-verb agreement, article/preposition usage, sentence completeness.
- If there are repeated tense/SVA/article/preposition errors, grammatical_range MUST be <= 6.0.
- If grammar errors appear in multiple sentences and reduce clarity, grammatical_range MUST be <= 5.5.
- If 3+ concrete grammar errors are found, include all of them in grammar_corrections and error_logs (do not ignore).
- Provide concise, concrete Vietnamese feedback with transcript evidence.
- Produce vocabulary_upgrades and grammar_corrections from transcript.
- error_logs MUST only use lexical/grammar codes:
  - Lexical: S-L1, S-L2, S-L3, S-L4
  - Grammar: S-G1, S-G2, S-G3, S-G4
- Include 4-8 specific error logs.

Return ONLY valid JSON:
{
  "lexical_resource": { "score": number, "feedback": "string (In Vietnamese)" },
  "grammatical_range": { "score": number, "feedback": "string (In Vietnamese)" },
  "vocabulary_upgrades": [
    { "original": "string", "suggestion": "string", "reason": "string (In Vietnamese)" }
  ]
  "grammar_corrections": [
    { "original": "string" (words or noun phrase only), "corrected": "string", "reason": "string (In Vietnamese)" }
  ],
  "general_feedback": "string (In Vietnamese)",
  "error_logs": [
    { "code": "string", "snippet": "string", "explanation": "string (In Vietnamese)" }
  ]
}
`;

const buildPhase1RepairPrompt = ({
  transcript = "",
  previousRaw = "",
  reason = "",
}) => `
Your previous response for IELTS Speaking Phase 1 JSON was incomplete or invalid.

ISSUE:
${String(reason || "Missing required fields").trim()}

PREVIOUS RAW OUTPUT (for reference only):
${String(previousRaw || "").slice(0, 1500)}

Now regenerate the response from the same student answer below.
Do not omit any required top-level keys.

Student Answer:
"${transcript || "(none)"}"

Return ONLY valid JSON with this exact structure:
{
  "lexical_resource": { "score": number, "feedback": "string" },
  "grammatical_range": { "score": number, "feedback": "string" },
  "vocabulary_upgrades": [
    { "original": "string", "suggestion": "string", "reason": "string" }
  ],
  "grammar_corrections": [
    { "original": "string", "corrected": "string", "reason": "string" }
  ],
  "general_feedback": "string",
  "error_logs": [
    { "code": "string", "snippet": "string", "explanation": "string" }
  ]
}
`;

const validatePhase1AiPayload = (payload) => {
  const source = payload && typeof payload === "object" ? payload : {};
  const lexicalScore = toBandScoreOrNull(source?.lexical_resource?.score);
  const grammarScore = toBandScoreOrNull(source?.grammatical_range?.score);
  const lexicalFeedback = String(source?.lexical_resource?.feedback || "").trim();
  const grammarFeedback = String(source?.grammatical_range?.feedback || "").trim();

  if (lexicalScore === null) {
    return { ok: false, reason: "missing lexical_resource.score" };
  }
  if (!lexicalFeedback) {
    return { ok: false, reason: "missing lexical_resource.feedback" };
  }
  if (grammarScore === null) {
    return { ok: false, reason: "missing grammatical_range.score" };
  }
  if (!grammarFeedback) {
    return { ok: false, reason: "missing grammatical_range.feedback" };
  }

  return {
    ok: true,
    reason: "",
    data: {
      ...source,
      vocabulary_upgrades: Array.isArray(source?.vocabulary_upgrades) ? source.vocabulary_upgrades : [],
      grammar_corrections: Array.isArray(source?.grammar_corrections) ? source.grammar_corrections : [],
      error_logs: Array.isArray(source?.error_logs) ? source.error_logs : [],
      general_feedback: String(source?.general_feedback || "").trim(),
    },
  };
};

const toPhase1ContractLogPayload = (payload) => {
  const source = payload && typeof payload === "object" ? payload : {};
  return {
    lexical_resource: {
      score: source?.lexical_resource?.score ?? null,
      feedback: source?.lexical_resource?.feedback ?? null,
    },
    grammatical_range: {
      score: source?.grammatical_range?.score ?? null,
      feedback: source?.grammatical_range?.feedback ?? null,
    },
    vocabulary_upgrades: Array.isArray(source?.vocabulary_upgrades) ? source.vocabulary_upgrades : [],
    grammar_corrections: Array.isArray(source?.grammar_corrections) ? source.grammar_corrections : [],
    general_feedback: source?.general_feedback ?? null,
    error_logs: Array.isArray(source?.error_logs) ? source.error_logs : [],
  };
};

const getPhase1ContractMissingFields = (payload) => {
  const source = payload && typeof payload === "object" ? payload : {};
  const missing = [];

  if (source?.lexical_resource?.score === undefined || source?.lexical_resource?.score === null) {
    missing.push("lexical_resource.score");
  }
  if (source?.lexical_resource?.feedback === undefined || source?.lexical_resource?.feedback === null) {
    missing.push("lexical_resource.feedback");
  }
  if (source?.grammatical_range?.score === undefined || source?.grammatical_range?.score === null) {
    missing.push("grammatical_range.score");
  }
  if (source?.grammatical_range?.feedback === undefined || source?.grammatical_range?.feedback === null) {
    missing.push("grammatical_range.feedback");
  }
  if (!Array.isArray(source?.vocabulary_upgrades)) {
    missing.push("vocabulary_upgrades");
  }
  if (!Array.isArray(source?.grammar_corrections)) {
    missing.push("grammar_corrections");
  }
  if (source?.general_feedback === undefined || source?.general_feedback === null) {
    missing.push("general_feedback");
  }
  if (!Array.isArray(source?.error_logs)) {
    missing.push("error_logs");
  }

  return missing;
};

const buildPhase2Prompt = ({
  topicPrompt,
  topicPart,
  subQuestions,
  transcript,
  clientWPM,
  parsedMetrics,
}) => `
You are a STRICT IELTS Speaking examiner and pronunciation coach focusing ONLY on:
1) Fluency & Coherence
2) Pronunciation

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
- Transcript: "${transcript || "(none)"}"

RULES:
- Listen to audio first. Transcript is secondary.
- Evaluate only fluency_coherence and pronunciation.
- Score each criterion in 0.5 steps from 0.0 to 9.0.
- Be strict and evidence-based. Do not inflate scores.
- Fluency judgment must include pacing, pause pattern, coherence flow.
- Pronunciation judgment must include stress, final sounds, intonation, intelligibility.
- If there are 2+ clear pronunciation errors (stress/final sounds/substitution/intonation), pronunciation MUST be <= 7.0.
- If frequent pronunciation errors reduce intelligibility, pronunciation MUST be <= 6.5.
- If many words are unclear to understand, pronunciation MUST be <= 5.5.
- If pronunciation >= 7.5, you MUST provide concrete evidence of intelligibility/stress control and at most 1 minor pronunciation issue.
- If audio confidence is uncertain or speech is hard to understand, cap pronunciation at <= 6.5.
- error_logs MUST only use fluency/pronunciation codes:
  - Fluency: S-F1, S-F2, S-F3, S-F4
  - Pronunciation: S-P1, S-P2, S-P3, S-P4
- Include 4-8 specific error logs.

Return ONLY valid JSON:
{
  "fluency_coherence": { "score": number, "feedback": "string"(In Vietnamese)},
  "pronunciation": { "score": number, "feedback": "string"(In Vietnamese)},
  "pronunciation_heatmap": [
    { "word": "string", "status": "excellent | needs_work | error | neutral", "note": "string"(In Vietnamese) }
  ],
  "focus_areas": [
    { "title": "string", "priority": "high | medium | low", "description": "string"(In Vietnamese) }
  ],
  "intonation_pacing": { "pace_wpm": number, "pitch_variation": "string", "feedback": "string"(In Vietnamese) },
  "next_step": "string"(In Vietnamese),
  "general_feedback": "string"(In Vietnamese),
  "error_logs": [
    { "code": "string", "snippet": "string", "explanation": "string"(In Vietnamese) }
  ]
}
`;

const getSessionAndTopic = async (sessionId) => {
  const session = await SpeakingSession.findById(sessionId);
  if (!session) {
    const error = new Error("Speaking session not found");
    error.statusCode = 404;
    throw error;
  }

  const topic = await Speaking.findById(session.questionId);
  if (!topic) {
    const error = new Error("Speaking topic not found");
    error.statusCode = 404;
    throw error;
  }

  return { session, topic };
};

const resolveCanonicalTranscript = async (session) => {
  const existing = String(session?.transcript || "").trim();
  if (existing) {
    return {
      transcript: existing,
      source: "session",
    };
  }

  try {
    const { fileBuffer, mimeType } = await toAudioBufferWithMime(
      session.audioUrl,
      session.audioMimeType || "audio/webm",
    );
    const sttResult = await transcribeWithWhisper({
      audioBuffer: fileBuffer,
      mimeType,
    });
    const transcript = String(sttResult?.transcript || "").trim();
    return {
      transcript,
      source: sttResult?.source || "stt",
    };
  } catch (error) {
    return {
      transcript: "",
      source: `stt_error:${error?.message || "unknown"}`,
    };
  }
};

export const mergeSpeakingPhaseAnalyses = ({
  phase1,
  phase1Source = "",
  phase2,
  phase2Source = "",
  provisional,
  topicPart = 0,
  topicPrompt = "",
  transcript = "",
  metrics = {},
} = {}) => {
  const fallbackWpm = Number(metrics?.wpm || 0);
  const pauseCount = Number(metrics?.pauses?.pauseCount || 0);
  const provisionalNormalized = hasUsableAnalysisPayload(provisional)
    ? normalizeAnalysisPayload(provisional, {
      topicPart,
      topicPrompt,
      transcriptFallback: transcript,
      fallbackWpm,
      pauseCount,
    })
    : buildFallbackAnalysis(transcript, {
      topicPart,
      topicPrompt,
      fallbackWpm,
      pauseCount,
    });

  const phase1Normalized = normalizePhase1Payload(phase1, {
    topicPart,
    topicPrompt,
  });
  const phase2Normalized = normalizePhase2Payload(phase2, {
    transcript,
    fallbackWpm,
    pauseCount,
  });

  const lexicalScore = chooseScoreWithFallback(
    phase1Normalized?.lexical_resource?.score,
    provisionalNormalized?.lexical_resource?.score,
  );
  const grammarScore = chooseScoreWithFallback(
    phase1Normalized?.grammatical_range?.score,
    provisionalNormalized?.grammatical_range?.score,
  );
  const fluencyScore = chooseScoreWithFallback(
    phase2Normalized?.fluency_coherence?.score,
    provisionalNormalized?.fluency_coherence?.score,
  );
  const rawPronunciationScore = chooseScoreWithFallback(
    phase2Normalized?.pronunciation?.score,
    provisionalNormalized?.pronunciation?.score,
  );
  const rawGrammarScore = grammarScore;

  const grammarSignals = detectGrammarProxyErrorsForCalibration(transcript);
  const phaseErrorLogs = dedupeErrorLogs([
    ...(Array.isArray(phase1Normalized?.error_logs) ? phase1Normalized.error_logs : []),
    ...(Array.isArray(phase2Normalized?.error_logs) ? phase2Normalized.error_logs : []),
  ]);
  const proxyGrammarErrorLogs = buildGrammarProxyErrorLogs(grammarSignals.findings);
  const shouldInjectGrammarProxyLogs =
    grammarSignals.errorCount >= 2 && countErrorLogsByPrefix(phaseErrorLogs, "S-G") < 2;
  const effectiveGrammarErrorLogs = shouldInjectGrammarProxyLogs
    ? dedupeErrorLogs([...phaseErrorLogs, ...proxyGrammarErrorLogs])
    : phaseErrorLogs;
  const grammarErrorLogsCount = countErrorLogsByPrefix(effectiveGrammarErrorLogs, "S-G");
  const grammarCorrectionsCount = Array.isArray(phase1Normalized?.grammar_corrections)
    ? phase1Normalized.grammar_corrections.length
    : 0;
  const proxyGrammarCorrections = buildGrammarProxyCorrections(grammarSignals.findings);
  const mergedGrammarCorrections = mergeGrammarCorrections(
    phase1Normalized?.grammar_corrections,
    proxyGrammarCorrections.length > 0
      ? proxyGrammarCorrections
      : provisionalNormalized?.grammar_corrections,
  );

  let calibratedGrammarScore = rawGrammarScore;
  if (
    calibratedGrammarScore >= 7.5
    && (
      grammarSignals.errorRate >= 0.45
      || grammarSignals.errorCount >= 3
      || grammarErrorLogsCount >= 2
      || grammarCorrectionsCount >= 3
    )
  ) {
    calibratedGrammarScore = 6.5;
  } else if (
    calibratedGrammarScore >= 7.0
    && (grammarSignals.errorRate >= 0.65 || grammarSignals.errorCount >= 4 || grammarErrorLogsCount >= 3)
  ) {
    calibratedGrammarScore = 6.5;
  } else if (
    calibratedGrammarScore >= 6.5
    && (grammarSignals.errorRate >= 0.9 || grammarSignals.errorCount >= 5)
  ) {
    calibratedGrammarScore = 6.0;
  }

  const pronunciationErrorLogsCount = countErrorLogsByPrefix(phase2Normalized?.error_logs, "S-P");
  const heatmapErrorCount = countHeatmapStatus(phase2Normalized?.pronunciation_heatmap, "error");
  const heatmapNeedsWorkCount = countHeatmapStatus(phase2Normalized?.pronunciation_heatmap, "needs_work");
  const highPriorityPronFocusCount = (Array.isArray(phase2Normalized?.focus_areas) ? phase2Normalized.focus_areas : [])
    .filter((item) => String(item?.priority || "").trim().toLowerCase() === "high")
    .length;
  const asrConfidenceFromProvisional = extractAsrConfidenceRatio(
    provisional?.pronunciation?.feedback || provisionalNormalized?.pronunciation?.feedback,
  );
  const isPhase2FallbackSource = isProvisionalLikeSource(phase2Source);
  const pronunciationEvidenceWeight =
    pronunciationErrorLogsCount
    + heatmapErrorCount
    + Math.floor(heatmapNeedsWorkCount / 2)
    + highPriorityPronFocusCount;

  let calibratedPronunciationScore = rawPronunciationScore;
  if (
    calibratedPronunciationScore >= 8.0
    && (pronunciationErrorLogsCount >= 2 || heatmapErrorCount >= 3 || heatmapNeedsWorkCount >= 10 || highPriorityPronFocusCount >= 2)
  ) {
    calibratedPronunciationScore = 6.5;
  } else if (
    calibratedPronunciationScore >= 7.5
    && (pronunciationErrorLogsCount >= 2 || heatmapErrorCount >= 2 || heatmapNeedsWorkCount >= 8 || highPriorityPronFocusCount >= 2)
  ) {
    calibratedPronunciationScore = 7.0;
  } else if (
    calibratedPronunciationScore >= 7.0
    && (pronunciationErrorLogsCount >= 3 || heatmapErrorCount >= 4 || heatmapNeedsWorkCount >= 12)
  ) {
    calibratedPronunciationScore = 6.5;
  }
  if (calibratedPronunciationScore >= 7.5 && pronunciationEvidenceWeight >= 2 && fluencyScore <= 6.0) {
    calibratedPronunciationScore = 7.0;
  }
  if (
    calibratedPronunciationScore >= 7.5
    && asrConfidenceFromProvisional !== null
    && asrConfidenceFromProvisional < 0.75
  ) {
    calibratedPronunciationScore = 6.5;
  } else if (
    calibratedPronunciationScore >= 8.0
    && asrConfidenceFromProvisional !== null
    && asrConfidenceFromProvisional < 0.85
  ) {
    calibratedPronunciationScore = 7.0;
  }
  if (isPhase2FallbackSource && calibratedPronunciationScore > 6.5) {
    calibratedPronunciationScore = 6.5;
  }
  if (isProvisionalLikeSource(phase1Source) && calibratedGrammarScore > 6.5) {
    calibratedGrammarScore = 6.5;
  }

  const mergedBand = roundHalf(
    (lexicalScore + calibratedGrammarScore + fluencyScore + calibratedPronunciationScore) / 4,
  );

  const phase1Feedback = String(phase1Normalized?.general_feedback || "").trim();
  const phase2Feedback = String(phase2Normalized?.general_feedback || "").trim();
  const mergedGeneralFeedback = [phase1Feedback, phase2Feedback]
    .filter(Boolean)
    .join("\n")
    .trim();

  const mergedErrorLogs = dedupeErrorLogs([
    ...phaseErrorLogs,
    ...(shouldInjectGrammarProxyLogs ? proxyGrammarErrorLogs : []),
  ]);

  return normalizeAnalysisPayload({
    transcript: String(transcript || provisionalNormalized?.transcript || "").trim(),
    band_score: mergedBand,
    fluency_coherence: {
      score: fluencyScore,
      feedback: String(
        phase2Normalized?.fluency_coherence?.feedback
        || provisionalNormalized?.fluency_coherence?.feedback
        || "No fluency feedback.",
      ).trim(),
    },
    lexical_resource: {
      score: lexicalScore,
      feedback: String(
        phase1Normalized?.lexical_resource?.feedback
        || provisionalNormalized?.lexical_resource?.feedback
        || "No lexical feedback.",
      ).trim(),
    },
    grammatical_range: {
      score: calibratedGrammarScore,
      feedback: String(
        phase1Normalized?.grammatical_range?.feedback
        || provisionalNormalized?.grammatical_range?.feedback
        || "No grammar feedback.",
      ).trim(),
    },
    pronunciation: {
      score: calibratedPronunciationScore,
      feedback: String(
        phase2Normalized?.pronunciation?.feedback
        || provisionalNormalized?.pronunciation?.feedback
        || "No pronunciation feedback.",
      ).trim(),
    },
    general_feedback: mergedGeneralFeedback || provisionalNormalized?.general_feedback,
    sample_answer: phase1Normalized?.sample_answer || provisionalNormalized?.sample_answer,
    pronunciation_heatmap: Array.isArray(phase2Normalized?.pronunciation_heatmap) && phase2Normalized.pronunciation_heatmap.length > 0
      ? phase2Normalized.pronunciation_heatmap
      : provisionalNormalized?.pronunciation_heatmap,
    focus_areas: Array.isArray(phase2Normalized?.focus_areas) && phase2Normalized.focus_areas.length > 0
      ? phase2Normalized.focus_areas
      : provisionalNormalized?.focus_areas,
    intonation_pacing: phase2Normalized?.intonation_pacing || provisionalNormalized?.intonation_pacing,
    vocabulary_upgrades: Array.isArray(phase1Normalized?.vocabulary_upgrades) && phase1Normalized.vocabulary_upgrades.length > 0
      ? phase1Normalized.vocabulary_upgrades
      : provisionalNormalized?.vocabulary_upgrades,
    grammar_corrections: mergedGrammarCorrections,
    next_step: phase2Normalized?.next_step || provisionalNormalized?.next_step,
    error_logs: mergedErrorLogs,
  }, {
    topicPart,
    topicPrompt,
    transcriptFallback: transcript,
    fallbackWpm,
    pauseCount,
  });
};

export const scoreSpeakingPhase1ById = async ({ sessionId, force = false } = {}) => {
  const { session, topic } = await getSessionAndTopic(sessionId);
  console.log(JSON.stringify({
    event: "speaking_phase1_start",
    session_id: String(session?._id || sessionId),
    force: Boolean(force),
    scoring_state: String(session?.scoring_state || ""),
    status: String(session?.status || ""),
  }));
  if (
    !force
    && ["phase1_ready", "completed"].includes(String(session?.scoring_state || "").trim())
    && hasUsableAnalysisPayload(session?.phase1_analysis)
  ) {
    console.log(JSON.stringify({
      event: "speaking_phase1_skip_cached",
      session_id: String(session?._id || sessionId),
      scoring_state: String(session?.scoring_state || ""),
      phase1_source: String(session?.phase1_source || "cached"),
    }));
    return {
      session,
      phase1Analysis: session.phase1_analysis,
      phase1Source: session.phase1_source || "cached",
      skipped: true,
      fallbackUsed: false,
    };
  }

  const phaseStartAt = Date.now();
  const transcriptResult = await resolveCanonicalTranscript(session);
  const transcript = String(transcriptResult?.transcript || "").trim();

  if (transcript) {
    session.transcript = transcript;
  }

  const prompt = buildPhase1Prompt({
    transcript,
  });
  const phase1IncompleteRetryAttempts = Math.max(
    1,
    Number(process.env.SPEAKING_PHASE1_INCOMPLETE_RETRY_ATTEMPTS || 2),
  );

  let phase1Analysis;
  let phase1Source = "fallback";
  let fallbackUsed = false;

  try {
    if (!genAI) {
      throw new Error("Gemini API key is not configured");
    }

    let aiResponse = null;
    let acceptedPhase1Payload = null;
    let lastValidationReason = "";
    let previousRawResponse = "";

    for (let attempt = 1; attempt <= phase1IncompleteRetryAttempts; attempt += 1) {
      const attemptPrompt = attempt === 1
        ? prompt
        : buildPhase1RepairPrompt({
          transcript,
          previousRaw: previousRawResponse,
          reason: lastValidationReason,
        });

      const candidateResponse = await requestGeminiJsonWithFallback({
        genAI,
        models: SPEAKING_PHASE1_MODELS,
        contents: [attemptPrompt],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: SPEAKING_PHASE1_MAX_OUTPUT_TOKENS,
        },
        timeoutMs: SPEAKING_PHASE1_TIMEOUT_MS,
        maxAttempts: SPEAKING_GEMINI_MAX_ATTEMPTS,
      });

      const validation = validatePhase1AiPayload(candidateResponse?.data);
      const parsedKeys = Object.keys(candidateResponse?.data || {});
      previousRawResponse = String(candidateResponse?.rawText || "");
      const contractPayload = toPhase1ContractLogPayload(candidateResponse?.data);
      const missingContractFields = getPhase1ContractMissingFields(candidateResponse?.data);
      const parsedDataPreview = JSON.stringify(candidateResponse?.data || {}).slice(0, 1500);

      console.log(JSON.stringify({
        event: "speaking_phase1_raw_ai_response",
        session_id: String(session._id),
        attempt,
        max_attempts: phase1IncompleteRetryAttempts,
        model: candidateResponse?.model || null,
        token_usage: candidateResponse?.usage || null,
        input_tokens: candidateResponse?.usage?.input_tokens ?? null,
        output_tokens: candidateResponse?.usage?.output_tokens ?? null,
        total_tokens: candidateResponse?.usage?.total_tokens ?? null,
        raw_text_length: previousRawResponse.length,
        raw_text_preview: previousRawResponse.slice(0, 1500),
        parsed_keys: parsedKeys,
        payload_valid: validation.ok,
        invalid_reason: validation.ok ? null : validation.reason,
        missing_contract_fields: missingContractFields,
        phase1_contract_payload: contractPayload,
        parsed_data_preview: parsedDataPreview,
      }));

      if (validation.ok) {
        aiResponse = candidateResponse;
        acceptedPhase1Payload = validation.data;
        break;
      }

      lastValidationReason = validation.reason || "missing required keys";
      console.warn("Speaking phase1 AI payload incomplete, retrying:", {
        sessionId: String(session._id),
        attempt,
        maxAttempts: phase1IncompleteRetryAttempts,
        reason: lastValidationReason,
        parsedKeys,
      });
    }

    if (!acceptedPhase1Payload || !aiResponse) {
      const error = new Error(
        `Phase1 AI payload incomplete after ${phase1IncompleteRetryAttempts} attempt(s): ${lastValidationReason || "unknown"}`,
      );
      error.code = "MODEL_INCOMPLETE_PHASE1_PAYLOAD";
      throw error;
    }

    phase1Analysis = normalizePhase1Payload(acceptedPhase1Payload, {
      topicPart: topic.part,
      topicPrompt: topic.prompt,
    });
    phase1Source = aiResponse.model;
  } catch (error) {
    fallbackUsed = true;
    console.warn("Speaking phase1 fallback triggered:", {
      error: error.message,
      code: error.code || "",
      models: SPEAKING_PHASE1_MODELS,
    });
    console.log(JSON.stringify({
      event: "speaking_phase1_ai_error",
      session_id: String(session._id),
      error: String(error?.message || ""),
      code: String(error?.code || ""),
    }));

    if (hasUsableAnalysisPayload(session?.provisional_analysis)) {
      phase1Analysis = normalizePhase1Payload(session.provisional_analysis, {
        topicPart: topic.part,
        topicPrompt: topic.prompt,
      });
      phase1Source = session?.provisional_source
        ? `provisional:${session.provisional_source}`
        : "provisional_fallback";
    } else {
      const fallbackAnalysis = buildFallbackAnalysis(transcript, {
        topicPart: topic.part,
        topicPrompt: topic.prompt,
        fallbackWpm: Number(session?.metrics?.wpm || 0),
        pauseCount: Number(session?.metrics?.pauses?.pauseCount || 0),
      });
      phase1Analysis = normalizePhase1Payload(fallbackAnalysis, {
        topicPart: topic.part,
        topicPrompt: topic.prompt,
      });
    }
  }

  session.phase1_analysis = phase1Analysis;
  session.phase1_source = phase1Source;
  session.phase1_ready_at = new Date();
  if (String(session.status || "").trim().toLowerCase() !== "completed") {
    session.status = "processing";
  }
  if (String(session.scoring_state || "").trim().toLowerCase() !== "completed") {
    session.scoring_state = "phase1_ready";
  }
  await session.save();

  const submitTs = new Date(session.timestamp || session.createdAt || Date.now()).getTime();
  const submitToPhase1Ms = Number.isFinite(submitTs) ? Math.max(0, Date.now() - submitTs) : null;
  console.log(JSON.stringify({
    event: "speaking_phase1_ready",
    session_id: String(session._id),
    submit_to_phase1_ms: submitToPhase1Ms,
    phase1_latency_ms: Date.now() - phaseStartAt,
    model: phase1Source,
    fallback_used: fallbackUsed,
    transcript_source: transcriptResult?.source || null,
  }));

  return {
    session,
    phase1Analysis,
    phase1Source,
    fallbackUsed,
    skipped: false,
  };
};

export const scoreSpeakingPhase2ById = async ({ sessionId, force = false } = {}) => {
  const initial = await getSessionAndTopic(sessionId);
  let session = initial.session;
  const topic = initial.topic;
  if (session.status === "completed" && session.analysis?.band_score !== undefined && !force) {
    return {
      session,
      aiSource: session.ai_source || "cached",
      analysis: session.analysis,
      skipped: true,
      phase2FallbackUsed: false,
    };
  }

  if (!hasUsableAnalysisPayload(session?.phase1_analysis)) {
    const phase1Result = await scoreSpeakingPhase1ById({ sessionId, force: false });
    session = phase1Result?.session || session;
  }

  const phaseStartAt = Date.now();
  const cuePoints = resolveTopicCuePoints(topic);
  const clientWPM = Number(session?.metrics?.wpm || 0);
  const parsedMetrics = session?.metrics?.pauses || {};
  const clientTranscript = String(session.transcript || "").trim();
  const prompt = buildPhase2Prompt({
    topicPrompt: topic.prompt,
    topicPart: topic.part,
    subQuestions: cuePoints,
    transcript: clientTranscript,
    clientWPM,
    parsedMetrics,
  });

  let phase2Analysis;
  let phase2Source = "fallback";
  let phase2FallbackUsed = false;
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
        maxOutputTokens: SPEAKING_PHASE2_MAX_OUTPUT_TOKENS || SPEAKING_ANALYSIS_MAX_OUTPUT_TOKENS,
      },
      timeoutMs: SPEAKING_PHASE2_TIMEOUT_MS,
      maxAttempts: SPEAKING_GEMINI_MAX_ATTEMPTS,
    });
    console.log(JSON.stringify({
      event: "speaking_phase2_raw_ai_response",
      session_id: String(session._id),
      model: aiResponse?.model || null,
      token_usage: aiResponse?.usage || null,
      input_tokens: aiResponse?.usage?.input_tokens ?? null,
      output_tokens: aiResponse?.usage?.output_tokens ?? null,
      total_tokens: aiResponse?.usage?.total_tokens ?? null,
      raw_text_length: String(aiResponse?.rawText || "").length,
      parsed_keys: Object.keys(aiResponse?.data || {}),
    }));
    phase2Analysis = normalizePhase2Payload(aiResponse.data, {
      transcript: clientTranscript,
      fallbackWpm: clientWPM,
      pauseCount: parsedMetrics.pauseCount || 0,
    });
    phase2Source = aiResponse.model;
  } catch (aiError) {
    phase2FallbackUsed = true;
    console.error("Speaking phase2 fallback triggered:", {
      error: aiError.message,
      code: aiError.code || "",
      models: GEMINI_MODELS,
      mimeType: usedMimeType,
      audioBytes,
    });

    if (hasUsableAnalysisPayload(session?.provisional_analysis)) {
      phase2Analysis = normalizePhase2Payload(session.provisional_analysis, {
        transcript: clientTranscript,
        fallbackWpm: clientWPM,
        pauseCount: parsedMetrics.pauseCount || 0,
      });
      phase2Source = session?.provisional_source
        ? `provisional:${session.provisional_source}`
        : "provisional_fallback";
    } else {
      const fallbackAnalysis = buildFallbackAnalysis(clientTranscript, {
        topicPart: topic.part,
        topicPrompt: topic.prompt,
        fallbackWpm: clientWPM,
        pauseCount: parsedMetrics.pauseCount || 0,
      });
      phase2Analysis = normalizePhase2Payload(fallbackAnalysis, {
        transcript: clientTranscript,
        fallbackWpm: clientWPM,
        pauseCount: parsedMetrics.pauseCount || 0,
      });
    }
  }

  const analysis = mergeSpeakingPhaseAnalyses({
    phase1: session.phase1_analysis,
    phase1Source: session.phase1_source || "",
    phase2: phase2Analysis,
    phase2Source,
    provisional: session.provisional_analysis,
    topicPart: topic.part,
    topicPrompt: topic.prompt,
    transcript: clientTranscript,
    metrics: session.metrics || {},
  });

  const modelTranscript = String(analysis?.transcript || "").trim();
  session.transcript = clientTranscript || modelTranscript || "";
  session.analysis = analysis;
  session.phase1_analysis = pruneStoredPhase1Analysis(session.phase1_analysis);
  session.phase2_source = phase2Source;
  session.ai_source = phase2Source;
  session.error_logs = extractTaxonomyErrorLogs(analysis, topic.part);
  session.status = "completed";
  session.scoring_state = "completed";
  await session.save();

  const phase1ReadyTs = new Date(session.phase1_ready_at || session.timestamp || Date.now()).getTime();
  const submitTs = new Date(session.timestamp || session.createdAt || Date.now()).getTime();
  const submitToFinalMs = Number.isFinite(submitTs) ? Math.max(0, Date.now() - submitTs) : null;
  const phase1ToPhase2Ms = Number.isFinite(phase1ReadyTs) ? Math.max(0, Date.now() - phase1ReadyTs) : null;
  const provisionalBand = Number(session?.provisional_analysis?.band_score);
  const finalBand = Number(analysis?.band_score);
  const bandDiff = Number.isFinite(provisionalBand) && Number.isFinite(finalBand)
    ? Math.abs(finalBand - provisionalBand)
    : null;
  console.log(JSON.stringify({
    event: "speaking_phase2_ready",
    session_id: String(session._id),
    phase1_to_phase2_ms: phase1ToPhase2Ms,
    phase2_latency_ms: Date.now() - phaseStartAt,
    model: phase2Source,
    fallback_used: phase2FallbackUsed,
  }));
  console.log(JSON.stringify({
    event: "speaking_pipeline_completed",
    session_id: String(session._id),
    submit_to_final_ms: submitToFinalMs,
    provisional_final_band_diff: bandDiff,
    phase2_fallback_used: phase2FallbackUsed,
  }));
  console.log(JSON.stringify({
    event: "speaking_final_score_ready",
    session_id: String(session._id),
    submit_to_final_ms: submitToFinalMs,
    provisional_final_band_diff: bandDiff,
  }));

  void cleanupSessionAudioFromCloudinary(session).catch((cleanupError) => {
    console.warn("Cloudinary async cleanup wrapper failed:", cleanupError?.message || cleanupError);
  });

  return {
    session,
    aiSource: phase2Source,
    analysis,
    skipped: false,
    phase2FallbackUsed,
  };
};

export const scoreSpeakingSessionById = async ({ sessionId, force = false } = {}) => {
  await scoreSpeakingPhase1ById({ sessionId, force });
  return scoreSpeakingPhase2ById({ sessionId, force });
};

