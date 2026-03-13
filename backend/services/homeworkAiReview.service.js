import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { requestGeminiJsonWithFallback } from "../utils/aiClient.js";
import { buildHomeworkAiReviewPayload } from "./homeworkAiReview.mapper.js";

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

const normalizeText = (value = "") => String(value ?? "").trim();

const buildGeminiModelList = () => {
  const primary = normalizeText(process.env.HOMEWORK_AI_REVIEW_PRIMARY_MODEL) || "gemini-2.5-flash-lite";
  const fallback = normalizeText(process.env.HOMEWORK_AI_REVIEW_FALLBACK_MODEL)
    || normalizeText(process.env.GEMINI_FALLBACK_MODEL)
    || "";
  return [primary, fallback].filter((model, index, list) => model && list.indexOf(model) === index);
};

const GEMINI_MODELS = buildGeminiModelList();
const HOMEWORK_AI_REVIEW_MAX_IMAGE_ITEMS = (() => {
  const parsed = Number(process.env.HOMEWORK_AI_REVIEW_MAX_IMAGE_ITEMS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 4;
})();
const HOMEWORK_AI_REVIEW_MAX_IMAGE_BYTES = (() => {
  const parsed = Number(process.env.HOMEWORK_AI_REVIEW_MAX_IMAGE_BYTES);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : (4 * 1024 * 1024);
})();
const HOMEWORK_AI_REVIEW_IMAGE_FETCH_TIMEOUT_MS = (() => {
  const parsed = Number(process.env.HOMEWORK_AI_REVIEW_IMAGE_FETCH_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 12000;
})();

const normalizeStringArray = (value) => {
  const rows = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/g)
      : [];
  const seen = new Set();
  const output = [];
  rows.forEach((row) => {
    const normalized = normalizeText(
      typeof row === "object" && row !== null
        ? (row.text || row.message || row.explanation || JSON.stringify(row))
        : row,
    );
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    output.push(normalized);
  });
  return output;
};

const normalizeIssueEntry = (issue = "") => {
  if (typeof issue === "string") {
    return normalizeText(issue);
  }
  if (!issue || typeof issue !== "object" || Array.isArray(issue)) {
    return "";
  }
  const wrongText = normalizeText(
    issue.quote || issue.incorrect || issue.incorrect_text || issue.original || issue.text,
  );
  const reason = normalizeText(
    issue.reason || issue.explanation || issue.comment || issue.why,
  );
  const corrected = normalizeText(
    issue.corrected || issue.corrected_text || issue.correction || issue.fixed || issue.suggestion,
  );

  if (wrongText && reason && corrected) {
    return `${wrongText} -> ${reason} -> ${corrected}`;
  }
  if (wrongText && reason) {
    return `${wrongText} -> ${reason}`;
  }
  if (reason && corrected) {
    return `${reason} -> ${corrected}`;
  }
  return wrongText || reason || corrected || "";
};

const normalizeIssuesArray = (value) => {
  const rows = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const seen = new Set();
  const output = [];
  rows.forEach((row) => {
    const normalized = normalizeIssueEntry(row);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    output.push(normalized);
  });
  return output;
};

const clampScore = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed * 10) / 10;
  return Math.max(0, Math.min(10, rounded));
};

const normalizeScoreEstimate = (raw = {}) => {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return {
    overall: clampScore(source?.overall),
    task_completion: clampScore(source?.task_completion ?? source?.taskResponse ?? source?.task_response),
    accuracy: clampScore(source?.accuracy),
    language: clampScore(source?.language ?? source?.language_use),
  };
};

const buildReviewText = ({ summary, strengths, issues, suggestions }) => {
  const sections = [];
  if (summary) sections.push(summary);
  if (strengths.length > 0) {
    sections.push(`Strengths:\n- ${strengths.join("\n- ")}`);
  }
  if (issues.length > 0) {
    sections.push(`Main issues:\n- ${issues.join("\n- ")}`);
  }
  if (suggestions.length > 0) {
    sections.push(`Next steps:\n- ${suggestions.join("\n- ")}`);
  }
  return sections.join("\n\n").trim();
};

