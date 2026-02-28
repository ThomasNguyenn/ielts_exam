import OpenAI from "openai";
import {
  getWritingTaxonomyAiBatchSize,
  getWritingTaxonomyAiMaxTokens,
  getWritingTaxonomyAiTemperature,
  getWritingTaxonomyBaseDelayMs,
  getWritingTaxonomyMaxAttempts,
  getWritingTaxonomyModel,
  getWritingTaxonomyTimeoutMs,
  isWritingTaxonomyAiFallbackEnabled,
} from "../config/queue.config.js";
import WritingSubmission from "../models/WritingSubmission.model.js";
import Writing from "../models/Writing.model.js";
import { requestOpenAIJsonWithFallback } from "../utils/aiClient.js";
import {
  createTaxonomyErrorLog,
  listErrorCodesForSkill,
  listErrorCodesForSkillAndQuestionType,
} from "./taxonomy.registry.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPEN_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const TRACKED_CRITERIA_KEYS = new Set(["lexical_resource", "grammatical_range_accuracy"]);
const MIN_CONFIDENCE_FOR_LOG = 0.55;

const MINOR_MARKERS = [
  "minor",
  "nhe",
  "khong dang ke",
  "it anh huong",
  "low impact",
  "small impact",
];

const PRAISE_MARKERS = [
  "well done",
  "excellent",
  "good job",
  "strong point",
  "diem manh",
  "lam tot",
  "rat tot",
  "kha tot",
  "very good",
];

const LEXICAL_MARKERS = [
  "spelling",
  "chinh ta",
  "word choice",
  "word form",
  "collocation",
  "vocabulary",
  "tu vung",
  "lexical",
  "typo",
  "misspell",
  "dung tu",
];

const REPEAT_MARKERS = ["repeat", "repetition", "lap", "duplicat"];
const INFORMAL_MARKERS = ["informal", "too casual", "register", "khong trang trong", "colloquial"];
const COLLOCATION_MARKERS = ["collocation", "unnatural phrase", "word combination"];
const WORD_CHOICE_MARKERS = ["word choice", "inaccurate", "misuse", "khong dung nghia", "vocabulary"];
const SPELLING_MARKERS = ["spelling", "typo", "misspell", "chinh ta"];
const TENSE_MARKERS = ["tense", "thi", "past", "present", "future"];
const AGREEMENT_MARKERS = ["agreement", "subject-verb", "sva", "so it", "singular", "plural"];
const ARTICLE_PREP_MARKERS = ["article", "mạo từ", "preposition", "gioi tu", "determiner"];
const FRAGMENT_MARKERS = ["fragment", "incomplete sentence", "missing subject", "thieu chu ngu"];
const RUNON_MARKERS = ["run-on", "comma splice", "too long sentence", "cham phay sai"];
const COMPLEX_MARKERS = ["complex sentence", "clause", "subordinate", "comparison structure"];

const normalizeText = (value) => String(value || "")
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s+/g, " ")
  .trim();

const includesAny = (value, markers) => {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return markers.some((marker) => normalized.includes(marker));
};

const hasMeaningfulCorrection = (item = {}) => {
  const snippet = normalizeText(item?.text_snippet);
  const improved = normalizeText(item?.improved);
  if (!snippet || !improved) return true;
  return snippet !== improved;
};

const isMinorIssue = (item = {}) => {
  const confidence = Number(item?.confidence);
  if (Number.isFinite(confidence) && confidence > 0 && confidence < MIN_CONFIDENCE_FOR_LOG) {
    return true;
  }
  return includesAny(item?.band_impact, MINOR_MARKERS) || includesAny(item?.explanation, MINOR_MARKERS);
};

const isPraiseLikeIssue = (item = {}) => {
  const type = normalizeText(item?.type);
  if (type && type !== "error") return true;

  return includesAny(item?.explanation, PRAISE_MARKERS) || includesAny(item?.band_impact, PRAISE_MARKERS);
};

const isLexicalOrSpellingIssue = (item = {}) => {
  const lexicalUnit = normalizeText(item?.lexical_unit);
  if (lexicalUnit === "word" || lexicalUnit === "collocation") return true;

  const combined = `${normalizeText(item?.explanation)} ${normalizeText(item?.text_snippet)} ${normalizeText(item?.improved)}`;
  return LEXICAL_MARKERS.some((marker) => combined.includes(marker));
};

const shouldPersistWritingIssue = ({ criterionKey, item }) => {
  if (!TRACKED_CRITERIA_KEYS.has(criterionKey)) return false;
  if (isPraiseLikeIssue(item)) return false;
  if (isMinorIssue(item)) return false;
  if (!hasMeaningfulCorrection(item)) return false;

  if (criterionKey === "lexical_resource") {
    return isLexicalOrSpellingIssue(item);
  }
  return true;
};

