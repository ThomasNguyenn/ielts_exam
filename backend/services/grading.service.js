import OpenAI from "openai";
import { requestOpenAIJsonWithFallback } from "../utils/aiClient.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const hasOpenAiCredentials = Boolean(OPENAI_API_KEY);

const WRITING_PIPELINE_PHASED_MODELS = String(process.env.WRITING_PIPELINE_PHASED_MODELS ?? "true")
  .trim()
  .toLowerCase() !== "false";

const normalizeTaskType = (value = "task2") =>
  String(value || "").trim().toLowerCase() === "task1" ? "task1" : "task2";

const normalizeModelName = (value) => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

const uniqModels = (...values) => {
  const unique = [];
  values.flat().forEach((value) => {
    const normalized = normalizeModelName(value);
    if (!normalized) return;
    if (!unique.includes(normalized)) {
      unique.push(normalized);
    }
  });
  return unique;
};

const WRITING_FAST_MODELS = uniqModels(
  process.env.WRITING_FAST_PRIMARY_MODEL,
  process.env.WRITING_FAST_MODEL,
  WRITING_PIPELINE_PHASED_MODELS ? "gpt-5-mini" : process.env.OPENAI_PRIMARY_MODEL,
  process.env.WRITING_FAST_FALLBACK_MODEL,
  process.env.OPENAI_FALLBACK_MODEL,
  "gpt-4o-mini",
);

const WRITING_DETAIL_MODELS = uniqModels(
  process.env.WRITING_DETAIL_PRIMARY_MODEL,
  WRITING_PIPELINE_PHASED_MODELS ? "gpt-4o-mini" : process.env.OPENAI_PRIMARY_MODEL,
  process.env.WRITING_DETAIL_FALLBACK_MODEL,
  process.env.OPENAI_FALLBACK_MODEL,
  "gpt-4o-mini",
);

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const WRITING_FAST_MAX_OUTPUT_TOKENS = Number(process.env.WRITING_FAST_MAX_OUTPUT_TOKENS || 850);
const WRITING_DETAIL_MAX_OUTPUT_TOKENS = Number(process.env.WRITING_DETAIL_MAX_OUTPUT_TOKENS || 2600);
const WRITING_DETAIL_RECOVERY_MAX_OUTPUT_TOKENS = Number(process.env.WRITING_DETAIL_RECOVERY_MAX_OUTPUT_TOKENS || 900);
const WRITING_FAST_TIMEOUT_MS = Number(process.env.WRITING_FAST_TIMEOUT_MS || process.env.OPENAI_TIMEOUT_MS || 22000);
const WRITING_DETAIL_TIMEOUT_MS = Number(process.env.WRITING_DETAIL_TIMEOUT_MS || process.env.OPENAI_TIMEOUT_MS || 45000);
const WRITING_DETAIL_RECOVERY_TIMEOUT_MS = Number(process.env.WRITING_DETAIL_RECOVERY_TIMEOUT_MS || 28000);
const WRITING_FAST_MAX_ATTEMPTS = Number(process.env.WRITING_FAST_MAX_ATTEMPTS || process.env.OPENAI_MAX_ATTEMPTS || 2);
const WRITING_DETAIL_MAX_ATTEMPTS = Number(process.env.WRITING_DETAIL_MAX_ATTEMPTS || process.env.OPENAI_MAX_ATTEMPTS || 2);
const WRITING_DETAIL_RECOVERY_MAX_ATTEMPTS = Number(process.env.WRITING_DETAIL_RECOVERY_MAX_ATTEMPTS || 1);
const WRITING_FAST_PASS_COUNT = Math.max(1, Math.min(3, Number(process.env.WRITING_FAST_PASS_COUNT || 2)));
const WRITING_FAST_DOUBLE_PASS = toBoolean(process.env.WRITING_FAST_DOUBLE_PASS, true);
const WRITING_DETAIL_GRA_LR_EXHAUSTIVE = toBoolean(process.env.WRITING_DETAIL_GRA_LR_EXHAUSTIVE, true);
const WRITING_DETAIL_GRA_LR_EXTRA_PASSES = Math.max(0, Math.min(3, Number(process.env.WRITING_DETAIL_GRA_LR_EXTRA_PASSES || 1)));
const WRITING_DETAIL_MAX_ISSUES_PER_CRITERION = Math.max(20, Number(process.env.WRITING_DETAIL_MAX_ISSUES_PER_CRITERION || 200));

const CRITERIA_KEYS = [
  "task_response",
  "coherence_cohesion",
  "lexical_resource",
  "grammatical_range_accuracy",
];