const normalizeAiReviewResult = (parsed = {}) => {
  const source = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const summary = normalizeText(
    source?.summary || source?.overview || source?.general_feedback || source?.review,
  );
  const strengths = normalizeStringArray(
    source?.strengths || source?.what_went_well || source?.pros,
  );
  const issues = normalizeIssuesArray(
    source?.issues || source?.weaknesses || source?.mistakes || source?.improvements,
  );
  const actionableSuggestions = normalizeStringArray(
    source?.actionable_suggestions || source?.suggestions || source?.next_steps || source?.recommendations,
  );
  const normalizedFeedback = normalizeStringArray(source?.feedback);
  const feedback = normalizedFeedback.length > 0 ? normalizedFeedback : actionableSuggestions;

  const review =
    normalizeText(source?.review || source?.general_feedback)
    || buildReviewText({
      summary,
      strengths,
      issues,
      suggestions: actionableSuggestions,
    });

  return {
    summary,
    strengths,
    issues,
    actionable_suggestions: actionableSuggestions,
    feedback,
    review,
    score_estimate: normalizeScoreEstimate(source?.score_estimate || source?.scores),
  };
};

const createServiceError = (message, { statusCode = 500, code = "INTERNAL_SERVER_ERROR" } = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const resolveImageMimeType = ({ fromPayload = "", fromResponse = "" } = {}) => {
  const responseMime = normalizeText(fromResponse).split(";")[0].trim().toLowerCase();
  if (responseMime.startsWith("image/")) return responseMime;

  const payloadMime = normalizeText(fromPayload).toLowerCase();
  if (payloadMime.startsWith("image/")) return payloadMime;

  return "";
};

const fetchImageAsInlinePart = async (imageItem = {}) => {
  const imageUrl = normalizeText(imageItem?.url);
  if (!imageUrl) return null;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), HOMEWORK_AI_REVIEW_IMAGE_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(imageUrl, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response?.ok) return null;

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > HOMEWORK_AI_REVIEW_MAX_IMAGE_BYTES) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const byteLength = Number(arrayBuffer?.byteLength || 0);
    if (!byteLength || byteLength > HOMEWORK_AI_REVIEW_MAX_IMAGE_BYTES) return null;

    const mimeType = resolveImageMimeType({
      fromPayload: imageItem?.mime,
      fromResponse: response.headers.get("content-type"),
    });
    if (!mimeType) return null;

    return {
      inlineData: {
        mimeType,
        data: Buffer.from(arrayBuffer).toString("base64"),
      },
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const buildGeminiImageParts = async (imageItems = []) => {
  const limited = (Array.isArray(imageItems) ? imageItems : []).slice(0, HOMEWORK_AI_REVIEW_MAX_IMAGE_ITEMS);
  if (limited.length === 0) return [];

  const settled = await Promise.all(limited.map((item) => fetchImageAsInlinePart(item)));
  return settled.filter(Boolean);
};

const buildSystemPrompt = () => `
You are an English homework reviewer for teachers.
Evaluate the student's answer against the assignment/task prompt and reference answer when available.

All explanations and comments must be written in Vietnamese.

When identifying mistakes, you must:
1) Quote the incorrect part of the student's answer.
2) Explain why it is incorrect (grammar rule, vocabulary misuse, structure, meaning, etc.).
3) Provide a corrected version.

Return strict JSON only with this exact shape:
{
"summary": "string",
"strengths": ["string"],
"issues": [
"Quote the incorrect phrase/sentence -> explain why it is wrong in Vietnamese -> provide corrected version"
],
"actionable_suggestions": ["string"],
"score_estimate": {
"overall": 0,
"task_completion": 0,
"accuracy": 0,
"language": 0
},
"feedback": ["string"],
"review": "string"
}

Rules:
1) Score range is 0-10.
2) Do not use markdown.
3) All explanations must be in Vietnamese.
4) In "issues", clearly explain why the mistake is wrong (grammar rule, tense, word choice, sentence structure, etc.).
5) When possible, provide a corrected version of the sentence.
6) Keep feedback concise but educational for the student.
7) If audio URL is present, treat it as metadata only (no transcription assumption).
8) If student image submissions are provided, analyze visible content from those images and include concrete observations.
9) If an image cannot be accessed or analyzed, state that limitation briefly and do not fabricate visual details.
`;
const buildGeminiPrompt = (payload = {}, { scopeLabel = "submission" } = {}) => `
${buildSystemPrompt()}

Review this homework ${scopeLabel} JSON:
${JSON.stringify(payload, null, 2)}
`;

const isSkippableEligibilityError = (error) =>
  Number(error?.statusCode) === 400 && String(error?.code || "") === "BAD_REQUEST";

const resolveSubmissionTimestamp = (submission = {}) => {
  const candidates = [submission?.submitted_at, submission?.updatedAt, submission?.createdAt];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = new Date(candidate).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const dedupeImageItemsByUrl = (imageItems = []) => {
  const seen = new Set();
  const output = [];
  (Array.isArray(imageItems) ? imageItems : []).forEach((item) => {
    const url = normalizeText(item?.url);
    if (!url || seen.has(url)) return;
    seen.add(url);
    output.push(item);
  });
  return output;
};

const generateHomeworkAiReview = async ({
  userPromptPayload = {},
  imageItems = [],
  scopeLabel = "submission",
} = {}) => {
  if (!genAI) {
    throw createServiceError("Gemini API key is not configured", {
      statusCode: 503,
      code: "AI_PROVIDER_NOT_CONFIGURED",
    });
  }

  const safeImageItems = Array.isArray(imageItems) ? imageItems : [];
  const geminiImageParts = await buildGeminiImageParts(safeImageItems);
  const submittedImageCount = safeImageItems.length;

  const promptPayload = {
    ...userPromptPayload,
    constraints: {
      ...(userPromptPayload?.constraints && typeof userPromptPayload.constraints === "object"
        ? userPromptPayload.constraints
        : {}),
      allow_image_submission: submittedImageCount > 0,
      allow_image_analysis: geminiImageParts.length > 0,
      image_submission_count: submittedImageCount,
      image_analysis_count: geminiImageParts.length,
    },
  };

  const geminiContents = [
    { text: buildGeminiPrompt(promptPayload, { scopeLabel }) },
    ...geminiImageParts,
  ];

  const aiResult = await requestGeminiJsonWithFallback({
    genAI,
    models: GEMINI_MODELS,
    contents: geminiContents,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.25,
      maxOutputTokens: Number(process.env.HOMEWORK_AI_REVIEW_MAX_OUTPUT_TOKENS || 2000),
    },
    timeoutMs: Number(process.env.HOMEWORK_AI_REVIEW_TIMEOUT_MS || process.env.GEMINI_TIMEOUT_MS || 45000),
    maxAttempts: Number(process.env.HOMEWORK_AI_REVIEW_MAX_ATTEMPTS || process.env.GEMINI_MAX_ATTEMPTS || 2),
  });

  const normalizedReview = normalizeAiReviewResult(aiResult?.data || {});
  if (!normalizedReview.review) {
    throw createServiceError("AI review response is empty", {
      statusCode: 502,
      code: "AI_EMPTY_RESPONSE",
    });
  }

  return {
    normalizedReview,
    aiResult,
    geminiImageParts,
    submittedImageCount,
  };
};

export const generateHomeworkSubmissionAiReview = async ({
  submission,
  assignment,
  student,
  reviewer,
} = {}) => {
  const reviewPayload = buildHomeworkAiReviewPayload({
    submission,
    assignment,
    student,
  });

  const userPromptPayload = {
    assignment_title: reviewPayload.assignmentTitle,
    task_title: reviewPayload.taskTitle,
    student_name: reviewPayload.studentName,
    prompt_text: reviewPayload.promptText,
    reference_answer_text: reviewPayload.referenceAnswerText || "",
    student_answer_text: reviewPayload.studentAnswerText,
    student_image_urls: (Array.isArray(reviewPayload?.imageItems) ? reviewPayload.imageItems : [])
      .map((item) => normalizeText(item?.url))
      .filter(Boolean),
    reviewer: {
      id: normalizeText(reviewer?.id || reviewer?.userId),
      role: normalizeText(reviewer?.role),
    },
    constraints: {
      allow_audio_url: Boolean(reviewPayload?.audioItem?.url),
    },
  };

  const {
    normalizedReview,
    aiResult,
    geminiImageParts,
    submittedImageCount,
  } = await generateHomeworkAiReview({
    userPromptPayload,
    imageItems: reviewPayload?.imageItems || [],
    scopeLabel: "submission",
  });

  return {
    ...normalizedReview,
    meta: {
      model: aiResult?.model || null,
      generated_at: new Date().toISOString(),
      submission_id: reviewPayload.submissionId,
      assignment_id: reviewPayload.assignmentId,
      task_id: reviewPayload.taskId,
      student_id: reviewPayload.studentId,
      has_prompt_text: Boolean(reviewPayload.promptText),
      has_reference_answer: Boolean(reviewPayload.referenceAnswerText),
      source_summary: reviewPayload.meta,
      image_submission_count: submittedImageCount,
      image_analysis_count: geminiImageParts.length,
      image_analysis_skipped_count: Math.max(0, submittedImageCount - geminiImageParts.length),
    },
  };
};

export const generateHomeworkSectionAiReview = async ({
  assignment,
  section,
  submissions,
  student,
  reviewer,
} = {}) => {
  const normalizedSection =
    section && typeof section === "object" && !Array.isArray(section) ? section : {};
  const sectionLessons = (Array.isArray(normalizedSection?.lessons) ? normalizedSection.lessons : [])
    .map((lesson, lessonIndex) => ({
      task_id: normalizeText(lesson?._id),
      task_title: normalizeText(lesson?.name || lesson?.title || `Task ${lessonIndex + 1}`),
    }))
    .filter((lesson) => lesson.task_id);

  if (sectionLessons.length === 0) {
    throw createServiceError("Section has no lessons", {
      statusCode: 400,
      code: "BAD_REQUEST",
    });
  }

  const latestSubmissionByTaskId = new Map();
  (Array.isArray(submissions) ? submissions : []).forEach((submission) => {
    const taskId = normalizeText(submission?.task_id);
    if (!taskId) return;
    const current = latestSubmissionByTaskId.get(taskId);
    if (!current) {
      latestSubmissionByTaskId.set(taskId, submission);
      return;
    }
    if (resolveSubmissionTimestamp(submission) >= resolveSubmissionTimestamp(current)) {
      latestSubmissionByTaskId.set(taskId, submission);
    }
  });

  const reviewedTasks = [];
  const missingTasks = [];
  const skippedTasks = [];

  sectionLessons.forEach((lesson) => {
    const submission = latestSubmissionByTaskId.get(lesson.task_id);
    if (!submission) {
      missingTasks.push(lesson.task_title || lesson.task_id);
      return;
    }

    try {
      const taskPayload = buildHomeworkAiReviewPayload({
        submission,
        assignment,
        student,
      });
      reviewedTasks.push({
        task_id: taskPayload.taskId || lesson.task_id,
        task_title: taskPayload.taskTitle || lesson.task_title,
        submission_id: taskPayload.submissionId || normalizeText(submission?._id),
        prompt_text: taskPayload.promptText,
        reference_answer_text: taskPayload.referenceAnswerText || "",
        student_answer_text: taskPayload.studentAnswerText,
        source_summary: taskPayload.meta,
        has_audio_submission: Boolean(taskPayload?.audioItem?.url),
        image_items: Array.isArray(taskPayload?.imageItems) ? taskPayload.imageItems : [],
      });
    } catch (error) {
      if (!isSkippableEligibilityError(error)) {
        throw error;
      }
      skippedTasks.push({
        task_id: lesson.task_id,
        task_title: lesson.task_title || lesson.task_id,
        reason: normalizeText(error?.message || "Submission has no AI-review-eligible content"),
      });
    }
  });

  if (reviewedTasks.length === 0) {
    throw createServiceError("Section has no AI-review-eligible submissions", {
      statusCode: 400,
      code: "BAD_REQUEST",
    });
  }

  const sectionPromptText = reviewedTasks
    .map((task, index) => `Task ${index + 1} - ${task.task_title}\n${task.prompt_text}`)
    .join("\n\n");

  const sectionReferenceAnswerText = reviewedTasks
    .filter((task) => normalizeText(task.reference_answer_text))
    .map((task, index) => `Task ${index + 1} - ${task.task_title}\n${task.reference_answer_text}`)
    .join("\n\n");

  const sectionStudentAnswerText = reviewedTasks
    .map((task, index) => `Task ${index + 1} - ${task.task_title}\n${task.student_answer_text}`)
    .join("\n\n");

  const sectionImageItems = dedupeImageItemsByUrl(
    reviewedTasks.flatMap((task) => (Array.isArray(task.image_items) ? task.image_items : [])),
  );

  const userPromptPayload = {
    assignment_title: normalizeText(assignment?.title),
    section_title: normalizeText(normalizedSection?.name || normalizedSection?.title),
    student_name: normalizeText(student?.name),
    prompt_text: sectionPromptText,
    reference_answer_text: sectionReferenceAnswerText,
    student_answer_text: sectionStudentAnswerText,
    student_image_urls: sectionImageItems
      .map((item) => normalizeText(item?.url))
      .filter(Boolean),
    section_context: {
      total_tasks: sectionLessons.length,
      reviewed_task_count: reviewedTasks.length,
      missing_task_count: missingTasks.length,
      skipped_task_count: skippedTasks.length,
      missing_tasks: missingTasks,
      skipped_tasks: skippedTasks,
    },
    tasks: reviewedTasks.map((task) => ({
      task_id: task.task_id,
      task_title: task.task_title,
      prompt_text: task.prompt_text,
      reference_answer_text: task.reference_answer_text,
      student_answer_text: task.student_answer_text,
      source_summary: task.source_summary,
    })),
    reviewer: {
      id: normalizeText(reviewer?.id || reviewer?.userId),
      role: normalizeText(reviewer?.role),
    },
    constraints: {
      allow_audio_url: reviewedTasks.some((task) => Boolean(task?.has_audio_submission)),
    },
  };

  const {
    normalizedReview,
    aiResult,
    geminiImageParts,
    submittedImageCount,
  } = await generateHomeworkAiReview({
    userPromptPayload,
    imageItems: sectionImageItems,
    scopeLabel: "section",
  });

  return {
    ...normalizedReview,
    meta: {
      model: aiResult?.model || null,
      generated_at: new Date().toISOString(),
      assignment_id: normalizeText(assignment?._id),
      section_id: normalizeText(normalizedSection?._id),
      student_id: normalizeText(student?._id),
      reviewed_task_count: reviewedTasks.length,
      total_task_count: sectionLessons.length,
      missing_task_count: missingTasks.length,
      skipped_task_count: skippedTasks.length,
      reviewed_task_ids: reviewedTasks.map((task) => task.task_id),
      reviewed_submission_ids: reviewedTasks
        .map((task) => normalizeText(task?.submission_id))
        .filter(Boolean),
      missing_tasks: missingTasks,
      skipped_tasks: skippedTasks,
      has_prompt_text: Boolean(sectionPromptText),
      has_reference_answer: Boolean(sectionReferenceAnswerText),
      source_summary: reviewedTasks.map((task) => ({
        task_id: task.task_id,
        task_title: task.task_title,
        summary: task.source_summary,
      })),
      image_submission_count: submittedImageCount,
      image_analysis_count: geminiImageParts.length,
      image_analysis_skipped_count: Math.max(0, submittedImageCount - geminiImageParts.length),
    },
  };
};

