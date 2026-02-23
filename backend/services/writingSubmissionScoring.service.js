import WritingSubmission from "../models/WritingSubmission.model.js";
import Writing from "../models/Writing.model.js";
import { gradeEssay } from "./grading.service.js";

const toBandHalfStep = (score) => Math.round(Number(score || 0) * 2) / 2;

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
      { key: "task_response", cognitiveSkill: "W-TR (Task Achievement/Response)" },
      { key: "coherence_cohesion", cognitiveSkill: "W-CC (Coherence & Cohesion)" },
      { key: "lexical_resource", cognitiveSkill: "W-LR (Lexical Resource)" },
      { key: "grammatical_range_accuracy", cognitiveSkill: "W-GRA (Grammatical Range & Accuracy)" },
    ];

    for (const { key, cognitiveSkill } of criteriaList) {
      const items = Array.isArray(aiRes[key]) ? aiRes[key] : [];
      for (const item of items) {
        if (item.type === 'error' && item.error_code && item.error_code !== 'NONE') {
          errorLogs.push({
            task_type: tr.task_type,
            cognitive_skill: cognitiveSkill,
            error_category: key,
            error_code: item.error_code,
            text_snippet: item.text_snippet || "",
            explanation: item.explanation || "",
          });
        }
      }
    }
  }

  submission.error_logs = errorLogs;
  submission.ai_result = aiResult;
  submission.is_ai_graded = true;
  submission.score = overallBand;
  submission.status = "scored";
  await submission.save();

  return {
    submission,
    aiResult,
    skipped: false,
  };
};