const toArray = (value) => (Array.isArray(value) ? value : []);

const toBandHalfStep = (value, fallback = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const clamped = Math.max(0, Math.min(9, numeric));
  return Math.round(clamped * 2) / 2;
};

const toPerformanceLabel = (bandScore) => {
  const score = Number(bandScore || 0);
  if (score >= 7) return "Strong";
  if (score >= 6) return "Developing";
  return "Needs Improvement";
};

const countWords = (text = "") => String(text || "")
  .trim()
  .split(/\s+/)
  .filter(Boolean).length;

const getDetailExtractionTargets = (taskType = "task2", essayText = "") => {
  const words = countWords(essayText);
  if (normalizeTaskType(taskType) === "task1") {
    if (words >= 180) return { gra: 5, lexical: 4 };
    if (words >= 140) return { gra: 4, lexical: 3 };
    return { gra: 3, lexical: 2 };
  }

  if (words >= 280) return { gra: 10, lexical: 8 };
  if (words >= 220) return { gra: 8, lexical: 6 };
  if (words >= 170) return { gra: 6, lexical: 5 };
  return { gra: 4, lexical: 3 };
};

const normalizeCriteriaScores = (rawScores = {}, fallbackBand = 0) => {
  const safeBand = toBandHalfStep(fallbackBand, 0);
  return {
    task_response: toBandHalfStep(rawScores.task_response, safeBand),
    coherence_cohesion: toBandHalfStep(rawScores.coherence_cohesion, safeBand),
    lexical_resource: toBandHalfStep(rawScores.lexical_resource, safeBand),
    grammatical_range_accuracy: toBandHalfStep(rawScores.grammatical_range_accuracy, safeBand),
  };
};

const normalizeCriteriaNotes = (rawNotes = {}) => ({
  task_response: String(rawNotes.task_response || "").trim(),
  coherence_cohesion: String(rawNotes.coherence_cohesion || "").trim(),
  lexical_resource: String(rawNotes.lexical_resource || "").trim(),
  grammatical_range_accuracy: String(rawNotes.grammatical_range_accuracy || "").trim(),
});

const normalizeTopIssue = (item = {}) => ({
  text_snippet: String(item?.text_snippet || "").trim(),
  explanation: String(item?.explanation || "").trim(),
  improved: String(item?.improved || "").trim(),
  error_code: String(item?.error_code || "NONE").trim() || "NONE",
});

const normalizeFastTopIssues = (rawTopIssues = {}) => {
  const mapIssues = (items = []) => toArray(items)
    .map(normalizeTopIssue)
    .filter((item) => item.text_snippet)
    .slice(0, 5);

  return {
    grammatical_range_accuracy: mapIssues(rawTopIssues?.grammatical_range_accuracy || []),
    lexical_resource: mapIssues(rawTopIssues?.lexical_resource || []),
  };
};

const normalizeFastEssayResult = (raw = {}, model = null) => {
  const rawCriteria = normalizeCriteriaScores(raw.criteria_scores || {}, raw.band_score || 0);
  const criteriaAvg = CRITERIA_KEYS.reduce((sum, key) => sum + Number(rawCriteria[key] || 0), 0) / CRITERIA_KEYS.length;
  const bandScore = toBandHalfStep(raw.band_score, toBandHalfStep(criteriaAvg, 0));
  const summary = String(raw.summary || "").trim();

  const normalized = {
    band_score: bandScore,
    criteria_scores: rawCriteria,
    summary,
    criteria_notes: normalizeCriteriaNotes(raw.criteria_notes || {}),
    top_issues: normalizeFastTopIssues(raw.top_issues || {}),
    performance_label: String(raw.performance_label || "").trim() || toPerformanceLabel(bandScore),
    feedback: toArray(raw.feedback)
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 3),
    model: model || null,
  };

  if (!normalized.summary) {
    normalized.summary = normalized.feedback[0] || "Fast scoring completed.";
  }
  if (normalized.feedback.length === 0) {
    normalized.feedback = [normalized.summary];
  }

  return normalized;
};

const averageBands = (values = [], fallback = 0) => {
  const numericValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (numericValues.length === 0) return toBandHalfStep(fallback, 0);
  const avg = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
  return toBandHalfStep(avg, toBandHalfStep(fallback, 0));
};