const normalizeTaskType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "task1" ? "task1" : "task2";
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const canonicalizeCodeForWriting = (errorCode, questionType = "task2") =>
  createTaxonomyErrorLog({
    skillDomain: "writing",
    taskType: questionType,
    questionType,
    errorCode: String(errorCode || "").trim(),
    textSnippet: "",
    explanation: "",
    detectionMethod: "system",
  }).error_code;

const buildAllowedCodeSet = (questionType = "task2") => {
  const byType = listErrorCodesForSkillAndQuestionType("writing", questionType)
    .filter((code) => !String(code || "").toUpperCase().endsWith("UNCLASSIFIED"));
  const fallback = listErrorCodesForSkill("writing")
    .filter((code) => !String(code || "").toUpperCase().endsWith("UNCLASSIFIED"));
  const source = byType.length > 0 ? byType : fallback;

  const set = new Set();
  source.forEach((code) => {
    const canonical = canonicalizeCodeForWriting(code, questionType);
    if (canonical && canonical !== "W-UNCLASSIFIED") {
      set.add(canonical);
    }
  });
  return set;
};

const getLegacyCodeByHeuristic = ({ criterionKey, taskType, item }) => {
  const normalizedTaskType = normalizeTaskType(taskType);
  const textBundle = normalizeText([
    item?.text_snippet,
    item?.explanation,
    item?.improved,
    item?.band_impact,
  ].join(" "));

  if (criterionKey === "lexical_resource") {
    if (includesAny(textBundle, COLLOCATION_MARKERS)) return normalizedTaskType === "task1" ? "W1-L3" : "W2-L2";
    if (includesAny(textBundle, REPEAT_MARKERS)) return normalizedTaskType === "task1" ? "W1-L1" : "W2-L1";
    if (includesAny(textBundle, INFORMAL_MARKERS)) return normalizedTaskType === "task1" ? "W1-L2" : "W2-L3";
    if (includesAny(textBundle, SPELLING_MARKERS)) return normalizedTaskType === "task1" ? "W1-L3" : "W2-L1";
    if (includesAny(textBundle, WORD_CHOICE_MARKERS)) return normalizedTaskType === "task1" ? "W1-L2" : "W2-L1";
    return "";
  }

  if (includesAny(textBundle, TENSE_MARKERS)) return normalizedTaskType === "task1" ? "W1-G1" : "W2-G1";
  if (includesAny(textBundle, AGREEMENT_MARKERS)) return normalizedTaskType === "task1" ? "W1-G4" : "W2-G1";
  if (includesAny(textBundle, ARTICLE_PREP_MARKERS)) return normalizedTaskType === "task1" ? "W1-G3" : "W2-G1";
  if (includesAny(textBundle, FRAGMENT_MARKERS)) return normalizedTaskType === "task1" ? "W1-G2" : "W2-G2";
  if (includesAny(textBundle, RUNON_MARKERS)) return normalizedTaskType === "task1" ? "W1-G2" : "W2-G3";
  if (includesAny(textBundle, COMPLEX_MARKERS)) return normalizedTaskType === "task1" ? "W1-G2" : "W2-G1";
  return "";
};

const resolveTaskTypeMap = async (submission) => {
  const answers = toArray(submission?.writing_answers);
  const taskIds = Array.from(new Set(
    answers
      .map((answer) => String(answer?.task_id || "").trim())
      .filter(Boolean),
  ));
  if (taskIds.length === 0) return new Map();

  const tasks = await Writing.find({ _id: { $in: taskIds } })
    .select("_id task_type")
    .lean();

  return new Map(tasks.map((task) => [String(task._id), normalizeTaskType(task.task_type)]));
};

const collectIssueContexts = ({ submission, taskTypeMap }) => {
  const aiResult = submission?.ai_result || {};
  const contexts = [];
  const addFromAnalysis = ({ analysis, taskType, taskId }) => {
    for (const criterionKey of TRACKED_CRITERIA_KEYS) {
      const issues = toArray(analysis?.[criterionKey]);
      for (const issue of issues) {
        contexts.push({
          taskType: normalizeTaskType(taskType),
          taskId: taskId || null,
          criterionKey,
          item: issue || {},
        });
      }
    }
  };

  const taskEntries = toArray(aiResult?.tasks);
  if (taskEntries.length > 0) {
    taskEntries.forEach((taskEntry) => {
      const taskId = String(taskEntry?.task_id || "").trim();
      const taskType = normalizeTaskType(taskEntry?.task_type || taskTypeMap.get(taskId) || "task2");
      addFromAnalysis({
        analysis: taskEntry?.result || {},
        taskType,
        taskId,
      });
    });
    return contexts;
  }

  const firstAnswerTaskId = String(toArray(submission?.writing_answers)?.[0]?.task_id || "").trim();
  addFromAnalysis({
    analysis: aiResult,
    taskType: taskTypeMap.get(firstAnswerTaskId) || "task2",
    taskId: firstAnswerTaskId || null,
  });

  return contexts;
};

