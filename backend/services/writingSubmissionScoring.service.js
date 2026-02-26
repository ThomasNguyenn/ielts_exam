import WritingSubmission from "../models/WritingSubmission.model.js";
import Writing from "../models/Writing.model.js";
import { gradeEssay } from "./grading.service.js";
import { createTaxonomyErrorLog } from "./taxonomy.registry.js";

const toBandHalfStep = (score) => Math.round(Number(score || 0) * 2) / 2;
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

  const errorCode = normalizeText(item?.error_code);
  if (!errorCode || errorCode === "none") return true;

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

const computeOverallBand = (taskResults) => {
  if (!Array.isArray(taskResults) || taskResults.length === 0) return 0;
  if (taskResults.length === 1) return toBandHalfStep(taskResults[0].band_score);

  const task1 = taskResults.find((t) => t.task_type === "task1");
  const task2 = taskResults.find((t) => t.task_type === "task2");

  if (task1 && task2) {
    return toBandHalfStep((Number(task2.band_score || 0) * 2 + Number(task1.band_score || 0)) / 3);
  }

  const avg = taskResults.reduce((sum, item) => sum + Number(item.band_score || 0), 0) / taskResults.length;
  return toBandHalfStep(avg);
};

export const scoreWritingSubmissionById = async ({ submissionId, force = false } = {}) => {
  const submission = await WritingSubmission.findById(submissionId);
  if (!submission) {
    const error = new Error("Submission not found");
    error.statusCode = 404;
    throw error;
  }

  if (submission.status === "scored" && submission.is_ai_graded && !force) {
    if (submission.scoring_state !== "detail_ready") {
      submission.scoring_state = "detail_ready";
      await submission.save();
    }
    return {
      submission,
      aiResult: submission.ai_result || null,
      skipped: true,
    };
  }

  const answers = submission.writing_answers || [];
  if (answers.length === 0) {
    const error = new Error("No writing answers found in submission");
    error.statusCode = 400;
    throw error;
  }

  const taskResults = [];
  for (const answer of answers) {
    const task = await Writing.findById(answer.task_id).lean();
    if (!task) continue;

    const aiResult = await gradeEssay(
      task.prompt || "",
      answer.answer_text || "",
      task.task_type,
      task.image_url,
    );

    taskResults.push({
      task_id: String(task._id),
      task_type: task.task_type || "task2",
      task_title: task.title || answer.task_title || "",
      band_score: Number(aiResult?.band_score || 0),
      result: aiResult,
    });
  }

  if (taskResults.length === 0) {
    const error = new Error("Original writing tasks not found for this submission");
    error.statusCode = 404;
    throw error;
  }

  const overallBand = computeOverallBand(taskResults);
  const singleTaskResult = taskResults.length === 1 ? taskResults[0].result : null;
  const aiResult = singleTaskResult || {
    band_score: overallBand,
    tasks: taskResults.map((task) => ({
      task_id: task.task_id,
      task_type: task.task_type,
      task_title: task.task_title,
      band_score: task.band_score,
      result: task.result,
    })),
    feedback: ["AI scored multi-task writing submission."],
  };

  // Extract Error Taxonomy Logs
  const errorLogs = [];
  for (const tr of taskResults) {
    const aiRes = tr.result;
    if (!aiRes) continue;

    const criteriaList = [
      { key: "lexical_resource" },
      { key: "grammatical_range_accuracy" },
    ];

    for (const { key } of criteriaList) {
      const items = Array.isArray(aiRes[key]) ? aiRes[key] : [];
      for (const item of items) {
        if (!shouldPersistWritingIssue({ criterionKey: key, item })) continue;

        const normalizedLog = createTaxonomyErrorLog({
          skillDomain: "writing",
          taskType: tr.task_type,
          questionType: tr.task_type,
          errorCode: item.error_code,
          textSnippet: item.text_snippet || "",
          explanation: item.explanation || "",
          detectionMethod: "llm",
          confidence: item.confidence,
          secondaryErrorCodes: item.secondary_error_codes,
        });

        // Only keep precise taxonomy codes. Skip ambiguous fallback entries.
        if (normalizedLog.error_code === "W-UNCLASSIFIED") continue;
        errorLogs.push(normalizedLog);
      }
    }
  }

  submission.error_logs = errorLogs;
  submission.ai_result = aiResult;
  submission.is_ai_graded = true;
  submission.score = overallBand;
  submission.status = "scored";
  submission.scoring_state = "detail_ready";
  await submission.save();

  return {
    submission,
    aiResult,
    skipped: false,
  };
};