const dedupeFastIssueItems = (items = []) => {
  const output = [];
  const seen = new Set();

  toArray(items).forEach((item) => {
    const normalized = normalizeTopIssue(item);
    const key = `${normalized.text_snippet.toLowerCase()}::${normalized.improved.toLowerCase()}::${normalized.explanation.toLowerCase()}`;
    if (!normalized.text_snippet || seen.has(key)) return;
    seen.add(key);
    output.push(normalized);
  });

  return output;
};

const averageFastEssayResults = (results = []) => {
  const normalizedResults = toArray(results).filter(Boolean);
  if (normalizedResults.length === 0) return normalizeFastEssayResult({});
  if (normalizedResults.length === 1) return normalizedResults[0];

  const averagedBand = averageBands(normalizedResults.map((result) => result.band_score), 0);
  const averagedCriteria = normalizeCriteriaScores({
    task_response: averageBands(normalizedResults.map((result) => result?.criteria_scores?.task_response), averagedBand),
    coherence_cohesion: averageBands(normalizedResults.map((result) => result?.criteria_scores?.coherence_cohesion), averagedBand),
    lexical_resource: averageBands(normalizedResults.map((result) => result?.criteria_scores?.lexical_resource), averagedBand),
    grammatical_range_accuracy: averageBands(normalizedResults.map((result) => result?.criteria_scores?.grammatical_range_accuracy), averagedBand),
  }, averagedBand);

  const mergedFeedback = dedupeIssues(
    normalizedResults.flatMap((result) => toArray(result?.feedback).map((entry) => ({ text_snippet: String(entry || "").trim() }))),
  ).map((item) => item.text_snippet).filter(Boolean).slice(0, 3);

  const summary = normalizedResults
    .map((result) => String(result?.summary || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  const criteriaNotes = CRITERIA_KEYS.reduce((acc, key) => {
    const merged = normalizedResults
      .map((result) => String(result?.criteria_notes?.[key] || "").trim())
      .filter(Boolean)
      .join(" ")
      .trim();
    acc[key] = merged;
    return acc;
  }, {});

  const topIssues = {
    grammatical_range_accuracy: dedupeFastIssueItems(
      normalizedResults.flatMap((result) => toArray(result?.top_issues?.grammatical_range_accuracy)),
    ).slice(0, 5),
    lexical_resource: dedupeFastIssueItems(
      normalizedResults.flatMap((result) => toArray(result?.top_issues?.lexical_resource)),
    ).slice(0, 5),
  };

  return normalizeFastEssayResult({
    band_score: averagedBand,
    criteria_scores: averagedCriteria,
    summary,
    criteria_notes: criteriaNotes,
    top_issues: topIssues,
    performance_label: toPerformanceLabel(averagedBand),
    feedback: mergedFeedback,
  }, normalizedResults.map((result) => result.model).filter(Boolean).join("|") || null);
};

const normalizeIssue = (item = {}, { criterionKey = "", defaultCode = "NONE" } = {}) => {
  const rawSnippet = String(item?.text_snippet || "").trim();
  const compactSnippet = (criterionKey === "lexical_resource" || criterionKey === "grammatical_range_accuracy")
    ? toCompactReferenceSnippet(rawSnippet || String(item?.improved || "").trim(), { maxWords: 4 })
    : rawSnippet;

  const base = {
    text_snippet: compactSnippet,
    type: String(item?.type || "error").trim() || "error",
    error_code: String(item?.error_code || defaultCode).trim() || defaultCode,
    explanation: String(item?.explanation || "").trim(),
    improved: String(item?.improved || "").trim(),
    band_impact: String(item?.band_impact || "").trim(),
  };

  if (criterionKey === "lexical_resource") {
    return {
      ...base,
      lexical_unit: String(item?.lexical_unit || "word").trim() || "word",
      source_level: String(item?.source_level || "UNKNOWN").trim() || "UNKNOWN",
      target_level: String(item?.target_level || "UNKNOWN").trim() || "UNKNOWN",
      b2_replacement: String(item?.b2_replacement || "").trim(),
      c1_replacement: String(item?.c1_replacement || "").trim(),
      band6_replacement: String(item?.band6_replacement || "").trim(),
      band65_replacement: String(item?.band65_replacement || "").trim(),
    };
  }

  return base;
};

const getDefaultShortIssue = (criterionKey, taskType) => {
  if (criterionKey === "task_response") {
    return {
      text_snippet: "Overall response",
      type: "suggestion",
      error_code: "NONE",
      explanation: normalizeTaskType(taskType) === "task1"
        ? "Can bo sung tong quan ro rang hon de nhan manh xu huong chinh."
        : "Can neu lap truong ro hon va mo rong y bang vi du cu the.",
      improved: "Them 1-2 cau tom tat quan diem va phat trien y chinh.",
      band_impact: "Supports TR improvement",
    };
  }

  return {
    text_snippet: "Overall organization",
    type: "suggestion",
    error_code: "NONE",
    explanation: "Can toi uu lien ket giua cac cau va giua cac doan de dong chay logic ro hon.",
    improved: "Dung cau chu de ro rang va lien tu phu hop theo logic y.",
    band_impact: "Supports CC improvement",
  };
};

const normalizeDetailEssayResult = (raw = {}, { taskType = "task2", model = null, essayText = "" } = {}) => {
  const normalizedTaskType = normalizeTaskType(taskType);
  const criteria = normalizeCriteriaScores(raw.criteria_scores || {}, raw.band_score || 0);
  const bandScore = toBandHalfStep(raw.band_score, 0);
  const totalWords = countWords(essayText);
  const estimatedCeiling = totalWords > 0 ? Math.max(40, totalWords * 2) : WRITING_DETAIL_MAX_ISSUES_PER_CRITERION;
  const maxIssuesPerCriterion = Math.max(
    20,
    Math.min(WRITING_DETAIL_MAX_ISSUES_PER_CRITERION, estimatedCeiling),
  );

  const taskResponse = toArray(raw.task_response)
    .map((item) => normalizeIssue(item, { criterionKey: "task_response" }))
    .filter((item) => item.text_snippet || item.explanation)
    .slice(0, 2);

  const coherence = toArray(raw.coherence_cohesion)
    .map((item) => normalizeIssue(item, { criterionKey: "coherence_cohesion" }))
    .filter((item) => item.text_snippet || item.explanation)
    .slice(0, 2);

  const lexical = toArray(raw.lexical_resource)
    .map((item) => normalizeIssue(item, {
      criterionKey: "lexical_resource",
      defaultCode: normalizedTaskType === "task1" ? "W1-L1" : "W2-L1",
    }))
    .filter((item) => item.text_snippet || item.explanation)
    .slice(0, maxIssuesPerCriterion);

  const grammar = toArray(raw.grammatical_range_accuracy)
    .map((item) => normalizeIssue(item, {
      criterionKey: "grammatical_range_accuracy",
      defaultCode: normalizedTaskType === "task1" ? "W1-G1" : "W2-G1",
    }))
    .filter((item) => item.text_snippet || item.explanation)
    .slice(0, maxIssuesPerCriterion);

  return {
    band_score: bandScore,
    criteria_scores: criteria,
    task_response: taskResponse.length > 0 ? taskResponse : [getDefaultShortIssue("task_response", normalizedTaskType)],
    coherence_cohesion: coherence.length > 0 ? coherence : [getDefaultShortIssue("coherence_cohesion", normalizedTaskType)],
    lexical_resource: lexical,
    grammatical_range_accuracy: grammar,
    feedback: toArray(raw.feedback)
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 3),
    model: model || null,
  };
};

const isErrorIssue = (issue = {}) => String(issue?.type || "error").trim().toLowerCase() === "error";

const countErrorIssues = (items = []) => toArray(items).filter(isErrorIssue).length;

const issueIdentity = (issue = {}) => {
  const snippet = String(issue?.text_snippet || "").trim().toLowerCase();
  const improved = String(issue?.improved || "").trim().toLowerCase();
  const explanation = String(issue?.explanation || "").trim().toLowerCase();
  return `${snippet}::${improved}::${explanation}`;
};

const dedupeIssues = (items = []) => {
  const seen = new Set();
  const output = [];
  toArray(items).forEach((item) => {
    const key = issueIdentity(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    output.push(item);
  });
  return output;
};

const toCompactReferenceSnippet = (value = "", { maxWords = 4 } = {}) => {
  const cleaned = String(value || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "";

  const words = cleaned.split(" ").filter(Boolean);
  if (words.length <= maxWords && !/[.!?]/.test(cleaned)) {
    return cleaned;
  }

  const quotedMatches = cleaned.match(/["“”']([^"“”']+)["“”']/g) || [];
  const quotedCandidates = quotedMatches
    .map((segment) => segment.replace(/["“”']/g, "").trim())
    .filter(Boolean)
    .sort((a, b) => a.length - b.length);
  const compactQuoted = quotedCandidates.find((segment) => segment.split(/\s+/).length <= maxWords);
  if (compactQuoted) return compactQuoted;

  const phraseCandidates = cleaned
    .split(/[,:;.!?]/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .sort((a, b) => a.length - b.length);
  const compactPhrase = phraseCandidates.find((segment) => segment.split(/\s+/).length <= maxWords);
  if (compactPhrase) return compactPhrase;

  return words.slice(0, maxWords).join(" ");
};

const shouldRunGraLrRecovery = ({ normalizedResult, essayText, targets }) => {
  if (!String(essayText || "").trim()) return false;
  if (!WRITING_DETAIL_GRA_LR_EXHAUSTIVE || WRITING_DETAIL_GRA_LR_EXTRA_PASSES < 1) return false;
  const graErrors = countErrorIssues(normalizedResult?.grammatical_range_accuracy || []);
  const lrErrors = countErrorIssues(normalizedResult?.lexical_resource || []);
  const graTarget = Math.max(1, Number(targets?.gra || 1));
  const lrTarget = Math.max(1, Number(targets?.lexical || 1));
  return graErrors < graTarget || lrErrors < lrTarget || WRITING_DETAIL_GRA_LR_EXHAUSTIVE;
};

const buildGraLrRecoveryPrompt = ({
  promptText,
  essayText,
  taskType,
  targets,
  passIndex = 1,
  existingGra = [],
  existingLr = [],
}) => {
  const normalizedTaskType = normalizeTaskType(taskType);
  const grammarCodeHint = normalizedTaskType === "task1"
    ? "W1-G1/W1-G2/W1-G3/W1-G4"
    : "W2-G1/W2-G2/W2-G3";
  const lexicalCodeHint = normalizedTaskType === "task1"
    ? "W1-L1/W1-L2/W1-L3"
    : "W2-L1/W2-L2/W2-L3";

  return `
You are an IELTS writing error extractor.
Focus ONLY on Grammar and Lexical errors.
Return strict JSON only.
Pass ${passIndex} for exhaustive extraction of remaining errors.

Prompt:
${String(promptText || "").trim()}

Student Essay:
${String(essayText || "").trim()}

Current extracted snippets (do not duplicate):
- grammar: ${JSON.stringify(existingGra)}
- lexical: ${JSON.stringify(existingLr)}

Targets:
- grammar errors >= ${targets.gra}
- lexical errors >= ${targets.lexical}

Rules:
- Return only actionable error items.
- Keep one item for one error.
- Enumerate as many remaining errors as possible (do not stop at minimum target).
- Include repeated mistakes if they appear in different positions.
- text_snippet should be token/phrase length 1-4 words only (no full sentence).
- Use concise Vietnamese explanations.

Return JSON:
{
  "grammatical_range_accuracy": [
    {
      "text_snippet": "string",
      "type": "error",
      "error_code": "${grammarCodeHint}",
      "explanation": "string",
      "improved": "string",
      "band_impact": "string"
    }
  ],
  "lexical_resource": [
    {
      "text_snippet": "string",
      "type": "error",
      "error_code": "${lexicalCodeHint}",
      "explanation": "string",
      "improved": "string",
      "lexical_unit": "word|collocation",
      "source_level": "A2|B1|B2|C1|C2|UNKNOWN",
      "target_level": "B2|C1|C2|UNKNOWN",
      "b2_replacement": "string",
      "c1_replacement": "string",
      "band6_replacement": "string",
      "band65_replacement": "string",
      "band_impact": "string"
    }
  ]
}
`;
};

const recoverGraLrIssues = async ({
  promptText,
  essayText,
  taskType,
  targets,
  normalizedResult,
  passIndex = 1,
}) => {
  const maxIssueLimit = Math.max(20, WRITING_DETAIL_MAX_ISSUES_PER_CRITERION);
  const existingGra = toArray(normalizedResult?.grammatical_range_accuracy)
    .map((item) => String(item?.text_snippet || "").trim())
    .filter(Boolean)
    .slice(0, maxIssueLimit);
  const existingLr = toArray(normalizedResult?.lexical_resource)
    .map((item) => String(item?.text_snippet || "").trim())
    .filter(Boolean)
    .slice(0, maxIssueLimit);

  const recoveryPrompt = buildGraLrRecoveryPrompt({
    promptText,
    essayText,
    taskType,
    targets,
    passIndex,
    existingGra,
    existingLr,
  });

  const recoveryResponse = await requestOpenAIJsonWithFallback({
    openai,
    models: WRITING_DETAIL_MODELS,
    createPayload: (model) => ({
      model,
      messages: [{ role: "user", content: buildTextMessage(recoveryPrompt) }],
      ...toTokenPayload(model, WRITING_DETAIL_RECOVERY_MAX_OUTPUT_TOKENS),
      response_format: { type: "json_object" },
    }),
    timeoutMs: WRITING_DETAIL_RECOVERY_TIMEOUT_MS,
    maxAttempts: WRITING_DETAIL_RECOVERY_MAX_ATTEMPTS,
  });

  const normalizedRecovery = normalizeDetailEssayResult(recoveryResponse?.data || {}, {
    taskType,
    model: recoveryResponse?.model || null,
    essayText,
  });

  const mergedGra = dedupeIssues([
    ...toArray(normalizedResult?.grammatical_range_accuracy),
    ...toArray(normalizedRecovery?.grammatical_range_accuracy),
  ]).slice(0, maxIssueLimit);
  const mergedLr = dedupeIssues([
    ...toArray(normalizedResult?.lexical_resource),
    ...toArray(normalizedRecovery?.lexical_resource),
  ]).slice(0, maxIssueLimit);

  return {
    ...normalizedResult,
    grammatical_range_accuracy: mergedGra,
    lexical_resource: mergedLr,
  };
};

const buildTextMessage = (prompt) => [{ type: "text", text: prompt }];

const toTokenPayload = (model, maxOutputTokens) => {
  if (/^gpt-5/i.test(String(model || "").trim())) {
    return { max_completion_tokens: maxOutputTokens };
  }
  return { max_tokens: maxOutputTokens };
};

const buildFastPrompt = ({ promptText, essayText, taskType, passIndex = 1, totalPasses = 1 }) => {
  const taskLabel = normalizeTaskType(taskType) === "task1"
    ? "IELTS Writing Task 1"
    : "IELTS Writing Task 2";

  return `
You are an IELTS writing examiner.
Fast mode objective: estimate score quickly with low latency.
Evaluation pass: ${passIndex}/${totalPasses}

Task Type: ${taskLabel}
Prompt:
${String(promptText || "").trim()}

Student Essay:
${String(essayText || "").trim()}

Return strict JSON only with this schema:
{
  "band_score": number,
  "criteria_scores": {
    "task_response": number,
    "coherence_cohesion": number,
    "lexical_resource": number,
    "grammatical_range_accuracy": number
  },
  "summary": "string (2-4 sentences)",
  "criteria_notes": {
    "task_response": "string",
    "coherence_cohesion": "string",
    "lexical_resource": "string",
    "grammatical_range_accuracy": "string"
  },
  "top_issues": {
    "grammatical_range_accuracy": [],
    "lexical_resource": []
  },
  "performance_label": "Strong|Developing|Needs Improvement",
  "feedback": ["string", "string"]
}

Rules:
- Scores must be in 0.5 steps, range 0..9.
- Keep each criteria note concise.
- Keep output short; no detailed extraction in fast mode.
`; 
};

const buildDetailPrompt = ({ promptText, essayText, taskType, targets }) => {
  const normalizedTaskType = normalizeTaskType(taskType);
  const taskLabel = normalizedTaskType === "task1" ? "IELTS Writing Task 1" : "IELTS Writing Task 2";
  const trCodeHint = normalizedTaskType === "task1"
    ? "W1-T1/W1-T2/W1-T3/W1-T4"
    : "W2-T1/W2-T2/W2-T3/W2-T4";
  const ccCodeHint = normalizedTaskType === "task1"
    ? "W1-C1/W1-C2/W1-C3/W1-C4"
    : "W2-C1/W2-C2/W2-C3";
  const lrCodeHint = normalizedTaskType === "task1"
    ? "W1-L1/W1-L2/W1-L3"
    : "W2-L1/W2-L2/W2-L3";
  const graCodeHint = normalizedTaskType === "task1"
    ? "W1-G1/W1-G2/W1-G3/W1-G4"
    : "W2-G1/W2-G2/W2-G3";

  return `
You are an IELTS writing detail extractor.
Primary focus: actionable Grammar (GRA) and Lexical Resource (LR) issues.
Secondary focus: concise Task Response (TR) and Coherence & Cohesion (CC) notes.

Task Type: ${taskLabel}
Prompt:
${String(promptText || "").trim()}

Student Essay:
${String(essayText || "").trim()}

Extraction requirements:
- GRA: prioritize concrete grammar errors, target at least ${targets.gra} issues when evidence is available.
- LR: prioritize word choice/collocation/spelling/word form, target at least ${targets.lexical} issues when evidence is available.
- Exhaustive mode: list as many valid GRA/LR errors as possible across the essay.
- TR and CC: always return short notes (1-2 items each).
- One issue item should focus on one correction.
- For GRA/LR, text_snippet must be a compact reference token/phrase (1-4 words), not a whole sentence.
- Keep explanation concise in Vietnamese.

Return strict JSON only:
{
  "band_score": number,
  "criteria_scores": {
    "task_response": number,
    "coherence_cohesion": number,
    "lexical_resource": number,
    "grammatical_range_accuracy": number
  },
  "task_response": [
    {
      "text_snippet": "string",
      "type": "error|suggestion|good",
      "error_code": "${trCodeHint}|NONE",
      "explanation": "string",
      "improved": "string",
      "band_impact": "string"
    }
  ],
  "coherence_cohesion": [
    {
      "text_snippet": "string",
      "type": "error|suggestion|good",
      "error_code": "${ccCodeHint}|NONE",
      "explanation": "string",
      "improved": "string",
      "band_impact": "string"
    }
  ],
  "lexical_resource": [
    {
      "text_snippet": "string",
      "type": "error|suggestion|good",
      "error_code": "${lrCodeHint}|NONE",
      "explanation": "string",
      "improved": "string",
      "lexical_unit": "word|collocation",
      "source_level": "A2|B1|B2|C1|C2|UNKNOWN",
      "target_level": "B2|C1|C2|UNKNOWN",
      "b2_replacement": "string",
      "c1_replacement": "string",
      "band6_replacement": "string",
      "band65_replacement": "string",
      "band_impact": "string"
    }
  ],
  "grammatical_range_accuracy": [
    {
      "text_snippet": "string",
      "type": "error|suggestion|good",
      "error_code": "${graCodeHint}|NONE",
      "explanation": "string",
      "improved": "string",
      "band_impact": "string"
    }
  ],
  "feedback": ["string", "string"]
}
`; 
};

export const gradeEssayFastBand = async (promptText, essayText, taskType = "task2", imageUrl = null) => {
  const normalizedTaskType = normalizeTaskType(taskType);
  const trimmedEssay = String(essayText || "").trim();
  const passCount = WRITING_FAST_DOUBLE_PASS ? Math.max(2, WRITING_FAST_PASS_COUNT) : 1;

  if (!trimmedEssay) {
    return normalizeFastEssayResult({
      band_score: 0,
      criteria_scores: {
        task_response: 0,
        coherence_cohesion: 0,
        lexical_resource: 0,
        grammatical_range_accuracy: 0,
      },
      summary: "Essay content is empty.",
      criteria_notes: {
        task_response: "No response content found.",
        coherence_cohesion: "No response content found.",
        lexical_resource: "No response content found.",
        grammatical_range_accuracy: "No response content found.",
      },
      top_issues: {
        grammatical_range_accuracy: [],
        lexical_resource: [],
      },
      performance_label: "Needs Improvement",
      feedback: ["Essay content is empty."],
    }, WRITING_FAST_MODELS[0] || "gpt-5-mini");
  }

  try {
    if (!hasOpenAiCredentials) {
      throw new Error("OpenAI API key is not configured");
    }

    const runSingleFastPass = async (passIndex) => {
      const messages = buildTextMessage(buildFastPrompt({
        promptText,
        essayText: trimmedEssay,
        taskType: normalizedTaskType,
        passIndex,
        totalPasses: passCount,
      }));

      if (imageUrl && normalizedTaskType === "task1") {
        messages.push({
          type: "image_url",
          image_url: { url: imageUrl },
        });
      }

      const aiResponse = await requestOpenAIJsonWithFallback({
        openai,
        models: WRITING_FAST_MODELS,
        createPayload: (model) => ({
          model,
          messages: [{ role: "user", content: messages }],
          ...toTokenPayload(model, WRITING_FAST_MAX_OUTPUT_TOKENS),
          response_format: { type: "json_object" },
        }),
        timeoutMs: WRITING_FAST_TIMEOUT_MS,
        maxAttempts: WRITING_FAST_MAX_ATTEMPTS,
      });

      return normalizeFastEssayResult(aiResponse.data, aiResponse.model);
    };

    const passSettled = await Promise.allSettled(
      Array.from({ length: passCount }, (_, index) => runSingleFastPass(index + 1)),
    );

    const fulfilled = passSettled
      .filter((entry) => entry.status === "fulfilled")
      .map((entry) => entry.value);

    if (fulfilled.length === 0) {
      const rejected = passSettled.find((entry) => entry.status === "rejected");
      throw (rejected?.reason || new Error("Fast scoring failed for all passes"));
    }

    return averageFastEssayResults(fulfilled);
  } catch (error) {
    console.error("gradeEssayFastBand fallback triggered:", error.message);
    return normalizeFastEssayResult({
      band_score: 0,
      criteria_scores: {
        task_response: 0,
        coherence_cohesion: 0,
        lexical_resource: 0,
        grammatical_range_accuracy: 0,
      },
      summary: "AI fast scoring is temporarily unavailable.",
      criteria_notes: {
        task_response: "",
        coherence_cohesion: "",
        lexical_resource: "",
        grammatical_range_accuracy: "",
      },
      top_issues: {
        grammatical_range_accuracy: [],
        lexical_resource: [],
      },
      performance_label: "Needs Improvement",
      feedback: ["AI fast scoring is temporarily unavailable."],
    }, WRITING_FAST_MODELS[0] || "gpt-5-mini");
  }
};

export const extractWritingDetailIssues = async (promptText, essayText, taskType = "task2", imageUrl = null) => {
  const normalizedTaskType = normalizeTaskType(taskType);
  const detailTargets = getDetailExtractionTargets(normalizedTaskType, essayText);

  try {
    if (!hasOpenAiCredentials) {
      throw new Error("OpenAI API key is not configured");
    }

    const messages = buildTextMessage(buildDetailPrompt({
      promptText,
      essayText,
      taskType: normalizedTaskType,
      targets: detailTargets,
    }));

    if (imageUrl && normalizedTaskType === "task1") {
      messages.push({
        type: "image_url",
        image_url: { url: imageUrl },
      });
    }

    const aiResponse = await requestOpenAIJsonWithFallback({
      openai,
      models: WRITING_DETAIL_MODELS,
      createPayload: (model) => ({
        model,
        messages: [{ role: "user", content: messages }],
        ...toTokenPayload(model, WRITING_DETAIL_MAX_OUTPUT_TOKENS),
        response_format: { type: "json_object" },
      }),
      timeoutMs: WRITING_DETAIL_TIMEOUT_MS,
      maxAttempts: WRITING_DETAIL_MAX_ATTEMPTS,
    });

    const normalizedDetail = normalizeDetailEssayResult(aiResponse.data || {}, {
      taskType: normalizedTaskType,
      model: aiResponse.model,
      essayText,
    });

    if (!shouldRunGraLrRecovery({ normalizedResult: normalizedDetail, essayText, targets: detailTargets })) {
      return normalizedDetail;
    }

    let enrichedDetail = normalizedDetail;
    for (let passIndex = 1; passIndex <= WRITING_DETAIL_GRA_LR_EXTRA_PASSES; passIndex += 1) {
      try {
        const beforeGraCount = countErrorIssues(enrichedDetail?.grammatical_range_accuracy || []);
        const beforeLrCount = countErrorIssues(enrichedDetail?.lexical_resource || []);
        const recovered = await recoverGraLrIssues({
          promptText,
          essayText,
          taskType: normalizedTaskType,
          targets: detailTargets,
          normalizedResult: enrichedDetail,
          passIndex,
        });
        const afterGraCount = countErrorIssues(recovered?.grammatical_range_accuracy || []);
        const afterLrCount = countErrorIssues(recovered?.lexical_resource || []);
        enrichedDetail = recovered;

        if (afterGraCount <= beforeGraCount && afterLrCount <= beforeLrCount) {
          break;
        }
      } catch (recoveryError) {
        console.warn("extractWritingDetailIssues GRA/LR recovery skipped:", recoveryError.message);
        break;
      }
    }
    return enrichedDetail;
  } catch (error) {
    console.error("extractWritingDetailIssues fallback triggered:", error.message);
    return normalizeDetailEssayResult({
      band_score: 0,
      criteria_scores: {
        task_response: 0,
        coherence_cohesion: 0,
        lexical_resource: 0,
        grammatical_range_accuracy: 0,
      },
      task_response: [],
      coherence_cohesion: [],
      lexical_resource: [],
      grammatical_range_accuracy: [],
      feedback: ["He thong tam thoi khong cham chi tiet duoc bai viet. Vui long thu lai sau."],
    }, {
      taskType: normalizedTaskType,
      model: WRITING_DETAIL_MODELS[0] || "gpt-4o-mini",
      essayText,
    });
  }
};

// Backward-compatible exports
export const gradeEssayFast = gradeEssayFastBand;
export const gradeEssay = extractWritingDetailIssues;