const chunk = (array = [], size = 10) => {
  const output = [];
  for (let i = 0; i < array.length; i += size) {
    output.push(array.slice(i, i + size));
  }
  return output;
};

const createTaxonomyPrompt = (issues = []) => {
  const lines = issues
    .map((issue, index) => {
      const allowed = Array.from(issue.allowedCodes || []);
      const snippet = String(issue?.item?.text_snippet || "").trim();
      const explanation = String(issue?.item?.explanation || "").trim();
      const improved = String(issue?.item?.improved || "").trim();

      return [
        `${index + 1}. issue_index=${issue.issue_index}`,
        `question_type=${issue.taskType}`,
        `criterion=${issue.criterionKey}`,
        `allowed_codes=[${allowed.join(", ")}]`,
        `text_snippet="${snippet}"`,
        `explanation="${explanation}"`,
        `improved="${improved}"`,
      ].join(" | ");
    })
    .join("\n");

  return `
You are an IELTS writing taxonomy classifier.
Return strict JSON only.

Rules:
- For each issue, choose exactly one error code from that issue's allowed_codes.
- Prefer precise codes over generic ones.
- If uncertain, still choose the best allowed code.
- Keep confidence between 0 and 1.

Return schema:
{
  "mappings": [
    {
      "issue_index": number,
      "error_code": "string",
      "confidence": number
    }
  ]
}

Issues:
${lines}
`;
};

const toTokenPayload = ({ model, maxTokens }) => {
  if (/^gpt-5/i.test(String(model || "").trim())) {
    return { max_completion_tokens: maxTokens };
  }
  return { max_tokens: maxTokens };
};

const runAiTaxonomyFallback = async (issues = []) => {
  if (!isWritingTaxonomyAiFallbackEnabled()) return [];
  if (!openai) return [];
  if (!Array.isArray(issues) || issues.length === 0) return [];

  const modelPrimary = getWritingTaxonomyModel();
  const modelFallback = String(process.env.OPENAI_FALLBACK_MODEL || "").trim();
  const models = [modelPrimary, modelFallback].filter((model, index, list) => Boolean(model) && list.indexOf(model) === index);
  if (models.length === 0) return [];

  const maxTokens = getWritingTaxonomyAiMaxTokens();
  const maxAttempts = getWritingTaxonomyMaxAttempts();
  const timeoutMs = getWritingTaxonomyTimeoutMs();
  const baseDelayMs = getWritingTaxonomyBaseDelayMs();
  const temperature = getWritingTaxonomyAiTemperature();
  const batchSize = getWritingTaxonomyAiBatchSize();

  const results = [];
  for (const batch of chunk(issues, batchSize)) {
    const prompt = createTaxonomyPrompt(batch);
    try {
      const aiResponse = await requestOpenAIJsonWithFallback({
        openai,
        models,
        createPayload: (model) => ({
          model,
          messages: [
            { role: "system", content: "You output strict JSON only." },
            { role: "user", content: prompt },
          ],
          ...toTokenPayload({ model, maxTokens }),
          temperature,
          response_format: { type: "json_object" },
        }),
        timeoutMs,
        maxAttempts,
        baseDelayMs,
      });

      const mappings = toArray(aiResponse?.data?.mappings);
      mappings.forEach((mapping) => {
        results.push({
          issue_index: Number(mapping?.issue_index),
          error_code: String(mapping?.error_code || "").trim(),
          confidence: Number(mapping?.confidence),
        });
      });
    } catch (error) {
      console.warn("Writing taxonomy AI fallback skipped batch:", error.message);
    }
  }

  return results;
};

const dedupeLogs = (logs = []) => {
  const output = [];
  const seen = new Set();
  logs.forEach((log) => {
    const key = [
      String(log?.error_code || ""),
      normalizeText(log?.text_snippet),
      normalizeText(log?.explanation),
    ].join("::");
    if (!key || seen.has(key)) return;
    seen.add(key);
    output.push(log);
  });
  return output;
};

