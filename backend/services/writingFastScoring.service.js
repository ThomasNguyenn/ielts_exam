import WritingSubmission from "../models/WritingSubmission.model.js";
import Writing from "../models/Writing.model.js";
import { gradeEssayFast } from "./grading.service.js";

const toBandHalfStep = (score) => Math.round(Number(score || 0) * 2) / 2;

const computeOverallBand = (taskResults) => {
  if (!Array.isArray(taskResults) || taskResults.length === 0) return 0;
  if (taskResults.length === 1) return toBandHalfStep(taskResults[0].band_score);

  const weightedTotal = taskResults.reduce((sum, item) => {
    const weight = item.task_type === "task2" ? 2 : 1;
    return sum + Number(item.band_score || 0) * weight;
  }, 0);
  const weightedBase = taskResults.reduce((sum, item) => {
    const weight = item.task_type === "task2" ? 2 : 1;
    return sum + weight;
  }, 0);

  if (!weightedBase) return 0;
  return toBandHalfStep(weightedTotal / weightedBase);
};

const CRITERIA_KEYS = [
  "task_response",
  "coherence_cohesion",
  "lexical_resource",
  "grammatical_range_accuracy",
];

const computeCriteriaScores = (taskResults) => {
  const weightedByCriteria = CRITERIA_KEYS.reduce((acc, key) => {
    acc[key] = { sum: 0, weight: 0 };
    return acc;
  }, {});

  for (const taskResult of taskResults) {
    const weight = taskResult.task_type === "task2" ? 2 : 1;
    const criteria = taskResult?.result?.criteria_scores || {};

    for (const key of CRITERIA_KEYS) {
      const raw = Number(criteria[key]);
      if (!Number.isFinite(raw)) continue;
      weightedByCriteria[key].sum += raw * weight;
      weightedByCriteria[key].weight += weight;
    }
  }

  return CRITERIA_KEYS.reduce((acc, key) => {
    const bucket = weightedByCriteria[key];
    acc[key] = bucket.weight > 0 ? toBandHalfStep(bucket.sum / bucket.weight) : 0;
    return acc;
  }, {});
};

const toPerformanceLabel = (bandScore) => {
  const score = Number(bandScore || 0);
  if (score >= 7) return "Strong";
  if (score >= 6) return "Developing";
  return "Needs Improvement";
};

const buildFastResult = (taskResults) => {
  const overallBand = computeOverallBand(taskResults);
  const criteria_scores = computeCriteriaScores(taskResults);
  const summaries = taskResults
    .map((item) => String(item?.result?.summary || "").trim())
    .filter(Boolean);
  const topIssuesByCriteria = {
    grammatical_range_accuracy: [],
    lexical_resource: [],
  };

  taskResults.forEach((item) => {
    const topIssues = item?.result?.top_issues || {};
    if (Array.isArray(topIssues?.grammatical_range_accuracy)) {
      topIssuesByCriteria.grammatical_range_accuracy.push(...topIssues.grammatical_range_accuracy);
    }
    if (Array.isArray(topIssues?.lexical_resource)) {
      topIssuesByCriteria.lexical_resource.push(...topIssues.lexical_resource);
    }
  });

  const normalizedTopIssues = {
    grammatical_range_accuracy: topIssuesByCriteria.grammatical_range_accuracy.slice(0, 5),
    lexical_resource: topIssuesByCriteria.lexical_resource.slice(0, 5),
  };

  if (taskResults.length === 1) {
    const single = taskResults[0];
    return {
      ...single.result,
      band_score: toBandHalfStep(single.result?.band_score ?? overallBand),
      criteria_scores,
      task_id: single.task_id,
      task_type: single.task_type,
      task_title: single.task_title,
      performance_label: single.result?.performance_label || toPerformanceLabel(single.result?.band_score ?? overallBand),
      summary: single.result?.summary || summaries[0] || "",
      top_issues: normalizedTopIssues,
      tasks: [
        {
          task_id: single.task_id,
          task_type: single.task_type,
          task_title: single.task_title,
          band_score: toBandHalfStep(single.result?.band_score ?? overallBand),
          criteria_scores: single.result?.criteria_scores || {},
          summary: single.result?.summary || "",
          criteria_notes: single.result?.criteria_notes || {},
        },
      ],
    };
  }

  return {
    band_score: overallBand,
    criteria_scores,
    summary: summaries.join(" "),
    performance_label: toPerformanceLabel(overallBand),
    top_issues: normalizedTopIssues,
    tasks: taskResults.map((item) => ({
      task_id: item.task_id,
      task_type: item.task_type,
      task_title: item.task_title,
      band_score: item.band_score,
      criteria_scores: item.result?.criteria_scores || {},
      summary: item.result?.summary || "",
      criteria_notes: item.result?.criteria_notes || {},
      model: item.model || null,
    })),
  };
};

export const scoreWritingSubmissionFastById = async ({ submissionId, force = false } = {}) => {
  const submission = await WritingSubmission.findById(submissionId);
  if (!submission) {
    const error = new Error("Submission not found");
    error.statusCode = 404;
    throw error;
  }

  if (submission.is_ai_fast_graded && submission.ai_fast_result && !force) {
    return {
      submission,
      fastResult: submission.ai_fast_result,
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

    const aiResult = await gradeEssayFast(
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
      model: aiResult?.model || null,
    });
  }

  if (taskResults.length === 0) {
    const error = new Error("Original writing tasks not found for this submission");
    error.statusCode = 404;
    throw error;
  }

  const fastResult = buildFastResult(taskResults);
  const fastModel = taskResults.map((item) => item.model).find(Boolean) || process.env.WRITING_FAST_MODEL || "gpt-4o-mini";

  submission.ai_fast_result = fastResult;
  submission.is_ai_fast_graded = true;
  submission.ai_fast_model = String(fastModel || "gpt-4o-mini");
  submission.ai_fast_scored_at = new Date();
  submission.scoring_state = submission.is_ai_graded ? "detail_ready" : "fast_ready";
  submission.status = submission.is_ai_graded ? "scored" : "processing";
  await submission.save();

  return {
    submission,
    fastResult,
    skipped: false,
  };
};
