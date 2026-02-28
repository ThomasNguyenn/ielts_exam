import { isAiAsyncModeEnabled } from "../config/queue.config.js";
import WritingSubmission from "../models/WritingSubmission.model.js";
import Writing from "../models/Writing.model.js";
import {
  enqueueWritingTaxonomyEnrichmentJob,
  isAiQueueReady,
} from "../queues/ai.queue.js";
import { gradeEssay } from "./grading.service.js";
import { scoreWritingSubmissionFastById } from "./writingFastScoring.service.js";
import { enrichWritingTaxonomyBySubmissionId } from "./writingTaxonomyEnrichment.service.js";

const CRITERIA_KEYS = [
  "task_response",
  "coherence_cohesion",
  "lexical_resource",
  "grammatical_range_accuracy",
];

const toBandHalfStep = (score) => {
  const numeric = Number(score);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(Math.max(0, Math.min(9, numeric)) * 2) / 2;
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const normalizeCriteriaScores = (raw = {}, fallbackBand = 0) => {
  const safeBand = toBandHalfStep(fallbackBand);
  return {
    task_response: toBandHalfStep(raw.task_response ?? safeBand),
    coherence_cohesion: toBandHalfStep(raw.coherence_cohesion ?? safeBand),
    lexical_resource: toBandHalfStep(raw.lexical_resource ?? safeBand),
    grammatical_range_accuracy: toBandHalfStep(raw.grammatical_range_accuracy ?? safeBand),
  };
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

const computeOverallCriteria = (taskResults = []) => {
  if (!Array.isArray(taskResults) || taskResults.length === 0) {
    return normalizeCriteriaScores({}, 0);
  }

  const buckets = CRITERIA_KEYS.reduce((acc, key) => {
    acc[key] = { sum: 0, weight: 0 };
    return acc;
  }, {});

  taskResults.forEach((item) => {
    const weight = item.task_type === "task2" ? 2 : 1;
    const criteria = item.criteria_scores || {};

    CRITERIA_KEYS.forEach((key) => {
      const score = Number(criteria[key]);
      if (!Number.isFinite(score)) return;
      buckets[key].sum += score * weight;
      buckets[key].weight += weight;
    });
  });

  return CRITERIA_KEYS.reduce((acc, key) => {
    const bucket = buckets[key];
    acc[key] = bucket.weight > 0 ? toBandHalfStep(bucket.sum / bucket.weight) : 0;
    return acc;
  }, {});
};

const queueInlineTaxonomyEnrichment = ({ submissionId, force = false }) => {
  setImmediate(() => {
    enrichWritingTaxonomyBySubmissionId({ submissionId, force })
      .catch((error) => {
        console.warn("Writing taxonomy enrichment (inline) failed:", error?.message || error);
      });
  });
};

const scheduleWritingTaxonomyEnrichment = async ({ submissionId, force = false }) => {
  const shouldQueue = isAiAsyncModeEnabled() && isAiQueueReady();
  if (shouldQueue) {
    try {
      const result = await enqueueWritingTaxonomyEnrichmentJob({
        submissionId,
        force,
      });
      if (result?.queued) return result;
    } catch (error) {
      console.warn("Writing taxonomy enqueue failed, falling back to inline:", error.message);
    }
  }

  queueInlineTaxonomyEnrichment({ submissionId, force });
  return {
    queued: false,
    queue: "inline",
    jobId: null,
  };
};

const getTaskTypeByAnswerOrder = async (answers = []) => {
  const taskIds = Array.from(new Set(
    answers
      .map((answer) => String(answer?.task_id || "").trim())
      .filter(Boolean),
  ));
  if (taskIds.length === 0) return new Map();

  const tasks = await Writing.find({ _id: { $in: taskIds } })
    .select("_id task_type")
    .lean();
  return new Map(tasks.map((task) => [String(task._id), String(task.task_type || "task2")]));
};

const buildTaskLookup = async (answers = []) => {
  const taskIds = Array.from(new Set(
    answers
      .map((answer) => String(answer?.task_id || "").trim())
      .filter(Boolean),
  ));
  if (taskIds.length === 0) return new Map();

  const tasks = await Writing.find({ _id: { $in: taskIds } }).lean();
  return new Map(tasks.map((task) => [String(task._id), task]));
};

const getFastTaskLookup = (fastResult = {}, answers = []) => {
  const lookup = new Map();
  const taskEntries = toArray(fastResult?.tasks);

  taskEntries.forEach((taskEntry) => {
    const taskId = String(taskEntry?.task_id || "").trim();
    if (!taskId) return;

    const bandScore = toBandHalfStep(taskEntry?.band_score ?? fastResult?.band_score ?? 0);
    lookup.set(taskId, {
      band_score: bandScore,
      criteria_scores: normalizeCriteriaScores(taskEntry?.criteria_scores || {}, bandScore),
    });
  });

  if (lookup.size === 0 && answers.length === 1) {
    const taskId = String(answers[0]?.task_id || "").trim();
    if (taskId) {
      const bandScore = toBandHalfStep(fastResult?.band_score || 0);
      lookup.set(taskId, {
        band_score: bandScore,
        criteria_scores: normalizeCriteriaScores(fastResult?.criteria_scores || {}, bandScore),
      });
    }
  }

  return lookup;
};

const ensureDetailArrays = (result = {}) => ({
  ...result,
  task_response: toArray(result?.task_response),
  coherence_cohesion: toArray(result?.coherence_cohesion),
  lexical_resource: toArray(result?.lexical_resource),
  grammatical_range_accuracy: toArray(result?.grammatical_range_accuracy),
  feedback: toArray(result?.feedback).filter(Boolean),
});

const toOptionalBand = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return toBandHalfStep(numeric);
};

const toOptionalCriteriaScores = (raw = {}) => CRITERIA_KEYS.reduce((acc, key) => {
  const numeric = Number(raw?.[key]);
  acc[key] = Number.isFinite(numeric) ? toBandHalfStep(numeric) : null;
  return acc;
}, {});

const hasRetryMarker = (feedback = []) => {
  const normalized = toArray(feedback)
    .map((item) => String(item || "").toLowerCase())
    .join(" ");
  const markers = ["tam thoi", "temporarily", "unavailable", "thu lai", "retry"];
  return markers.some((marker) => normalized.includes(marker));
};

const isDetailScoringFallback = (detailResult = {}) => {
  const detailBand = Number(detailResult?.band_score);
  const criteriaScores = detailResult?.criteria_scores || {};
  const criteriaTotal = CRITERIA_KEYS.reduce((sum, key) => {
    const value = Number(criteriaScores[key]);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  if (Number.isFinite(detailBand) && detailBand > 0) return false;
  if (criteriaTotal > 0) return false;
  return hasRetryMarker(detailResult?.feedback);
};

const pickDownwardBand = ({ fastBand, detailBand, allowDetailDowngrade = true }) => {
  if (fastBand === null) return detailBand ?? 0;
  if (detailBand === null) return fastBand;
  if (!allowDetailDowngrade) return fastBand;
  return detailBand < fastBand ? detailBand : fastBand;
};

const pickDownwardCriteriaScores = ({
  fastCriteria,
  detailCriteria,
  fallbackBand = 0,
  allowDetailDowngrade = true,
}) => {
  const merged = {};

  CRITERIA_KEYS.forEach((key) => {
    const fastValue = fastCriteria?.[key];
    const detailValue = detailCriteria?.[key];

    if (fastValue === null || fastValue === undefined) {
      merged[key] = detailValue ?? fallbackBand;
      return;
    }

    if (detailValue === null || detailValue === undefined) {
      merged[key] = fastValue;
      return;
    }

    merged[key] = allowDetailDowngrade && detailValue < fastValue ? detailValue : fastValue;
  });

  return normalizeCriteriaScores(merged, fallbackBand);
};

const adjustFastResultAfterDetail = ({ fastResult, taskResults, overallBand, overallCriteria }) => {
  if (!fastResult || typeof fastResult !== "object") return fastResult;
  const fastOverallBand = toOptionalBand(fastResult?.band_score);
  if (fastOverallBand === null || overallBand >= fastOverallBand) return fastResult;

  const adjustedAt = new Date().toISOString();
  const nextFastResult = {
    ...fastResult,
    band_score: overallBand,
    criteria_scores: normalizeCriteriaScores(fastResult?.criteria_scores || overallCriteria, overallBand),
    adjusted_by_detail: true,
    adjusted_at: adjustedAt,
    adjustment_reason: "detail_lower_score",
  };

  const taskResultById = new Map(
    toArray(taskResults).map((task) => [String(task.task_id || ""), task]),
  );

  if (Array.isArray(fastResult?.tasks)) {
    nextFastResult.tasks = fastResult.tasks.map((task) => {
      const taskId = String(task?.task_id || "");
      const detailTask = taskResultById.get(taskId);
      if (!detailTask) return task;

      const fastTaskBand = toOptionalBand(task?.band_score);
      if (fastTaskBand === null || detailTask.band_score >= fastTaskBand) return task;

      return {
        ...task,
        band_score: detailTask.band_score,
        criteria_scores: detailTask.criteria_scores,
        adjusted_by_detail: true,
      };
    });
  }

  return nextFastResult;
};

export const scoreWritingSubmissionById = async ({ submissionId, force = false } = {}) => {
  const submission = await WritingSubmission.findById(submissionId);
  if (!submission) {
    const error = new Error("Submission not found");
    error.statusCode = 404;
    throw error;
  }

  if (submission.status === "scored" && submission.is_ai_graded && !force) {
    let hasPendingSave = false;
    if (submission.scoring_state !== "detail_ready") {
      submission.scoring_state = "detail_ready";
      hasPendingSave = true;
    }

    const taxonomyState = String(submission.taxonomy_state || "none");
    if (taxonomyState === "none" || taxonomyState === "failed") {
      submission.taxonomy_state = "processing";
      submission.taxonomy_updated_at = null;
      hasPendingSave = true;
    }

    if (hasPendingSave) {
      await submission.save();
    }

    if (taxonomyState === "none" || taxonomyState === "failed") {
      await scheduleWritingTaxonomyEnrichment({
        submissionId: String(submission._id),
        force: true,
      });
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

  let fastResult = submission.ai_fast_result || null;
  if (force || !submission.is_ai_fast_graded || !fastResult) {
    const fastScored = await scoreWritingSubmissionFastById({
      submissionId: String(submission._id),
      force,
    });
    fastResult = fastScored?.fastResult || fastScored?.submission?.ai_fast_result || fastResult;
  }

  if (!fastResult) {
    const error = new Error("Fast scoring result is required before detail scoring");
    error.statusCode = 500;
    throw error;
  }

  const fastTaskLookup = getFastTaskLookup(fastResult, answers);
  const taskLookup = await buildTaskLookup(answers);
  const taskResultsRaw = await Promise.all(
    answers.map(async (answer) => {
      const task = taskLookup.get(String(answer.task_id || ""));
      if (!task) return null;

      const detailResultRaw = await gradeEssay(
        task.prompt || "",
        answer.answer_text || "",
        task.task_type,
        task.image_url,
      );

      const detailResult = ensureDetailArrays(detailResultRaw || {});
      const detailBand = toOptionalBand(detailResult?.band_score);
      const detailCriteria = toOptionalCriteriaScores(detailResult?.criteria_scores || {});
      const fastTask = fastTaskLookup.get(String(task._id));
      const fastBand = toOptionalBand(fastTask?.band_score);
      const fastCriteria = toOptionalCriteriaScores(fastTask?.criteria_scores || {});
      const allowDetailDowngrade = !isDetailScoringFallback(detailResult);
      const fallbackBand = fastBand ?? detailBand ?? 0;

      const mergedBand = pickDownwardBand({
        fastBand,
        detailBand,
        allowDetailDowngrade,
      });
      const mergedCriteria = pickDownwardCriteriaScores({
        fastCriteria,
        detailCriteria,
        fallbackBand: mergedBand || fallbackBand,
        allowDetailDowngrade,
      });
      const downgradedByDetail = (
        fastBand !== null
        && detailBand !== null
        && allowDetailDowngrade
        && detailBand < fastBand
      );

      const { model: detailModel, ...detailPayload } = detailResult;
      const mergedResult = {
        ...detailPayload,
        band_score: mergedBand,
        criteria_scores: mergedCriteria,
        downgraded_fast_score: downgradedByDetail,
      };

      return {
        task_id: String(task._id),
        task_type: task.task_type || "task2",
        task_title: task.title || answer.task_title || "",
        band_score: mergedBand,
        criteria_scores: mergedCriteria,
        downgraded_by_detail: downgradedByDetail,
        detail_model: String(detailModel || "").trim() || null,
        result: mergedResult,
      };
    }),
  );

  const taskResults = taskResultsRaw.filter(Boolean);
  if (taskResults.length === 0) {
    const error = new Error("Original writing tasks not found for this submission");
    error.statusCode = 404;
    throw error;
  }

  const overallBand = computeOverallBand(taskResults);
  const overallCriteria = computeOverallCriteria(taskResults);
  const fastResultAdjusted = adjustFastResultAfterDetail({
    fastResult,
    taskResults,
    overallBand,
    overallCriteria,
  });
  const anyTaskDowngraded = taskResults.some((item) => item.downgraded_by_detail);

  const firstDetailModel = taskResults.map((item) => item.detail_model).find(Boolean) || null;
  const aiPipelineVersion = "writing_v2_phase_models";

  const aiResult = taskResults.length === 1
    ? {
      ...taskResults[0].result,
      band_score: taskResults[0].band_score,
      criteria_scores: taskResults[0].criteria_scores,
      ai_pipeline_version: aiPipelineVersion,
      ai_fast_model: submission.ai_fast_model || fastResultAdjusted?.model || null,
      ai_detail_model: firstDetailModel,
      downgraded_fast_score: anyTaskDowngraded,
    }
    : {
      band_score: overallBand,
      criteria_scores: overallCriteria,
      tasks: taskResults.map((task) => ({
        task_id: task.task_id,
        task_type: task.task_type,
        task_title: task.task_title,
        band_score: task.band_score,
        result: task.result,
      })),
      feedback: ["AI extracted detailed issues and can downgrade fast score when detail finds lower performance."],
      ai_pipeline_version: aiPipelineVersion,
      ai_fast_model: submission.ai_fast_model || fastResultAdjusted?.model || null,
      ai_detail_model: firstDetailModel,
      downgraded_fast_score: anyTaskDowngraded,
    };

  if (fastResultAdjusted) {
    submission.ai_fast_result = fastResultAdjusted;
  }
  submission.ai_result = aiResult;
  submission.is_ai_graded = true;
  submission.score = overallBand;
  submission.status = "scored";
  submission.scoring_state = "detail_ready";
  submission.taxonomy_state = "processing";
  submission.taxonomy_updated_at = null;
  await submission.save();

  await scheduleWritingTaxonomyEnrichment({
    submissionId: String(submission._id),
    force: true,
  });

  return {
    submission,
    aiResult,
    skipped: false,
  };
};

export const getWritingTaskTypeMapBySubmissionId = async ({ submissionId } = {}) => {
  const submission = await WritingSubmission.findById(submissionId).select("writing_answers").lean();
  if (!submission) return new Map();
  return getTaskTypeByAnswerOrder(submission.writing_answers || []);
};