export const enrichWritingTaxonomyBySubmissionId = async ({ submissionId, force = false } = {}) => {
  const submission = await WritingSubmission.findById(submissionId);
  if (!submission) {
    const error = new Error("Submission not found");
    error.statusCode = 404;
    throw error;
  }

  if (!submission?.ai_result || !submission?.is_ai_graded) {
    submission.taxonomy_state = "failed";
    submission.taxonomy_updated_at = new Date();
    await submission.save();
    const error = new Error("Submission has no AI detail result");
    error.statusCode = 400;
    throw error;
  }

  if (!force && String(submission.taxonomy_state || "") === "ready") {
    return {
      submission,
      errorLogs: toArray(submission.error_logs),
      skipped: true,
    };
  }

  if (submission.taxonomy_state !== "processing") {
    submission.taxonomy_state = "processing";
    await submission.save();
  }

  try {
    const taskTypeMap = await resolveTaskTypeMap(submission);
    const contexts = collectIssueContexts({ submission, taskTypeMap })
      .filter((context) => shouldPersistWritingIssue({
        criterionKey: context.criterionKey,
        item: context.item,
      }));

    const resolvedLogs = [];
    const unresolvedIssues = [];

    contexts.forEach((context, index) => {
      const questionType = normalizeTaskType(context.taskType);
      const allowedCodes = buildAllowedCodeSet(questionType);
      const explicitCode = String(context?.item?.error_code || "").trim();
      const normalizedExplicit = explicitCode && explicitCode.toUpperCase() !== "NONE"
        ? canonicalizeCodeForWriting(explicitCode, questionType)
        : "";

      const buildAndPushLog = ({ code, detectionMethod, confidence }) => {
        if (!code || code === "W-UNCLASSIFIED") return;
        const normalizedLog = createTaxonomyErrorLog({
          skillDomain: "writing",
          taskType: questionType,
          questionType,
          errorCode: code,
          textSnippet: String(context?.item?.text_snippet || ""),
          explanation: String(context?.item?.explanation || ""),
          detectionMethod,
          confidence,
          secondaryErrorCodes: context?.item?.secondary_error_codes,
        });

        if (normalizedLog.error_code === "W-UNCLASSIFIED") return;
        resolvedLogs.push(normalizedLog);
      };

      if (normalizedExplicit && allowedCodes.has(normalizedExplicit)) {
        buildAndPushLog({
          code: normalizedExplicit,
          detectionMethod: "llm",
          confidence: context?.item?.confidence,
        });
        return;
      }

      const heuristicLegacyCode = getLegacyCodeByHeuristic(context);
      const heuristicCanonicalCode = canonicalizeCodeForWriting(heuristicLegacyCode, questionType);
      if (heuristicCanonicalCode && allowedCodes.has(heuristicCanonicalCode)) {
        buildAndPushLog({
          code: heuristicCanonicalCode,
          detectionMethod: "heuristic",
          confidence: Number(context?.item?.confidence) || 0.75,
        });
        return;
      }

      unresolvedIssues.push({
        ...context,
        issue_index: index,
        allowedCodes,
      });
    });

    const llmMappings = await runAiTaxonomyFallback(unresolvedIssues);
    const unresolvedByIndex = new Map(unresolvedIssues.map((issue) => [issue.issue_index, issue]));

    llmMappings.forEach((mapping) => {
      const issueIndex = Number(mapping?.issue_index);
      if (!Number.isFinite(issueIndex)) return;

      const issue = unresolvedByIndex.get(issueIndex);
      if (!issue) return;

      const canonical = canonicalizeCodeForWriting(mapping.error_code, issue.taskType);
      if (!canonical || canonical === "W-UNCLASSIFIED") return;
      if (!issue.allowedCodes.has(canonical)) return;

      const normalizedLog = createTaxonomyErrorLog({
        skillDomain: "writing",
        taskType: issue.taskType,
        questionType: issue.taskType,
        errorCode: canonical,
        textSnippet: String(issue?.item?.text_snippet || ""),
        explanation: String(issue?.item?.explanation || ""),
        detectionMethod: "llm_taxonomy",
        confidence: Number.isFinite(Number(mapping?.confidence)) ? Number(mapping.confidence) : 0.65,
        secondaryErrorCodes: issue?.item?.secondary_error_codes,
      });

      if (normalizedLog.error_code === "W-UNCLASSIFIED") return;
      resolvedLogs.push(normalizedLog);
    });

    const dedupedLogs = dedupeLogs(resolvedLogs);
    submission.error_logs = dedupedLogs;
    submission.taxonomy_state = "ready";
    submission.taxonomy_updated_at = new Date();
    await submission.save();

    return {
      submission,
      errorLogs: dedupedLogs,
      skipped: false,
    };
  } catch (error) {
    submission.taxonomy_state = "failed";
    submission.taxonomy_updated_at = new Date();
    await submission.save();
    throw error;
  }
};
