import mongoose from "mongoose";
import HomeworkGroup from "../models/HomeworkGroup.model.js";
import MonthlyAssignment from "../models/MonthlyAssignment.model.js";
import MonthlyAssignmentSubmission from "../models/MonthlyAssignmentSubmission.model.js";
import Passage from "../models/Passage.model.js";
import Section from "../models/Section.model.js";
import Speaking from "../models/Speaking.model.js";
import Test from "../models/Test.model.js";
import User from "../models/User.model.js";
import Writing from "../models/Writing.model.js";
import { ASSIGNMENT_STATUSES, CONTENT_BLOCK_TYPES, TASK_RESOURCE_MODES } from "../models/MonthlyAssignment.model.js";
import {
  buildHomeworkResourceObjectKey,
  buildHomeworkSubmissionAudioObjectKey,
  buildHomeworkSubmissionImageObjectKey,
  deleteHomeworkObject,
  getHomeworkAudioUploadLimitBytes,
  getHomeworkImageMaxFiles,
  getHomeworkImageUploadLimitBytes,
  isObjectStorageConfigured,
  uploadHomeworkResourceObject,
  uploadHomeworkSubmissionAudioObject,
  uploadHomeworkSubmissionImageObject,
} from "../services/objectStorage.service.js";
import {
  canGradeStudentForAssignment,
  canManageAssignment,
  isAdminUser,
  toObjectIdOrNull,
} from "../services/homeworkAccess.service.js";
import {
  issueHomeworkContextToken,
  trackHomeworkActivityOpen,
} from "../services/homeworkTrackingBridge.service.js";
import { generateHomeworkQuizBlock } from "../services/homeworkGen.service.js";
import { parsePagination, buildPaginationMeta } from "../utils/pagination.js";
import { handleControllerError, sendControllerError } from "../utils/controllerError.js";
import { STUDENT_ROLE_VALUES } from "../utils/role.utils.js";
import { calculateIELTSBand } from "../utils/ieltsUtils.js";


const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const TASK_RESOURCE_MODES_SET = new Set(TASK_RESOURCE_MODES);
const TASK_RESOURCE_REF_TYPES_SET = new Set(["passage", "section", "speaking", "writing", "test"]);
const CONTENT_BLOCK_TYPES_SET = new Set(CONTENT_BLOCK_TYPES);
const MATCH_COLOR_TOKENS = ["emerald", "sky", "amber", "fuchsia", "teal", "rose", "indigo", "lime"];

const HOMEWORK_IMAGE_MAX_BYTES = getHomeworkImageUploadLimitBytes();
const HOMEWORK_IMAGE_MAX_FILES = getHomeworkImageMaxFiles();
const HOMEWORK_AUDIO_MAX_BYTES = getHomeworkAudioUploadLimitBytes();
const HOMEWORK_SUBMISSION_MAX_BYTES = Math.max(HOMEWORK_IMAGE_MAX_BYTES, HOMEWORK_AUDIO_MAX_BYTES);

const normalizeOptionalString = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const toPlainObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const parseJsonObjectSafely = (value) => {
  if (value === undefined || value === null) return {};
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return {};
    try {
      const parsed = JSON.parse(normalized);
      return toPlainObject(parsed);
    } catch {
      return {};
    }
  }
  return toPlainObject(value);
};

const normalizeObjectiveAnswersPayload = (value) => {
  const parsed = parseJsonObjectSafely(value);
  const rawQuiz = Array.isArray(parsed.quiz) ? parsed.quiz : Array.isArray(parsed.quiz_answers) ? parsed.quiz_answers : [];
  const rawGapfill = Array.isArray(parsed.gapfill) ? parsed.gapfill : [];
  const rawFindMistake = Array.isArray(parsed.find_mistake) ? parsed.find_mistake : [];

  const quizMap = new Map();
  rawQuiz.forEach((entry) => {
    const questionKey = normalizeOptionalString(entry?.question_key ?? entry?.questionKey ?? entry?.key) || "";
    const selectedOptionId = normalizeOptionalString(
      entry?.selected_option_id ?? entry?.selectedOptionId ?? entry?.option_id ?? entry?.value,
    ) || "";
    if (!questionKey || !selectedOptionId) return;
    quizMap.set(questionKey, {
      question_key: questionKey,
      selected_option_id: selectedOptionId,
    });
  });

  const gapfillMap = new Map();
  rawGapfill.forEach((entry) => {
    const blankKey = normalizeOptionalString(entry?.blank_key ?? entry?.blankKey ?? entry?.key) || "";
    const answerValue = normalizeOptionalString(entry?.value ?? entry?.answer ?? entry?.text) || "";
    if (!blankKey || !answerValue) return;
    gapfillMap.set(blankKey, {
      blank_key: blankKey,
      value: answerValue,
    });
  });

  const findMistakeMap = new Map();
  rawFindMistake.forEach((entry) => {
    const lineKey = normalizeOptionalString(entry?.line_key ?? entry?.lineKey ?? entry?.key) || "";
    const tokenKey = normalizeOptionalString(entry?.token_key ?? entry?.tokenKey ?? entry?.value) || "";
    if (!lineKey || !tokenKey) return;
    findMistakeMap.set(lineKey, {
      line_key: lineKey,
      token_key: tokenKey,
    });
  });

  return {
    quiz: Array.from(quizMap.values()),
    gapfill: Array.from(gapfillMap.values()),
    find_mistake: Array.from(findMistakeMap.values()),
  };
};

const hasObjectiveAnswersPayload = (value = {}) => {
  const normalized = normalizeObjectiveAnswersPayload(value);
  return Boolean(
    normalized.quiz.length > 0
    || normalized.gapfill.length > 0
    || normalized.find_mistake.length > 0,
  );
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const parseDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const parseWeekOrNull = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const normalized = Math.floor(parsed);
  if (normalized < 1 || normalized > 5) return null;
  return normalized;
};

const parseBoundedInt = (value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = min } = {}) => {
  if (value === undefined || value === null || String(value).trim() === "") {
    return Math.max(min, Math.min(max, fallback));
  }
  const parsed = Number(value);
  const intValue = Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  return Math.max(min, Math.min(max, intValue));
};

const parseOptionalDateOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  return parseDateOrNull(value);
};

const sanitizeBlockData = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return {};
  }
};

const normalizeBlockId = (value, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || String(fallback || "").trim();
};

const resolveMatchColorToken = (value, fallbackIndex = 0) => {
  const normalized = String(value || "").trim();
  if (MATCH_COLOR_TOKENS.includes(normalized)) return normalized;
  return MATCH_COLOR_TOKENS[fallbackIndex % MATCH_COLOR_TOKENS.length];
};

const normalizeQuizLayout = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "list" ? "list" : "grid";
};

const sanitizeQuizOptionData = (option = {}, optionIndex = 0) => {
  const normalizedOption = option && typeof option === "object" && !Array.isArray(option) ? option : {};
  return {
    id: normalizeBlockId(normalizedOption.id, `option-${optionIndex + 1}`),
    text: normalizeOptionalString(normalizedOption.text) || "",
  };
};

const resolveQuizQuestionText = (question = {}) =>
  normalizeOptionalString(question?.question)
  || normalizeOptionalString(question?.text)
  || normalizeOptionalString(question?.question_html)
  || normalizeOptionalString(question?.prompt)
  || "";

const resolveQuizExplanationText = (question = {}) =>
  normalizeOptionalString(question?.explanation)
  || normalizeOptionalString(question?.explanation_html)
  || "";

const sanitizeQuizQuestionData = (question = {}, questionIndex = 0) => {
  const normalizedQuestion = question && typeof question === "object" && !Array.isArray(question) ? question : {};
  const rawOptions = Array.isArray(normalizedQuestion.options) ? normalizedQuestion.options : [];
  const normalizedOptions = rawOptions
    .map((option, optionIndex) => sanitizeQuizOptionData(option, optionIndex))
    .filter((option) => Boolean(option.id));
  const options = normalizedOptions.length >= 2
    ? normalizedOptions
    : [
      ...normalizedOptions,
      ...Array.from({ length: Math.max(0, 2 - normalizedOptions.length) }, (_, index) =>
        sanitizeQuizOptionData({}, normalizedOptions.length + index),
      ),
    ];

  const optionIdSet = new Set(options.map((option) => option.id));
  const allowMultiple = toBoolean(normalizedQuestion.allow_multiple, false);
  const requestedCorrectOptionIds = Array.isArray(normalizedQuestion.correct_option_ids)
    ? normalizedQuestion.correct_option_ids
    : normalizeOptionalString(normalizedQuestion.correct_option_id)
      ? [normalizedQuestion.correct_option_id]
      : [];

  const filteredCorrectOptionIds = requestedCorrectOptionIds
    .map((value) => normalizeBlockId(value))
    .filter((value) => optionIdSet.has(value));
  const uniqueCorrectOptionIds = Array.from(new Set(filteredCorrectOptionIds));

  return {
    id: normalizeBlockId(normalizedQuestion.id, `question-${questionIndex + 1}`),
    question: resolveQuizQuestionText(normalizedQuestion),
    explanation: resolveQuizExplanationText(normalizedQuestion),
    allow_multiple: allowMultiple,
    options,
    correct_option_ids: allowMultiple ? uniqueCorrectOptionIds : uniqueCorrectOptionIds.slice(0, 1),
  };
};

const sanitizePassageBlockData = (data = {}, blockIndex = 0) => {
  const normalizedData = sanitizeBlockData(data);
  return {
    ...normalizedData,
    block_id: normalizeBlockId(normalizedData.block_id, `block-${blockIndex + 1}`),
    text: String(normalizedData.text || ""),
  };
};

const sanitizeQuizBlockData = (data = {}, blockIndex = 0) => {
  const normalizedData = sanitizeBlockData(data);
  const hasLegacySingleQuestion =
    Boolean(normalizeOptionalString(normalizedData.question))
    || Boolean(normalizeOptionalString(normalizedData.text))
    || Boolean(normalizeOptionalString(normalizedData.question_html))
    || Boolean(normalizeOptionalString(normalizedData.prompt))
    || (Array.isArray(normalizedData.options) && normalizedData.options.length > 0);

  const rawQuestions = Array.isArray(normalizedData.questions) && normalizedData.questions.length > 0
    ? normalizedData.questions
    : hasLegacySingleQuestion
      ? [normalizedData]
      : [{}];

  const questions = rawQuestions
    .map((question, questionIndex) => sanitizeQuizQuestionData(question, questionIndex))
    .filter((question) => question.question || question.options.length > 0);

  return {
    block_id: normalizeBlockId(normalizedData.block_id, `block-${blockIndex + 1}`),
    layout: normalizeQuizLayout(normalizedData.layout),
    parent_passage_block_id: normalizeBlockId(normalizedData.parent_passage_block_id),
    questions: questions.length > 0 ? questions : [sanitizeQuizQuestionData({}, 0)],
  };
};

const sanitizeMatchingItemData = (item = {}, itemIndex = 0, side = "left") => {
  const normalizedItem = item && typeof item === "object" && !Array.isArray(item) ? item : {};
  return {
    id: normalizeBlockId(normalizedItem.id, `${side}-${itemIndex + 1}`),
    text: String(normalizedItem.text || ""),
  };
};

const sanitizeMatchingBlockData = (data = {}, blockIndex = 0) => {
  const normalizedData = sanitizeBlockData(data);
  const normalizedLeftItems = Array.isArray(normalizedData.left_items)
    ? normalizedData.left_items
      .map((item, itemIndex) => sanitizeMatchingItemData(item, itemIndex, "left"))
      .filter((item) => Boolean(item.id))
    : [];
  const normalizedRightItems = Array.isArray(normalizedData.right_items)
    ? normalizedData.right_items
      .map((item, itemIndex) => sanitizeMatchingItemData(item, itemIndex, "right"))
      .filter((item) => Boolean(item.id))
    : [];
  const normalizedRowCount = Math.max(normalizedLeftItems.length, normalizedRightItems.length, 2);
  const leftItems = Array.from({ length: normalizedRowCount }, (_, itemIndex) =>
    sanitizeMatchingItemData(normalizedLeftItems[itemIndex] || {}, itemIndex, "left"),
  );
  const rightItems = Array.from({ length: normalizedRowCount }, (_, itemIndex) =>
    sanitizeMatchingItemData(normalizedRightItems[itemIndex] || {}, itemIndex, "right"),
  );

  const leftIdSet = new Set(leftItems.map((item) => item.id));
  const rightIdSet = new Set(rightItems.map((item) => item.id));
  const usedLeft = new Set();
  const usedRight = new Set();
  const usedColors = new Set();
  const rawMatches = Array.isArray(normalizedData.matches) ? normalizedData.matches : [];
  const matches = [];

  rawMatches.forEach((pair, pairIndex) => {
    const leftId = normalizeBlockId(pair?.left_id);
    const rightId = normalizeBlockId(pair?.right_id);
    if (!leftId || !rightId) return;
    if (!leftIdSet.has(leftId) || !rightIdSet.has(rightId)) return;
    if (usedLeft.has(leftId) || usedRight.has(rightId)) return;

    let colorKey = resolveMatchColorToken(pair?.color_key, pairIndex);
    if (usedColors.has(colorKey)) {
      colorKey =
        MATCH_COLOR_TOKENS.find((token) => !usedColors.has(token))
        || MATCH_COLOR_TOKENS[matches.length % MATCH_COLOR_TOKENS.length];
    }

    usedLeft.add(leftId);
    usedRight.add(rightId);
    usedColors.add(colorKey);
    matches.push({
      left_id: leftId,
      right_id: rightId,
      color_key: colorKey,
    });
  });

  return {
    block_id: normalizeBlockId(normalizedData.block_id, `block-${blockIndex + 1}`),
    prompt: String(normalizedData.prompt || ""),
    left_items: leftItems,
    right_items: rightItems,
    matches,
  };
};

const sanitizeGapfillBlockData = (data = {}, blockIndex = 0) => {
  const normalizedData = sanitizeBlockData(data);
  const mode = ["numbered", "paragraph"].includes(String(normalizedData.mode || "").trim().toLowerCase())
    ? String(normalizedData.mode || "").trim().toLowerCase()
    : "numbered";
  const numberedItems = Array.isArray(normalizedData.numbered_items)
    ? normalizedData.numbered_items.map((item) => String(item || ""))
    : Array.isArray(normalizedData.sentences)
      ? normalizedData.sentences.map((item) => String(item || ""))
      : [];

  return {
    block_id: normalizeBlockId(normalizedData.block_id, `block-${blockIndex + 1}`),
    mode,
    prompt: String(normalizedData.prompt || ""),
    numbered_items: mode === "numbered" ? (numberedItems.length > 0 ? numberedItems : [""]) : numberedItems,
    paragraph_text: String(normalizedData.paragraph_text || normalizedData.text || ""),
  };
};

const sanitizeFindMistakeBlockData = (data = {}, blockIndex = 0) => {
  const normalizedData = sanitizeBlockData(data);
  const numberedItems = Array.isArray(normalizedData.numbered_items)
    ? normalizedData.numbered_items.map((item) => String(item || ""))
    : Array.isArray(normalizedData.sentences)
      ? normalizedData.sentences.map((item) => String(item || ""))
      : [];

  return {
    block_id: normalizeBlockId(normalizedData.block_id, `block-${blockIndex + 1}`),
    mode: "numbered",
    prompt: String(normalizedData.prompt || ""),
    numbered_items: numberedItems.length > 0 ? numberedItems : [""],
  };
};

const sanitizeDictationBlockData = (data = {}, blockIndex = 0) => {
  const normalizedData = sanitizeBlockData(data);
  return {
    block_id: normalizeBlockId(normalizedData.block_id, `block-${blockIndex + 1}`),
    prompt: String(normalizedData.prompt || ""),
    audio_url: String(normalizedData.audio_url || ""),
    audio_storage_key: String(normalizedData.audio_storage_key || ""),
    transcript: String(normalizedData.transcript || ""),
  };
};

const sanitizeAnswerBlockData = (data = {}, blockIndex = 0) => {
  const normalizedData = sanitizeBlockData(data);
  return {
    block_id: normalizeBlockId(normalizedData.block_id, `block-${blockIndex + 1}`),
    text: String(normalizedData.text || ""),
  };
};

const sanitizeBlockDataByType = (type, data, blockIndex) => {
  if (type === "passage") return sanitizePassageBlockData(data, blockIndex);
  if (type === "quiz") return sanitizeQuizBlockData(data, blockIndex);
  if (type === "matching") return sanitizeMatchingBlockData(data, blockIndex);
  if (type === "gapfill") return sanitizeGapfillBlockData(data, blockIndex);
  if (type === "find_mistake") return sanitizeFindMistakeBlockData(data, blockIndex);
  if (type === "dictation") return sanitizeDictationBlockData(data, blockIndex);
  if (type === "answer") return sanitizeAnswerBlockData(data, blockIndex);

  const normalizedData = sanitizeBlockData(data);
  return {
    ...normalizedData,
    block_id: normalizeBlockId(normalizedData.block_id, `block-${blockIndex + 1}`),
  };
};

const sanitizeContentBlocks = (blocks = []) => {
  if (!Array.isArray(blocks)) return [];
  const normalizedBlocks = blocks
    .map((block, index) => {
      const type = normalizeOptionalString(block?.type);
      if (!type || !CONTENT_BLOCK_TYPES_SET.has(type)) return null;
      return {
        type,
        order: index,
        data: sanitizeBlockDataByType(type, block?.data, index),
      };
    })
    .filter(Boolean);

  const passageBlockIdSet = new Set(
    normalizedBlocks
      .filter((block) => block.type === "passage")
      .map((block) => normalizeBlockId(block?.data?.block_id))
      .filter(Boolean),
  );

  return normalizedBlocks.map((block) => {
    if (block.type !== "quiz") return block;
    const parentPassageBlockId = normalizeBlockId(block?.data?.parent_passage_block_id);
    if (!parentPassageBlockId || passageBlockIdSet.has(parentPassageBlockId)) return block;
    return {
      ...block,
      data: {
        ...block.data,
        parent_passage_block_id: "",
      },
    };
  });
};

const toUniqueObjectIds = (values = []) => {
  const dedup = [];
  const seen = new Set();

  for (const value of Array.isArray(values) ? values : []) {
    const objectId = toObjectIdOrNull(value);
    if (!objectId) continue;
    const key = String(objectId);
    if (seen.has(key)) continue;
    seen.add(key);
    dedup.push(objectId);
  }

  return dedup;
};

const ensureMonthValue = (month, { optional = false } = {}) => {
  const normalized = normalizeOptionalString(month);
  if (!normalized && optional) return null;
  if (!normalized || !MONTH_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
};

const toObjectIdIfValid = (value) => {
  const normalized = normalizeOptionalString(value);
  if (!normalized || !mongoose.Types.ObjectId.isValid(normalized)) return null;
  return new mongoose.Types.ObjectId(normalized);
};

const sanitizeTaskInput = (task = {}, index = 0) => {
  const normalized = {
    type: normalizeOptionalString(task.type),
    title: normalizeOptionalString(task.title),
    instruction: normalizeOptionalString(task.instruction) || "",
    order: Number.isFinite(Number(task.order)) ? Math.max(0, Math.floor(Number(task.order))) : index,
    resource_mode: normalizeOptionalString(task.resource_mode) || "internal",
    resource_ref_type: normalizeOptionalString(task.resource_ref_type),
    resource_ref_id: normalizeOptionalString(task.resource_ref_id),
    resource_url: normalizeOptionalString(task.resource_url),
    resource_storage_key: normalizeOptionalString(task.resource_storage_key),
    requires_text: toBoolean(task.requires_text, false),
    requires_image: toBoolean(task.requires_image, false),
    requires_audio: toBoolean(task.requires_audio, false),
    min_words: Number.isFinite(Number(task.min_words)) ? Math.max(0, Math.floor(Number(task.min_words))) : null,
    max_words: Number.isFinite(Number(task.max_words)) ? Math.max(0, Math.floor(Number(task.max_words))) : null,
    due_date: parseDateOrNull(task.due_date),
  };
  if (Array.isArray(task.content_blocks)) {
    normalized.content_blocks = sanitizeContentBlocks(task.content_blocks);
  }

  const taskId = normalizeOptionalString(task._id);
  if (taskId && mongoose.Types.ObjectId.isValid(taskId)) {
    normalized._id = new mongoose.Types.ObjectId(taskId);
  }

  return normalized;
};

const sanitizeLessonInput = (lesson = {}, index = 0) => {
  const normalized = {
    name: normalizeOptionalString(lesson.name) || normalizeOptionalString(lesson.title),
    type: normalizeOptionalString(lesson.type) || "custom_task",
    instruction: normalizeOptionalString(lesson.instruction) || "",
    order: Number.isFinite(Number(lesson.order)) ? Math.max(0, Math.floor(Number(lesson.order))) : index,
    is_published: toBoolean(lesson.is_published, false),
    resource_mode: normalizeOptionalString(lesson.resource_mode) || "internal",
    resource_ref_type: normalizeOptionalString(lesson.resource_ref_type),
    resource_ref_id: normalizeOptionalString(lesson.resource_ref_id),
    resource_url: normalizeOptionalString(lesson.resource_url),
    resource_storage_key: normalizeOptionalString(lesson.resource_storage_key),
    requires_text: toBoolean(lesson.requires_text, false),
    requires_image: toBoolean(lesson.requires_image, false),
    requires_audio: toBoolean(lesson.requires_audio, false),
    min_words: Number.isFinite(Number(lesson.min_words)) ? Math.max(0, Math.floor(Number(lesson.min_words))) : null,
    max_words: Number.isFinite(Number(lesson.max_words)) ? Math.max(0, Math.floor(Number(lesson.max_words))) : null,
    due_date: parseDateOrNull(lesson.due_date),
  };
  if (Array.isArray(lesson.content_blocks)) {
    normalized.content_blocks = sanitizeContentBlocks(lesson.content_blocks);
  }

  const lessonId = toObjectIdIfValid(lesson._id);
  if (lessonId) normalized._id = lessonId;

  return normalized;
};

const sanitizeSectionInput = (section = {}, index = 0) => {
  const normalized = {
    name: normalizeOptionalString(section.name) || `Section ${index + 1}`,
    order: Number.isFinite(Number(section.order)) ? Math.max(0, Math.floor(Number(section.order))) : index,
    is_published: toBoolean(section.is_published, false),
    lessons: Array.isArray(section.lessons)
      ? section.lessons.map((lesson, lessonIndex) => sanitizeLessonInput(lesson, lessonIndex))
      : [],
  };

  const sectionId = toObjectIdIfValid(section._id);
  if (sectionId) normalized._id = sectionId;

  return normalized;
};

const ensureOutlineIds = (sections = []) =>
  (Array.isArray(sections) ? sections : []).map((section, sectionIndex) => ({
    ...section,
    _id: toObjectIdIfValid(section?._id) || new mongoose.Types.ObjectId(),
    order: Number.isFinite(Number(section?.order)) ? Number(section.order) : sectionIndex,
    lessons: (Array.isArray(section?.lessons) ? section.lessons : []).map((lesson, lessonIndex) => ({
      ...lesson,
      _id: toObjectIdIfValid(lesson?._id) || new mongoose.Types.ObjectId(),
      order: Number.isFinite(Number(lesson?.order)) ? Number(lesson.order) : lessonIndex,
    })),
  }));

const lessonToTaskPayload = (lesson = {}, index = 0) => {
  const task = sanitizeTaskInput(
    {
      _id: lesson._id || null,
      type: lesson.type,
      title: lesson.name || lesson.title || `Lesson ${index + 1}`,
      instruction: lesson.instruction,
      order: lesson.order,
      resource_mode: lesson.resource_mode,
      resource_ref_type: lesson.resource_ref_type,
      resource_ref_id: lesson.resource_ref_id,
      resource_url: lesson.resource_url,
      resource_storage_key: lesson.resource_storage_key,
      requires_text: lesson.requires_text,
      requires_image: lesson.requires_image,
      requires_audio: lesson.requires_audio,
      min_words: lesson.min_words,
      max_words: lesson.max_words,
      due_date: lesson.due_date,
      content_blocks: lesson.content_blocks,
    },
    index,
  );
  return task;
};

const flattenSectionsToTasks = (sections = []) => {
  const tasks = [];
  (Array.isArray(sections) ? sections : []).forEach((section, sectionIndex) => {
    const lessons = Array.isArray(section?.lessons) ? section.lessons : [];
    lessons.forEach((lesson, lessonIndex) => {
      const orderSeed = Number(sectionIndex * 1000 + lessonIndex);
      const task = lessonToTaskPayload(lesson, orderSeed);
      tasks.push(task);
    });
  });
  return tasks;
};

const buildLegacySectionsFromTasks = (tasks = []) => {
  const normalizedTasks = Array.isArray(tasks) ? tasks : [];
  if (!normalizedTasks.length) return [];

  return [
    {
      _id: new mongoose.Types.ObjectId(),
      name: "General",
      order: 0,
      is_published: true,
      lessons: normalizedTasks.map((task, index) => ({
        _id: toObjectIdIfValid(task?._id) || new mongoose.Types.ObjectId(),
        name: normalizeOptionalString(task?.title) || `Lesson ${index + 1}`,
        type: normalizeOptionalString(task?.type) || "custom_task",
        instruction: normalizeOptionalString(task?.instruction) || "",
        order: Number.isFinite(Number(task?.order)) ? Number(task.order) : index,
        is_published: true,
        resource_mode: normalizeOptionalString(task?.resource_mode) || "internal",
        resource_ref_type: normalizeOptionalString(task?.resource_ref_type),
        resource_ref_id: normalizeOptionalString(task?.resource_ref_id),
        resource_url: normalizeOptionalString(task?.resource_url),
        resource_storage_key: normalizeOptionalString(task?.resource_storage_key),
        requires_text: toBoolean(task?.requires_text, false),
        requires_image: toBoolean(task?.requires_image, false),
        requires_audio: toBoolean(task?.requires_audio, false),
        min_words: Number.isFinite(Number(task?.min_words)) ? Number(task.min_words) : null,
        max_words: Number.isFinite(Number(task?.max_words)) ? Number(task.max_words) : null,
        content_blocks: Array.isArray(task?.content_blocks)
          ? sanitizeContentBlocks(task.content_blocks)
          : [],
      })),
    },
  ];
};

const toPlainAssignmentObject = (assignment = {}) =>
  typeof assignment?.toObject === "function" ? assignment.toObject() : assignment;

const getAssignmentSections = (assignment = {}) => {
  const plain = toPlainAssignmentObject(assignment);
  const sections = Array.isArray(plain?.sections) ? plain.sections : [];
  if (sections.length > 0) {
    return sections.map((section, sectionIndex) => sanitizeSectionInput(section, sectionIndex));
  }
  return buildLegacySectionsFromTasks(plain?.tasks || []);
};

const getAssignmentTasks = (assignment = {}) => {
  const plain = toPlainAssignmentObject(assignment);
  const sections = getAssignmentSections(plain);
  if (sections.length > 0) return flattenSectionsToTasks(sections);
  const tasks = Array.isArray(plain?.tasks) ? plain.tasks : [];
  return tasks.map((task, index) => sanitizeTaskInput(task, index));
};

const sanitizeAssignmentPayload = (body = {}, { partial = false } = {}) => {
  const payload = {};

  if (!partial || Object.prototype.hasOwnProperty.call(body, "title")) {
    payload.title = normalizeOptionalString(body.title);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, "description")) {
    payload.description = normalizeOptionalString(body.description) || "";
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, "month")) {
    payload.month = ensureMonthValue(body.month, { optional: partial });
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, "week")) {
    payload.week = parseWeekOrNull(body.week);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, "due_date")) {
    payload.due_date = parseDateOrNull(body.due_date);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, "status")) {
    payload.status = normalizeOptionalString(body.status);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, "target_group_ids")) {
    payload.target_group_ids = toUniqueObjectIds(body.target_group_ids);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, "sections")) {
    const rawSections = Array.isArray(body.sections) ? body.sections : [];
    payload.sections = rawSections.map((section, index) => sanitizeSectionInput(section, index));
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, "tasks")) {
    const rawTasks = Array.isArray(body.tasks) ? body.tasks : [];
    payload.tasks = rawTasks.map((task, index) => sanitizeTaskInput(task, index));
  }

  if (Array.isArray(payload.sections) && payload.sections.length > 0) {
    payload.tasks = flattenSectionsToTasks(payload.sections);
  }

  if (!partial || Object.prototype.hasOwnProperty.call(body, "co_teachers")) {
    payload.co_teachers = toUniqueObjectIds(body.co_teachers);
  }

  return payload;
};

const validateTaskPayload = (task = {}, index = 0) => {
  const details = [];
  const taskOrder = Number.isFinite(Number(task.order)) ? Number(task.order) : index;
  const taskType = normalizeOptionalString(task.type) || "";

  if (!task.type) {
    details.push({ taskIndex: index, order: taskOrder, field: "type", message: "Task type is required" });
  }

  if (!task.title) {
    details.push({ taskIndex: index, order: taskOrder, field: "title", message: "Task title is required" });
  }

  if (!TASK_RESOURCE_MODES_SET.has(task.resource_mode)) {
    details.push({
      taskIndex: index,
      order: taskOrder,
      field: "resource_mode",
      message: "resource_mode must be one of internal|external_url|uploaded",
    });
  }

  if (task.resource_mode === "internal") {
    const isCustomTask = taskType === "custom_task";
    if (!isCustomTask) {
      if (!task.resource_ref_type || !TASK_RESOURCE_REF_TYPES_SET.has(task.resource_ref_type)) {
        details.push({
          taskIndex: index,
          order: taskOrder,
          field: "resource_ref_type",
          message: "resource_ref_type must be one of passage|section|speaking|writing|test for internal mode",
        });
      }
      if (!task.resource_ref_id) {
        details.push({
          taskIndex: index,
          order: taskOrder,
          field: "resource_ref_id",
          message: "resource_ref_id is required for internal mode",
        });
      }
    }
  }

  if (task.resource_mode === "external_url" && !task.resource_url) {
    details.push({
      taskIndex: index,
      order: taskOrder,
      field: "resource_url",
      message: "resource_url is required for external_url mode",
    });
  }

  if (task.resource_mode === "uploaded") {
    if (!task.resource_url) {
      details.push({
        taskIndex: index,
        order: taskOrder,
        field: "resource_url",
        message: "resource_url is required for uploaded mode",
      });
    }
    if (!task.resource_storage_key) {
      details.push({
        taskIndex: index,
        order: taskOrder,
        field: "resource_storage_key",
        message: "resource_storage_key is required for uploaded mode",
      });
    }
  }

  if (
    Number.isFinite(Number(task.min_words)) &&
    Number.isFinite(Number(task.max_words)) &&
    Number(task.max_words) < Number(task.min_words)
  ) {
    details.push({
      taskIndex: index,
      order: taskOrder,
      field: "max_words",
      message: "max_words must be greater than or equal to min_words",
    });
  }

  return details;
};

const validateAssignmentShape = (assignment = {}) => {
  const details = [];
  const sections = Array.isArray(assignment.sections) ? assignment.sections : [];
  const hasSections = sections.length > 0;
  const tasks = hasSections
    ? flattenSectionsToTasks(sections)
    : Array.isArray(assignment.tasks)
      ? assignment.tasks
      : [];

  if (!assignment.title) {
    details.push({ field: "title", message: "title is required" });
  }
  if (!assignment.month || !MONTH_PATTERN.test(assignment.month)) {
    details.push({ field: "month", message: "month must be in YYYY-MM format" });
  }
  if (!Number.isInteger(assignment.week) || assignment.week < 1 || assignment.week > 5) {
    details.push({ field: "week", message: "week must be between 1 and 5" });
  }
  if (!(assignment.due_date instanceof Date) || Number.isNaN(assignment.due_date.getTime())) {
    details.push({ field: "due_date", message: "due_date is required and must be valid" });
  }
  if (!assignment.status || !ASSIGNMENT_STATUSES.includes(assignment.status)) {
    details.push({ field: "status", message: "status must be one of draft|published|archived" });
  }
  if (!Array.isArray(assignment.target_group_ids) || assignment.target_group_ids.length === 0) {
    details.push({ field: "target_group_ids", message: "At least one target group is required" });
  }
  if (hasSections) {
    let totalLessons = 0;
    sections.forEach((section, sectionIndex) => {
      if (!normalizeOptionalString(section?.name)) {
        details.push({
          field: "sections",
          sectionIndex,
          message: "Section name is required",
        });
      }
      const lessons = Array.isArray(section?.lessons) ? section.lessons : [];
      totalLessons += lessons.length;
      lessons.forEach((lesson, lessonIndex) => {
        if (!normalizeOptionalString(lesson?.name)) {
          details.push({
            field: "sections.lessons",
            sectionIndex,
            lessonIndex,
            message: "Lesson name is required",
          });
        }
      });
    });
    if (totalLessons === 0) {
      details.push({ field: "sections", message: "At least one lesson is required" });
    }
  } else if (!Array.isArray(assignment.tasks) || assignment.tasks.length === 0) {
    details.push({ field: "tasks", message: "At least one task is required" });
  }

  if (Array.isArray(tasks)) {
    tasks.forEach((task, index) => {
      details.push(...validateTaskPayload(task, index));
    });
  }

  return details;
};

const normalizeGroupPayload = (body = {}, { partial = false } = {}) => {
  const payload = {};
  if (!partial || Object.prototype.hasOwnProperty.call(body, "name")) {
    payload.name = normalizeOptionalString(body.name);
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, "description")) {
    payload.description = normalizeOptionalString(body.description) || "";
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, "level_label")) {
    payload.level_label = normalizeOptionalString(body.level_label) || "";
  }
  if (!partial || Object.prototype.hasOwnProperty.call(body, "student_ids")) {
    payload.student_ids = toUniqueObjectIds(body.student_ids);
  }
  return payload;
};

const assertStudentsValidOrRespond = async (req, res, studentIds = []) => {
  if (!Array.isArray(studentIds)) return false;
  if (!studentIds.length) return true;

  const students = await User.find({
    _id: { $in: studentIds },
    role: { $in: STUDENT_ROLE_VALUES },
  })
    .select("_id")
    .lean();

  if (students.length !== studentIds.length) {
    sendControllerError(req, res, {
      statusCode: 400,
      code: "HOMEWORK_INVALID_TARGET_GROUP",
      message: "student_ids contains one or more invalid students",
    });
    return false;
  }

  return true;
};

const assertTargetGroupsOrRespond = async (req, res, targetGroupIds = []) => {
  if (!Array.isArray(targetGroupIds) || targetGroupIds.length === 0) {
    sendControllerError(req, res, {
      statusCode: 400,
      code: "HOMEWORK_INVALID_TARGET_GROUP",
      message: "At least one target group is required",
    });
    return null;
  }

  const groups = await HomeworkGroup.find({
    _id: { $in: targetGroupIds },
    is_active: true,
  })
    .select("_id")
    .lean();

  if (groups.length !== targetGroupIds.length) {
    sendControllerError(req, res, {
      statusCode: 400,
      code: "HOMEWORK_INVALID_TARGET_GROUP",
      message: "One or more target groups are invalid or inactive",
    });
    return null;
  }

  return targetGroupIds;
};

const INTERNAL_REF_MODEL_MAP = {
  passage: Passage,
  section: Section,
  speaking: Speaking,
  writing: Writing,
  test: Test,
};

const assertInternalRefsOrRespond = async (req, res, tasks = []) => {
  const grouped = {
    passage: new Set(),
    section: new Set(),
    speaking: new Set(),
    writing: new Set(),
    test: new Set(),
  };

  tasks.forEach((task) => {
    if (task.resource_mode !== "internal") return;
    const refType = String(task.resource_ref_type || "").trim();
    const refId = String(task.resource_ref_id || "").trim();
    if (!refType || !refId || !grouped[refType]) return;
    grouped[refType].add(refId);
  });

  const missingRefs = [];
  for (const [refType, idSet] of Object.entries(grouped)) {
    const ids = Array.from(idSet);
    if (!ids.length) continue;

    const model = INTERNAL_REF_MODEL_MAP[refType];
    if (!model) {
      ids.forEach((id) => missingRefs.push({ refType, refId: id }));
      continue;
    }

    const existingDocs = await model.find({ _id: { $in: ids } }).select("_id").lean();
    const existingSet = new Set(existingDocs.map((item) => String(item?._id || "")));
    ids.forEach((id) => {
      if (!existingSet.has(String(id))) {
        missingRefs.push({ refType, refId: id });
      }
    });
  }

  if (missingRefs.length > 0) {
    sendControllerError(req, res, {
      statusCode: 400,
      code: "HOMEWORK_INVALID_RESOURCE_REF",
      message: "One or more internal resources do not exist",
      details: missingRefs,
    });
    return false;
  }

  return true;
};

const collectSubmissionStorageKeys = (submission = {}) => {
  const keys = [];
  const imageItems = Array.isArray(submission?.image_items) ? submission.image_items : [];
  imageItems.forEach((item) => {
    const key = normalizeOptionalString(item?.storage_key);
    if (key) keys.push(key);
  });
  const audioKey = normalizeOptionalString(submission?.audio_item?.storage_key);
  if (audioKey) keys.push(audioKey);
  return keys;
};

const collectTaskStorageKeys = (tasks = []) => {
  const keys = [];
  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const key = normalizeOptionalString(task?.resource_storage_key);
    if (key) keys.push(key);
    const blocks = Array.isArray(task?.content_blocks) ? task.content_blocks : [];
    blocks.forEach((block) => {
      const blockType = normalizeOptionalString(block?.type);
      if (blockType !== "dictation") return;
      const dictationKey = normalizeOptionalString(block?.data?.audio_storage_key);
      if (dictationKey) keys.push(dictationKey);
    });
  });
  return keys;
};

const collectAssignmentTaskStorageKeys = (assignment = {}) =>
  collectTaskStorageKeys(getAssignmentTasks(assignment));

const deleteHomeworkKeysBestEffort = async (req, keys = []) => {
  const uniqueKeys = Array.from(new Set((Array.isArray(keys) ? keys : []).filter(Boolean)));
  if (!uniqueKeys.length) return;

  for (const key of uniqueKeys) {
    try {
      await deleteHomeworkObject(key);
    } catch (error) {
      console.warn(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: "warn",
          route: req?.route?.path || "homework",
          requestId: req?.requestId || null,
          userId: req?.user?.userId || null,
          key,
          message: "Failed to cleanup homework object",
          error: {
            code: error?.code || null,
            message: error?.message || "Unknown cleanup error",
          },
        }),
      );
    }
  }
};

const getStudentGroupIds = async (studentId) => {
  const groups = await HomeworkGroup.find({
    is_active: true,
    student_ids: studentId,
  })
    .select("_id")
    .lean();

  return groups.map((group) => group._id);
};

const normalizeIdString = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (typeof value === "object") {
    if (value._id !== undefined && value._id !== null) return String(value._id).trim();
    if (value.id !== undefined && value.id !== null) return String(value.id).trim();
  }
  return String(value).trim();
};

const isAssignmentVisibleToStudent = (assignment = {}, studentGroupIds = []) => {
  if (!assignment || String(assignment.status || "").toLowerCase() !== "published") return false;
  const targetGroupIds = Array.isArray(assignment.target_group_ids) ? assignment.target_group_ids : [];
  const studentGroupSet = new Set((studentGroupIds || []).map((id) => normalizeIdString(id)).filter(Boolean));
  return targetGroupIds.some((groupId) => studentGroupSet.has(normalizeIdString(groupId)));
};

const getEffectivePublishedSections = (assignment = {}) => {
  if (String(assignment?.status || "").toLowerCase() !== "published") return [];
  const sections = getAssignmentSections(assignment);
  return sections
    .filter((section) => toBoolean(section?.is_published, false))
    .map((section) => ({
      ...section,
      lessons: (Array.isArray(section?.lessons) ? section.lessons : [])
        .filter((lesson) => toBoolean(lesson?.is_published, false)),
    }))
    .filter((section) => Array.isArray(section.lessons) && section.lessons.length > 0);
};

const findLessonByTaskId = (assignment = {}, taskId) => {
  const targetId = String(taskId || "");
  const sections = getAssignmentSections(assignment);
  for (const section of sections) {
    const lessons = Array.isArray(section?.lessons) ? section.lessons : [];
    const lesson = lessons.find((item) => String(item?._id || "") === targetId);
    if (lesson) {
      return { section, lesson };
    }
  }
  return null;
};

const resolveHomeworkLaunchUrl = ({ resourceRefType, resourceRefId, hwctx }) => {
  const normalizedType = String(resourceRefType || "").trim().toLowerCase();
  const normalizedRefId = String(resourceRefId || "").trim();
  const params = new URLSearchParams();
  if (hwctx) params.set("hwctx", hwctx);

  const appendQuery = (path) => {
    const query = params.toString();
    return query ? `${path}?${query}` : path;
  };

  if (normalizedType === "speaking") {
    return appendQuery(`/student-ielts/speaking/${normalizedRefId}`);
  }
  if (normalizedType === "passage") {
    params.set("standalone", "reading");
    return appendQuery(`/student-ielts/tests/${normalizedRefId}/exam`);
  }
  if (normalizedType === "section") {
    params.set("standalone", "listening");
    return appendQuery(`/student-ielts/tests/${normalizedRefId}/exam`);
  }
  if (normalizedType === "writing") {
    params.set("standalone", "writing");
    return appendQuery(`/student-ielts/tests/${normalizedRefId}/exam`);
  }
  return appendQuery(`/student-ielts/tests/${normalizedRefId}/exam`);
};

const getRemovedLessonIds = (beforeSections = [], afterSections = []) => {
  const beforeIds = new Set();
  (Array.isArray(beforeSections) ? beforeSections : []).forEach((section) => {
    (Array.isArray(section?.lessons) ? section.lessons : []).forEach((lesson) => {
      const lessonId = normalizeOptionalString(lesson?._id);
      if (lessonId) beforeIds.add(lessonId);
    });
  });

  const afterIds = new Set();
  (Array.isArray(afterSections) ? afterSections : []).forEach((section) => {
    (Array.isArray(section?.lessons) ? section.lessons : []).forEach((lesson) => {
      const lessonId = normalizeOptionalString(lesson?._id);
      if (lessonId) afterIds.add(lessonId);
    });
  });

  return Array.from(beforeIds).filter((lessonId) => !afterIds.has(lessonId));
};

const removeStudentHiddenBlocksFromSections = (sections = []) =>
  (Array.isArray(sections) ? sections : []).map((section) => ({
    ...section,
    lessons: (Array.isArray(section?.lessons) ? section.lessons : []).map((lesson) => ({
      ...lesson,
      content_blocks: (Array.isArray(lesson?.content_blocks) ? lesson.content_blocks : [])
        .filter((block) => normalizeOptionalString(block?.type) !== "answer")
        .map((block) => {
          const blockType = normalizeOptionalString(block?.type);
          if (blockType !== "dictation") return block;
          const blockData = sanitizeBlockData(block?.data);
          const { transcript, ...restData } = blockData;
          return {
            ...block,
            data: restData,
          };
        }),
    })),
  }));

const mapAssignmentForResponse = (assignment = {}, { forStudent = false } = {}) => {
  const plain = toPlainAssignmentObject(assignment);
  const sections = forStudent ? getEffectivePublishedSections(plain) : getAssignmentSections(plain);
  const normalizedSections = forStudent ? removeStudentHiddenBlocksFromSections(sections) : sections;
  const tasks = flattenSectionsToTasks(normalizedSections);
  return {
    ...plain,
    sections: normalizedSections,
    tasks,
  };
};

const getAssignmentTargetStudents = async (assignment = {}) => {
  const targetGroupIds = Array.isArray(assignment?.target_group_ids)
    ? assignment.target_group_ids.map((id) => toObjectIdOrNull(id)).filter(Boolean)
    : [];
  if (!targetGroupIds.length) return [];

  const groups = await HomeworkGroup.find({ _id: { $in: targetGroupIds } })
    .select("student_ids")
    .lean();

  const studentIdSet = new Set();
  groups.forEach((group) => {
    (Array.isArray(group?.student_ids) ? group.student_ids : []).forEach((studentId) => {
      const normalizedId = String(studentId || "").trim();
      if (normalizedId) studentIdSet.add(normalizedId);
    });
  });

  if (!studentIdSet.size) return [];

  const students = await User.find({
    _id: { $in: Array.from(studentIdSet).map((id) => new mongoose.Types.ObjectId(id)) },
    role: { $in: STUDENT_ROLE_VALUES },
  })
    .select("_id name email homeroom_teacher_id")
    .lean();

  return students;
};

const filterStudentsByGradeScope = ({ students = [], assignment, user }) => {
  if (isAdminUser(user)) return students;

  return students.filter((student) => {
    const permission = canGradeStudentForAssignment({ assignment, student, user });
    return permission.allowed;
  });
};

const resolveScoreSnapshot = (meta = null) => {
  const snapshotRaw = meta && typeof meta === "object" ? meta.score_snapshot : null;
  if (snapshotRaw === undefined || snapshotRaw === null || snapshotRaw === "") return null;
  const parsed = Number(snapshotRaw);
  return Number.isFinite(parsed) ? parsed : null;
};

const toFiniteNumberOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const mapSubmissionToResponse = (submission = {}) => ({
  _id: submission._id,
  assignment_id: submission.assignment_id,
  task_id: submission.task_id,
  student_id: submission.student_id,
  text_answer: submission.text_answer || "",
  image_items: Array.isArray(submission.image_items) ? submission.image_items : [],
  audio_item: submission.audio_item || null,
  status: submission.status,
  score: submission.score,
  teacher_feedback: submission.teacher_feedback || "",
  graded_by: submission.graded_by || null,
  graded_at: submission.graded_at || null,
  submitted_at: submission.submitted_at || null,
  updatedAt: submission.updatedAt || null,
  submission_source: submission.submission_source || "manual_homework",
  linked_test_attempt_id: submission.linked_test_attempt_id || null,
  meta: submission?.meta && typeof submission.meta === "object" ? submission.meta : {},
  score_snapshot: resolveScoreSnapshot(submission?.meta),
  internal_score: resolveScoreSnapshot(submission?.meta) ?? (submission?.score ?? null),
});

const parseScoreOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 10) / 10;
};

const isSubmittedHomeworkStatus = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized === "submitted" || normalized === "graded";
};

const buildInternalSlotKey = ({ blockId = "", resourceRefType = "", resourceRefId = "" } = {}) => {
  const normalizedBlockId = String(blockId || "").trim();
  if (normalizedBlockId) return `block:${normalizedBlockId}`;
  const normalizedType = String(resourceRefType || "").trim().toLowerCase();
  const normalizedRefId = String(resourceRefId || "").trim();
  if (!normalizedType || !normalizedRefId) return "";
  return `ref:${normalizedType}:${normalizedRefId}`;
};

const collectInternalResourceSlotsForTask = (task = {}) => {
  const slots = [];
  const blockRefKeys = new Set();

  const pushSlot = ({
    resourceRefType,
    resourceRefId,
    blockId = "",
    resourceSlotKey = "",
    slotIndex = 0,
  } = {}) => {
    const normalizedType = String(resourceRefType || "").trim().toLowerCase();
    const normalizedRefId = String(resourceRefId || "").trim();
    if (!normalizedType || !normalizedRefId) return;
    const normalizedBlockId = String(blockId || "").trim();
    // Internal blocks are independent completion units. Always keep one slot per block.
    const blockIdForKey = normalizedBlockId || `internal-${slotIndex + 1}`;
    const configuredSlotKey = String(resourceSlotKey || "").trim();
    const slotKey = configuredSlotKey || buildInternalSlotKey({
      blockId: blockIdForKey,
      resourceRefType: normalizedType,
      resourceRefId: normalizedRefId,
    });
    if (!slotKey) return;
    slots.push({
      resource_slot_key: slots.some((slot) => slot.resource_slot_key === slotKey)
        ? `${slotKey}:${slotIndex}`
        : slotKey,
      resource_block_id: blockIdForKey,
      resource_ref_type: normalizedType,
      resource_ref_id: normalizedRefId,
    });
  };

  const contentBlocks = Array.isArray(task?.content_blocks) ? task.content_blocks : [];
  contentBlocks.forEach((block, blockIndex) => {
    if (String(block?.type || "").trim().toLowerCase() !== "internal") return;
    const blockData = block?.data && typeof block.data === "object" ? block.data : {};
    const resourceRefType = String(blockData?.resource_ref_type || "").trim().toLowerCase();
    const resourceRefId = String(blockData?.resource_ref_id || "").trim();
    if (!resourceRefType || !resourceRefId) return;
    blockRefKeys.add(`${resourceRefType}:${resourceRefId}`);
    pushSlot({
      resourceRefType,
      resourceRefId,
      blockId: String(blockData?.block_id || "").trim(),
      resourceSlotKey: String(blockData?.resource_slot_key || "").trim(),
      slotIndex: blockIndex,
    });
  });

  if (String(task?.resource_mode || "").trim().toLowerCase() === "internal") {
    const rootType = String(task?.resource_ref_type || "").trim().toLowerCase();
    const rootRefId = String(task?.resource_ref_id || "").trim();
    const rootRefKey = `${rootType}:${rootRefId}`;
    if (rootType && rootRefId && !blockRefKeys.has(rootRefKey)) {
      pushSlot({
        resourceRefType: rootType,
        resourceRefId: rootRefId,
        slotIndex: contentBlocks.length,
      });
    }
  }

  return slots;
};

const parseInternalCompletionRowsFromMeta = (meta = {}) => {
  const normalizedMeta = meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
  const rows = Array.isArray(normalizedMeta.internal_content_completions)
    ? normalizedMeta.internal_content_completions
    : [];
  const normalizedRows = rows
    .map((row) => {
      const resourceRefType = String(row?.resource_ref_type || "").trim().toLowerCase();
      const resourceRefId = String(row?.resource_ref_id || "").trim();
      const resourceBlockId = String(row?.resource_block_id || "").trim();
      const resourceSlotKey = String(row?.resource_slot_key || "").trim()
        || buildInternalSlotKey({
          blockId: resourceBlockId,
          resourceRefType,
          resourceRefId,
        });
      if (!resourceSlotKey && (!resourceRefType || !resourceRefId)) return null;
      return {
        resource_slot_key: resourceSlotKey,
        resource_block_id: resourceBlockId,
        resource_ref_type: resourceRefType,
        resource_ref_id: resourceRefId,
        submitted_at: row?.submitted_at || null,
        linked_test_attempt_id: String(row?.linked_test_attempt_id || "").trim(),
        score_snapshot: toFiniteNumberOrNull(row?.score_snapshot),
      };
    })
    .filter(Boolean);

  // Merge repeated rows for the same slot identity.
  const rowMap = new Map();
  normalizedRows.forEach((row) => {
    const key = String(row?.resource_slot_key || "").trim()
      || buildInternalSlotKey({
        blockId: String(row?.resource_block_id || "").trim(),
        resourceRefType: String(row?.resource_ref_type || "").trim().toLowerCase(),
        resourceRefId: String(row?.resource_ref_id || "").trim(),
      });
    if (!key) return;
    const current = rowMap.get(key);
    if (!current) {
      rowMap.set(key, {
        ...row,
        resource_slot_key: key,
      });
      return;
    }
    const currentTs = new Date(current?.submitted_at || 0).getTime() || 0;
    const nextTs = new Date(row?.submitted_at || 0).getTime() || 0;
    if (nextTs >= currentTs) {
      rowMap.set(key, {
        ...current,
        ...row,
        resource_slot_key: key,
      });
    }
  });

  return Array.from(rowMap.values());
};

const buildInternalSubmissionItemsForTask = ({ task = {}, submission = null } = {}) => {
  const slots = collectInternalResourceSlotsForTask(task);
  if (!slots.length) return [];
  const completionRows = parseInternalCompletionRowsFromMeta(submission?.meta);

  return slots.map((slot) => {
    const slotKey = String(slot?.resource_slot_key || "").trim();
    const slotBlockId = String(slot?.resource_block_id || "").trim();
    const slotResourceType = String(slot?.resource_ref_type || "").trim().toLowerCase();
    const slotResourceRefId = String(slot?.resource_ref_id || "").trim();
    const matchedCompletion = completionRows.find((row) => {
      if (slotKey && String(row?.resource_slot_key || "").trim() === slotKey) return true;
      if (
        slotBlockId
        && String(row?.resource_block_id || "").trim()
        && String(row?.resource_block_id || "").trim() === slotBlockId
      ) {
        return true;
      }
      return (
        slotResourceType
        && slotResourceRefId
        && String(row?.resource_ref_type || "").trim().toLowerCase() === slotResourceType
        && String(row?.resource_ref_id || "").trim() === slotResourceRefId
      );
    });

    const completedAt = matchedCompletion?.submitted_at || null;
    return {
      slot_key: slotKey,
      resource_block_id: slotBlockId,
      resource_ref_type: slotResourceType,
      resource_ref_id: slotResourceRefId,
      status: completedAt ? "completed" : "not_started",
      completed_at: completedAt,
      linked_test_attempt_id: String(matchedCompletion?.linked_test_attempt_id || "").trim() || null,
      score_snapshot: toFiniteNumberOrNull(matchedCompletion?.score_snapshot),
    };
  });
};

const resolveCompletedInternalSlotKeysForTask = ({ task = {}, submission = null } = {}) => {
  const slots = collectInternalResourceSlotsForTask(task);
  const completed = new Set();
  if (!submission || slots.length === 0) return { slots, completed };

  const completionRows = parseInternalCompletionRowsFromMeta(submission?.meta);
  completionRows.forEach((row) => {
    const matchedSlot = slots.find((slot) => {
      if (row.resource_slot_key && slot.resource_slot_key === row.resource_slot_key) return true;
      if (row.resource_block_id && slot.resource_block_id && row.resource_block_id === slot.resource_block_id) {
        return true;
      }
      return (
        row.resource_ref_type
        && row.resource_ref_id
        && row.resource_ref_type === slot.resource_ref_type
        && row.resource_ref_id === slot.resource_ref_id
      );
    });
    if (matchedSlot?.resource_slot_key) {
      completed.add(matchedSlot.resource_slot_key);
    }
  });

  const legacyResourceType = String(submission?.meta?.resource_ref_type || "").trim().toLowerCase();
  const legacyResourceId = String(submission?.meta?.resource_ref_id || "").trim();
  if (legacyResourceType && legacyResourceId) {
    const matchedLegacySlot = slots.find(
      (slot) =>
        slot.resource_ref_type === legacyResourceType
        && slot.resource_ref_id === legacyResourceId,
    );
    if (matchedLegacySlot?.resource_slot_key) {
      completed.add(matchedLegacySlot.resource_slot_key);
    }
  }

  if (completed.size === 0 && isSubmittedHomeworkStatus(submission?.status)) {
    if (slots.length === 1) {
      completed.add(slots[0].resource_slot_key);
    } else if (slots.length > 1) {
      // Legacy fallback for historical submissions without slot-level metadata.
      completed.add(slots[0].resource_slot_key);
    }
  }

  return { slots, completed };
};

const resolveTaskProgressUnits = ({ task = {}, submission = null } = {}) => {
  const isInternalTask = String(task?.resource_mode || "").trim().toLowerCase() === "internal";
  const { slots, completed } = resolveCompletedInternalSlotKeysForTask({ task, submission });
  const hasMultiInternalSlots = isInternalTask && slots.length > 1;

  if (hasMultiInternalSlots) {
    const completedUnits = completed.size;
    return {
      totalUnits: slots.length,
      completedUnits,
      gradedUnits: String(submission?.status || "").trim().toLowerCase() === "graded" ? completedUnits : 0,
    };
  }

  const completedUnits = isSubmittedHomeworkStatus(submission?.status) ? 1 : 0;
  return {
    totalUnits: 1,
    completedUnits,
    gradedUnits: String(submission?.status || "").trim().toLowerCase() === "graded" ? 1 : 0,
  };
};

const mapAssignmentForStudent = (assignment = {}, submissions = []) => {
  const mappedAssignment = mapAssignmentForResponse(assignment, { forStudent: true });
  const tasks = Array.isArray(mappedAssignment.tasks) ? mappedAssignment.tasks : [];
  const submissionByTaskId = new Map();
  submissions.forEach((submission) => {
    const taskId = String(submission?.task_id || "");
    if (!taskId) return;
    submissionByTaskId.set(taskId, submission);
  });

  let totalUnits = 0;
  let submittedUnits = 0;
  let gradedUnits = 0;
  tasks.forEach((task) => {
    const taskId = String(task?._id || "");
    const submission = submissionByTaskId.get(taskId) || null;
    const { totalUnits: taskTotal, completedUnits, gradedUnits: taskGraded } =
      resolveTaskProgressUnits({ task, submission });
    totalUnits += taskTotal;
    submittedUnits += completedUnits;
    gradedUnits += taskGraded;
  });

  return {
    ...mappedAssignment,
    progress: {
      submitted_tasks: submittedUnits,
      total_tasks: totalUnits,
      graded_tasks: gradedUnits,
      pending_tasks: Math.max(0, totalUnits - submittedUnits),
    },
  };
};

const resolveAssignmentResourceKeysToDeleteOnUpdate = (existingAssignment, nextTasks = []) => {
  const currentTasks = getAssignmentTasks(existingAssignment);
  const currentKeys = new Set(collectTaskStorageKeys(currentTasks));
  const keepKeys = new Set(collectTaskStorageKeys(nextTasks));
  return Array.from(currentKeys).filter((storageKey) => !keepKeys.has(storageKey));
};

const purgeSubmissionByLessonIds = async (req, assignmentId, lessonIds = []) => {
  const normalizedLessonIds = (Array.isArray(lessonIds) ? lessonIds : [])
    .filter((lessonId) => mongoose.Types.ObjectId.isValid(lessonId))
    .map((lessonId) => new mongoose.Types.ObjectId(lessonId));
  if (!normalizedLessonIds.length) return;

  const submissions = await MonthlyAssignmentSubmission.find({
    assignment_id: assignmentId,
    task_id: { $in: normalizedLessonIds },
  }).lean();

  const storageKeys = submissions.flatMap((submission) => collectSubmissionStorageKeys(submission));
  await MonthlyAssignmentSubmission.deleteMany({
    assignment_id: assignmentId,
    task_id: { $in: normalizedLessonIds },
  });
  await deleteHomeworkKeysBestEffort(req, storageKeys);
};

export const createHomeworkGroup = async (req, res) => {
  try {
    const payload = normalizeGroupPayload(req.body);
    if (!payload.name) {
      return sendControllerError(req, res, {
        statusCode: 400,
        message: "name is required",
      });
    }

    const isStudentsValid = await assertStudentsValidOrRespond(req, res, payload.student_ids || []);
    if (!isStudentsValid) return;

    const group = await HomeworkGroup.create({
      ...payload,
      created_by: req.user.userId,
      updated_by: req.user.userId,
      is_active: true,
    });

    return res.status(201).json({ success: true, data: group });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const getHomeworkGroups = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });
    const includeInactive = toBoolean(req.query.include_inactive, false);
    const q = normalizeOptionalString(req.query.q);

    const filter = {};
    if (!includeInactive) filter.is_active = true;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { level_label: { $regex: q, $options: "i" } },
      ];
    }

    const [totalItems, groups] = await Promise.all([
      HomeworkGroup.countDocuments(filter),
      HomeworkGroup.find(filter)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("created_by", "name email role")
        .populate("student_ids", "name email role homeroom_teacher_id")
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: groups,
      pagination: buildPaginationMeta({ page, limit, totalItems }),
    });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const getHomeworkGroupById = async (req, res) => {
  try {
    const group = await HomeworkGroup.findById(req.params.id)
      .populate("created_by", "name email role")
      .populate("updated_by", "name email role")
      .populate("student_ids", "name email role homeroom_teacher_id")
      .lean();

    if (!group) {
      return sendControllerError(req, res, { statusCode: 404, message: "Homework group not found" });
    }

    return res.status(200).json({ success: true, data: group });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const updateHomeworkGroup = async (req, res) => {
  try {
    const existingGroup = await HomeworkGroup.findById(req.params.id);
    if (!existingGroup) {
      return sendControllerError(req, res, { statusCode: 404, message: "Homework group not found" });
    }

    const isOwner = String(existingGroup.created_by) === String(req.user.userId);
    if (!isAdminUser(req.user) && !isOwner) {
      return sendControllerError(req, res, {
        statusCode: 403,
        message: "Only group creator can update this group",
      });
    }

    const payload = normalizeGroupPayload(req.body, { partial: true });
    if (Object.keys(payload).length === 0) {
      return sendControllerError(req, res, {
        statusCode: 400,
        message: "No valid update fields provided",
      });
    }

    if (Object.prototype.hasOwnProperty.call(payload, "name") && !payload.name) {
      return sendControllerError(req, res, {
        statusCode: 400,
        message: "name cannot be empty",
      });
    }

    if (Object.prototype.hasOwnProperty.call(payload, "student_ids")) {
      const isStudentsValid = await assertStudentsValidOrRespond(req, res, payload.student_ids || []);
      if (!isStudentsValid) return;
    }

    payload.updated_by = req.user.userId;

    const updated = await HomeworkGroup.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    }).lean();

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const deleteHomeworkGroup = async (req, res) => {
  try {
    const existingGroup = await HomeworkGroup.findById(req.params.id);
    if (!existingGroup) {
      return sendControllerError(req, res, { statusCode: 404, message: "Homework group not found" });
    }

    const isOwner = String(existingGroup.created_by) === String(req.user.userId);
    if (!isAdminUser(req.user) && !isOwner) {
      return sendControllerError(req, res, {
        statusCode: 403,
        message: "Only group creator can delete this group",
      });
    }

    await HomeworkGroup.findByIdAndUpdate(
      req.params.id,
      { is_active: false, updated_by: req.user.userId },
      { new: true, runValidators: true },
    );

    return res.status(200).json({ success: true, message: "Homework group archived" });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const createHomeworkAssignment = async (req, res) => {
  try {
    const payload = sanitizeAssignmentPayload(req.body);
    payload.status = payload.status || "draft";
    payload.sections =
      Array.isArray(payload.sections) && payload.sections.length > 0
        ? payload.sections
        : buildLegacySectionsFromTasks(payload.tasks);
    payload.tasks = flattenSectionsToTasks(payload.sections);

    const shapeErrors = validateAssignmentShape(payload);
    if (shapeErrors.length > 0) {
      return sendControllerError(req, res, {
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Invalid assignment payload",
        details: shapeErrors,
      });
    }

    const targetGroupIds = await assertTargetGroupsOrRespond(req, res, payload.target_group_ids);
    if (!targetGroupIds) return;

    const isRefsValid = await assertInternalRefsOrRespond(req, res, payload.tasks);
    if (!isRefsValid) return;

    const assignment = await MonthlyAssignment.create({
      ...payload,
      target_group_ids: targetGroupIds,
      created_by: req.user.userId,
      updated_by: req.user.userId,
      sections: payload.sections,
      tasks: payload.tasks,
    });

    return res.status(201).json({ success: true, data: mapAssignmentForResponse(assignment) });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const getHomeworkAssignments = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });

    const filter = {};
    const month = ensureMonthValue(req.query.month, { optional: true });
    if (month) filter.month = month;

    const week = parseWeekOrNull(req.query.week);
    if (week) filter.week = week;

    const status = normalizeOptionalString(req.query.status);
    if (status && ASSIGNMENT_STATUSES.includes(status)) {
      filter.status = status;
    }

    const owner = normalizeOptionalString(req.query.owner);
    if (owner === "me") {
      filter.$or = [
        { created_by: req.user.userId },
        { co_teachers: req.user.userId },
      ];
    } else if (owner && mongoose.Types.ObjectId.isValid(owner)) {
      filter.$or = [
        { created_by: owner },
        { co_teachers: owner },
      ];
    }

    const listSelect = "title description month week due_date status target_group_ids created_by updated_by co_teachers createdAt updatedAt";

    const [totalItems, assignments] = await Promise.all([
      MonthlyAssignment.countDocuments(filter),
      MonthlyAssignment.find(filter)
        .select(listSelect)
        .sort({ month: -1, week: 1, due_date: 1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("created_by", "name email role")
        .populate("target_group_ids", "name level_label is_active")
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: assignments.map((item) => ({
        ...item,
        can_manage: canManageAssignment({ assignment: item, user: req.user }),
      })),
      pagination: buildPaginationMeta({ page, limit, totalItems }),
    });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const getHomeworkAssignmentById = async (req, res) => {
  try {
    const assignment = await MonthlyAssignment.findById(req.params.id)
      .populate("created_by", "name email role")
      .populate("updated_by", "name email role")
      .populate("target_group_ids", "name level_label is_active")
      .populate("co_teachers", "name email role")
      .lean();

    if (!assignment) {
      return sendControllerError(req, res, { statusCode: 404, message: "Assignment not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        ...mapAssignmentForResponse(assignment),
        can_manage: canManageAssignment({ assignment, user: req.user }),
      },
    });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const updateHomeworkAssignment = async (req, res) => {
  try {
    const assignment = await MonthlyAssignment.findById(req.params.id);
    if (!assignment) {
      return sendControllerError(req, res, { statusCode: 404, message: "Assignment not found" });
    }

    if (!canManageAssignment({ assignment, user: req.user })) {
      return sendControllerError(req, res, {
        statusCode: 403,
        message: "You do not have permission to update this assignment",
      });
    }

    const updatePayload = sanitizeAssignmentPayload(req.body, { partial: true });
    if (Object.keys(updatePayload).length === 0) {
      return sendControllerError(req, res, {
        statusCode: 400,
        message: "No valid update fields provided",
      });
    }

    const hasSectionsInPayload = Object.prototype.hasOwnProperty.call(updatePayload, "sections");
    const hasTasksInPayload = Object.prototype.hasOwnProperty.call(updatePayload, "tasks");
    const existingSections = getAssignmentSections(assignment);
    const nextSections = hasSectionsInPayload
      ? updatePayload.sections
      : hasTasksInPayload
        ? buildLegacySectionsFromTasks(updatePayload.tasks)
        : existingSections;
    const nextTasks = flattenSectionsToTasks(nextSections);

    const nextData = {
      title: Object.prototype.hasOwnProperty.call(updatePayload, "title")
        ? updatePayload.title
        : assignment.title,
      description: Object.prototype.hasOwnProperty.call(updatePayload, "description")
        ? updatePayload.description
        : assignment.description,
      month: Object.prototype.hasOwnProperty.call(updatePayload, "month")
        ? updatePayload.month
        : assignment.month,
      week: Object.prototype.hasOwnProperty.call(updatePayload, "week")
        ? updatePayload.week
        : assignment.week,
      due_date: Object.prototype.hasOwnProperty.call(updatePayload, "due_date")
        ? updatePayload.due_date
        : assignment.due_date,
      status: Object.prototype.hasOwnProperty.call(updatePayload, "status")
        ? updatePayload.status
        : assignment.status,
      target_group_ids: Object.prototype.hasOwnProperty.call(updatePayload, "target_group_ids")
        ? updatePayload.target_group_ids
        : assignment.target_group_ids,
      sections: nextSections,
      tasks: nextTasks,
    };

    const shapeErrors = validateAssignmentShape(nextData);
    if (shapeErrors.length > 0) {
      return sendControllerError(req, res, {
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Invalid assignment payload",
        details: shapeErrors,
      });
    }

    const targetGroupIds = await assertTargetGroupsOrRespond(req, res, nextData.target_group_ids);
    if (!targetGroupIds) return;

    const isRefsValid = await assertInternalRefsOrRespond(req, res, nextData.tasks);
    if (!isRefsValid) return;

    const removedResourceKeys = resolveAssignmentResourceKeysToDeleteOnUpdate(
      assignment.toObject(),
      nextData.tasks,
    );
    const removedLessonIds = getRemovedLessonIds(existingSections, nextSections);

    const updated = await MonthlyAssignment.findByIdAndUpdate(
      req.params.id,
      {
        ...nextData,
        target_group_ids: targetGroupIds,
        updated_by: req.user.userId,
      },
      { new: true, runValidators: true },
    );

    await purgeSubmissionByLessonIds(req, assignment._id, removedLessonIds);
    await deleteHomeworkKeysBestEffort(req, removedResourceKeys);

    return res.status(200).json({ success: true, data: mapAssignmentForResponse(updated) });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const patchHomeworkAssignmentOutline = async (req, res) => {
  try {
    const assignment = await MonthlyAssignment.findById(req.params.id);
    if (!assignment) {
      return sendControllerError(req, res, { statusCode: 404, message: "Assignment not found" });
    }

    if (!canManageAssignment({ assignment, user: req.user })) {
      return sendControllerError(req, res, {
        statusCode: 403,
        message: "You do not have permission to update this assignment",
      });
    }

    const rawSections = Array.isArray(req.body?.sections) ? req.body.sections : null;
    if (!rawSections) {
      return sendControllerError(req, res, {
        statusCode: 400,
        message: "sections is required",
      });
    }

    const nextSections = ensureOutlineIds(rawSections.map((section, index) => sanitizeSectionInput(section, index)));
    const nextTasks = flattenSectionsToTasks(nextSections);
    const shapeErrors = validateAssignmentShape({
      ...toPlainAssignmentObject(assignment),
      sections: nextSections,
      tasks: nextTasks,
    });
    if (shapeErrors.length > 0) {
      return sendControllerError(req, res, {
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Invalid assignment outline payload",
        details: shapeErrors,
      });
    }

    const isRefsValid = await assertInternalRefsOrRespond(req, res, nextTasks);
    if (!isRefsValid) return;

    const existingSections = getAssignmentSections(assignment);
    const removedLessonIds = getRemovedLessonIds(existingSections, nextSections);
    const removedResourceKeys = resolveAssignmentResourceKeysToDeleteOnUpdate(
      assignment.toObject(),
      nextTasks,
    );

    const updated = await MonthlyAssignment.findByIdAndUpdate(
      assignment._id,
      {
        sections: nextSections,
        tasks: nextTasks,
        updated_by: req.user.userId,
      },
      { new: true, runValidators: true },
    );

    await purgeSubmissionByLessonIds(req, assignment._id, removedLessonIds);
    await deleteHomeworkKeysBestEffort(req, removedResourceKeys);

    return res.status(200).json({
      success: true,
      data: mapAssignmentForResponse(updated),
    });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const getHomeworkAssignmentLessonById = async (req, res) => {
  try {
    const assignment = await MonthlyAssignment.findById(req.params.id)
      .populate("created_by", "name email role")
      .lean();
    if (!assignment) {
      return sendControllerError(req, res, { statusCode: 404, message: "Assignment not found" });
    }

    if (!canManageAssignment({ assignment, user: req.user })) {
      return sendControllerError(req, res, {
        statusCode: 403,
        message: "You do not have permission to view this lesson",
      });
    }

    const lessonMatch = findLessonByTaskId(assignment, req.params.lessonId);
    if (!lessonMatch) {
      return sendControllerError(req, res, { statusCode: 404, message: "Lesson not found" });
    }

    return res.status(200).json({
      success: true,
      data: {
        assignment: mapAssignmentForResponse(assignment),
        section: lessonMatch.section,
        lesson: lessonMatch.lesson,
      },
    });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const patchHomeworkAssignmentLessonById = async (req, res) => {
  try {
    const assignment = await MonthlyAssignment.findById(req.params.id);
    if (!assignment) {
      return sendControllerError(req, res, { statusCode: 404, message: "Assignment not found" });
    }

    if (!canManageAssignment({ assignment, user: req.user })) {
      return sendControllerError(req, res, {
        statusCode: 403,
        message: "You do not have permission to update this lesson",
      });
    }

    const sections = ensureOutlineIds(getAssignmentSections(assignment));
    let targetSectionIndex = -1;
    let targetLessonIndex = -1;

    sections.forEach((section, sectionIndex) => {
      if (targetSectionIndex >= 0) return;
      const lessonIndex = (section.lessons || []).findIndex(
        (lesson) => String(lesson?._id || "") === String(req.params.lessonId || ""),
      );
      if (lessonIndex >= 0) {
        targetSectionIndex = sectionIndex;
        targetLessonIndex = lessonIndex;
      }
    });

    if (targetSectionIndex < 0 || targetLessonIndex < 0) {
      return sendControllerError(req, res, { statusCode: 404, message: "Lesson not found" });
    }

    const currentLesson = sections[targetSectionIndex].lessons[targetLessonIndex];
    const patch = sanitizeLessonInput(
      {
        ...req.body,
        _id: currentLesson._id,
      },
      targetLessonIndex,
    );
    const mergedLesson = {
      ...currentLesson,
      ...patch,
      _id: currentLesson._id,
      name: Object.prototype.hasOwnProperty.call(req.body || {}, "name")
        ? patch.name
        : currentLesson.name,
      is_published: Object.prototype.hasOwnProperty.call(req.body || {}, "is_published")
        ? patch.is_published
        : currentLesson.is_published,
      due_date: Object.prototype.hasOwnProperty.call(req.body || {}, "due_date")
        ? patch.due_date
        : currentLesson.due_date,
    };
    sections[targetSectionIndex].lessons[targetLessonIndex] = mergedLesson;

    const nextTasks = flattenSectionsToTasks(sections);
    const isRefsValid = await assertInternalRefsOrRespond(req, res, nextTasks);
    if (!isRefsValid) return;

    const shapeErrors = validateAssignmentShape({
      ...toPlainAssignmentObject(assignment),
      sections,
      tasks: nextTasks,
    });
    if (shapeErrors.length > 0) {
      return sendControllerError(req, res, {
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Invalid lesson payload",
        details: shapeErrors,
      });
    }

    const removedResourceKeys = resolveAssignmentResourceKeysToDeleteOnUpdate(
      assignment.toObject(),
      nextTasks,
    );

    const updated = await MonthlyAssignment.findByIdAndUpdate(
      assignment._id,
      {
        sections,
        tasks: nextTasks,
        updated_by: req.user.userId,
      },
      { new: true, runValidators: true },
    );

    await deleteHomeworkKeysBestEffort(req, removedResourceKeys);

    const match = findLessonByTaskId(updated, req.params.lessonId);
    return res.status(200).json({
      success: true,
      data: {
        assignment: mapAssignmentForResponse(updated),
        section: match?.section || null,
        lesson: match?.lesson || null,
      },
    });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const generateHomeworkQuizBlockByAI = async (req, res) => {
  try {
    const prompt = normalizeOptionalString(req.body?.prompt);
    if (!prompt) {
      return sendControllerError(req, res, {
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "prompt is required",
      });
    }

    const questionCount = parseBoundedInt(req.body?.question_count, {
      min: 1,
      max: 20,
      fallback: 4,
    });
    const optionsPerQuestion = parseBoundedInt(req.body?.options_per_question, {
      min: 2,
      max: 6,
      fallback: 4,
    });
    const passageText = normalizeOptionalString(req.body?.passage_text) || "";

    const generated = await generateHomeworkQuizBlock({
      prompt,
      passageText,
      questionCount,
      optionsPerQuestion,
    });

    const generatedQuestions = Array.isArray(generated?.questions) ? generated.questions : [];
    const normalizedQuizQuestionPayload = generatedQuestions.map((question, questionIndex) => ({
      id: `question-${questionIndex + 1}`,
      question: String(question?.question || question?.text || "").trim(),
      allow_multiple: false,
      options: (Array.isArray(question?.options) ? question.options : []).map((option, optionIndex) => ({
        id: `option-${optionIndex + 1}`,
        text: String(typeof option === "string" ? option : (option?.text || option?.value || "")).trim(),
      })),
      correct_option_ids: [],
    }));

    const sanitizedQuizBlock = sanitizeQuizBlockData(
      {
        layout: "grid",
        questions: normalizedQuizQuestionPayload,
      },
      0,
    );

    const quizBlock = {
      ...sanitizedQuizBlock,
      questions: (Array.isArray(sanitizedQuizBlock.questions) ? sanitizedQuizBlock.questions : []).map((question) => ({
        ...question,
        allow_multiple: false,
        correct_option_ids: [],
      })),
    };

    return res.status(200).json({
      success: true,
      data: {
        quiz_block: quizBlock,
        meta: {
          model: generated?.meta?.model || null,
          question_count: questionCount,
          options_per_question: optionsPerQuestion,
        },
      },
    });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const updateHomeworkAssignmentStatus = async (req, res) => {
  try {
    const assignment = await MonthlyAssignment.findById(req.params.id);
    if (!assignment) {
      return sendControllerError(req, res, { statusCode: 404, message: "Assignment not found" });
    }

    if (!canManageAssignment({ assignment, user: req.user })) {
      return sendControllerError(req, res, {
        statusCode: 403,
        message: "You do not have permission to update this assignment",
      });
    }

    const status = normalizeOptionalString(req.body?.status);
    if (!status || !ASSIGNMENT_STATUSES.includes(status)) {
      return sendControllerError(req, res, {
        statusCode: 400,
        message: "status must be one of draft|published|archived",
      });
    }

    assignment.status = status;
    assignment.updated_by = req.user.userId;
    await assignment.save();

    return res.status(200).json({ success: true, data: mapAssignmentForResponse(assignment) });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const deleteHomeworkAssignment = async (req, res) => {
  try {
    const assignment = await MonthlyAssignment.findById(req.params.id).lean();
    if (!assignment) {
      return sendControllerError(req, res, { statusCode: 404, message: "Assignment not found" });
    }

    if (!canManageAssignment({ assignment, user: req.user })) {
      return sendControllerError(req, res, {
        statusCode: 403,
        message: "You do not have permission to delete this assignment",
      });
    }

    const submissions = await MonthlyAssignmentSubmission.find({
      assignment_id: assignment._id,
    }).lean();

    const assignmentResourceKeys = collectAssignmentTaskStorageKeys(assignment);
    const submissionResourceKeys = submissions.flatMap((submission) => collectSubmissionStorageKeys(submission));
    const resourceKeys = [...assignmentResourceKeys, ...submissionResourceKeys];

    await Promise.all([
      MonthlyAssignmentSubmission.deleteMany({ assignment_id: assignment._id }),
      MonthlyAssignment.deleteOne({ _id: assignment._id }),
    ]);

    await deleteHomeworkKeysBestEffort(req, resourceKeys);

    return res.status(200).json({ success: true, message: "Assignment deleted" });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const uploadHomeworkAssignmentResource = async (req, res) => {
  try {
    if (!isObjectStorageConfigured()) {
      return sendControllerError(req, res, {
        statusCode: 503,
        code: "OBJECT_STORAGE_NOT_CONFIGURED",
        message: "Object storage is not configured",
      });
    }

    if (!req.file) {
      return sendControllerError(req, res, {
        statusCode: 400,
        code: "RESOURCE_FILE_REQUIRED",
        message: "resource file is required",
      });
    }

    const assignmentId = normalizeOptionalString(req.body?.assignment_id) || "temp-assignment";
    const taskId = normalizeOptionalString(req.body?.task_id) || "task";
    const key = buildHomeworkResourceObjectKey({
      assignmentId,
      taskId,
      originalFileName: req.file.originalname,
    });

    const uploaded = await uploadHomeworkResourceObject({
      key,
      buffer: req.file.buffer,
      contentType: req.file.mimetype || "application/octet-stream",
      size: req.file.size,
    });

    return res.status(200).json({
      success: true,
      data: {
        url: uploaded.url,
        key: uploaded.key,
        contentType: req.file.mimetype || "application/octet-stream",
        size: req.file.size,
      },
    });
  } catch (error) {
    if (error?.statusCode) {
      return sendControllerError(req, res, {
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
      });
    }
    return handleControllerError(req, res, error);
  }
};

export const getMyHomeworkAssignments = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
    const month = ensureMonthValue(req.query.month, { optional: true });
    if (req.query.month && !month) {
      return sendControllerError(req, res, {
        statusCode: 400,
        message: "month must be in YYYY-MM format",
      });
    }

    const groupIds = await getStudentGroupIds(req.user.userId);
    if (!groupIds.length) {
      return res.status(200).json({ success: true, data: [], pagination: buildPaginationMeta({ page, limit, totalItems: 0 }) });
    }

    const filter = {
      status: "published",
      target_group_ids: { $in: groupIds },
    };
    if (month) filter.month = month;

    const [totalItems, assignments] = await Promise.all([
      MonthlyAssignment.countDocuments(filter),
      MonthlyAssignment.find(filter)
        .sort({ month: -1, week: 1, due_date: 1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("target_group_ids", "name level_label")
        .lean(),
    ]);

    if (!assignments.length) {
      return res.status(200).json({ success: true, data: [], pagination: buildPaginationMeta({ page, limit, totalItems }) });
    }

    const assignmentIds = assignments.map((assignment) => assignment._id);
    const submissions = await MonthlyAssignmentSubmission.find({
      assignment_id: { $in: assignmentIds },
      student_id: req.user.userId,
    }).lean();

    const submissionsByAssignment = new Map();
    submissions.forEach((submission) => {
      const key = String(submission.assignment_id);
      if (!submissionsByAssignment.has(key)) submissionsByAssignment.set(key, []);
      submissionsByAssignment.get(key).push(submission);
    });

    const enriched = assignments.map((assignment) =>
      mapAssignmentForStudent(assignment, submissionsByAssignment.get(String(assignment._id)) || []),
    );

    return res.status(200).json({ success: true, data: enriched, pagination: buildPaginationMeta({ page, limit, totalItems }) });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const getMyHomeworkAssignmentById = async (req, res) => {
  try {
    const assignmentId = req.params.assignmentId;
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return sendControllerError(req, res, { statusCode: 400, message: "Invalid assignment id" });
    }

    const assignment = await MonthlyAssignment.findById(assignmentId)
      .populate("target_group_ids", "name level_label")
      .lean();
    if (!assignment) {
      return sendControllerError(req, res, { statusCode: 404, message: "Assignment not found" });
    }

    const groupIds = await getStudentGroupIds(req.user.userId);
    if (!isAssignmentVisibleToStudent(assignment, groupIds)) {
      return sendControllerError(req, res, { statusCode: 403, message: "Forbidden" });
    }

    const submissions = await MonthlyAssignmentSubmission.find({
      assignment_id: assignment._id,
      student_id: req.user.userId,
    }).lean();

    const mappedAssignment = mapAssignmentForStudent(assignment, submissions);
    const visibleTaskIds = new Set(
      (Array.isArray(mappedAssignment.tasks) ? mappedAssignment.tasks : []).map((task) =>
        String(task?._id || ""),
      ),
    );
    const visibleSubmissions = submissions.filter((submission) =>
      visibleTaskIds.has(String(submission?.task_id || "")),
    );

    return res.status(200).json({
      success: true,
      data: {
        ...mappedAssignment,
        submissions: visibleSubmissions.map(mapSubmissionToResponse),
      },
    });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const launchMyHomeworkTaskTracking = async (req, res) => {
  try {
    const assignmentId = req.params.assignmentId;
    const taskId = req.params.taskId;
    if (!mongoose.Types.ObjectId.isValid(assignmentId) || !mongoose.Types.ObjectId.isValid(taskId)) {
      return sendControllerError(req, res, { statusCode: 400, message: "Invalid assignment/task id" });
    }

    const assignment = await MonthlyAssignment.findById(assignmentId)
      .select("status due_date target_group_ids sections tasks")
      .lean();
    if (!assignment) {
      return sendControllerError(req, res, { statusCode: 404, message: "Assignment not found" });
    }

    const studentGroupIds = await getStudentGroupIds(req.user.userId);
    if (!isAssignmentVisibleToStudent(assignment, studentGroupIds)) {
      return sendControllerError(req, res, { statusCode: 403, message: "Forbidden" });
    }

    const lessonMatch = findLessonByTaskId(assignment, taskId);
    if (!lessonMatch) {
      return sendControllerError(req, res, { statusCode: 404, message: "Task not found" });
    }
    const { section, lesson } = lessonMatch;
    if (!toBoolean(section?.is_published, false) || !toBoolean(lesson?.is_published, false)) {
      return sendControllerError(req, res, {
        statusCode: 403,
        message: "Lesson is not published for student access",
      });
    }

    const task = lessonToTaskPayload(lesson, 0);
    if (task.resource_mode !== "internal") {
      return sendControllerError(req, res, {
        statusCode: 400,
        message: "Launch tracking is only available for internal resources",
      });
    }

    const requestedResourceRefType = String(req.body?.resource_ref_type || "").trim().toLowerCase();
    const requestedResourceRefId = String(req.body?.resource_ref_id || "").trim();
    const requestedResourceBlockId = String(req.body?.resource_block_id || "").trim();
    const requestedResourceSlotKey = String(req.body?.resource_slot_key || "").trim();
    const internalSlots = collectInternalResourceSlotsForTask(task);
    const isMultiInternalTask = internalSlots.length > 1;

    let selectedSlot = null;
    if (requestedResourceSlotKey) {
      selectedSlot = internalSlots.find(
        (slot) => String(slot?.resource_slot_key || "").trim() === requestedResourceSlotKey,
      );
    }
    if (!selectedSlot && requestedResourceBlockId) {
      selectedSlot = internalSlots.find(
        (slot) => String(slot?.resource_block_id || "").trim() === requestedResourceBlockId,
      );
    }
    if (!selectedSlot && requestedResourceRefType && requestedResourceRefId) {
      const matchedByRef = internalSlots.filter(
        (slot) =>
          String(slot?.resource_ref_type || "").trim().toLowerCase() === requestedResourceRefType
          && String(slot?.resource_ref_id || "").trim() === requestedResourceRefId,
      );
      if (matchedByRef.length === 1) {
        selectedSlot = matchedByRef[0];
      } else if (matchedByRef.length > 1) {
        return sendControllerError(req, res, {
          statusCode: 400,
          message: "Ambiguous internal slot. Use resource_slot_key or resource_block_id.",
        });
      }
    }
    if (!selectedSlot && !isMultiInternalTask && internalSlots.length > 0) {
      selectedSlot = internalSlots[0];
    }
    if (isMultiInternalTask && !selectedSlot) {
      return sendControllerError(req, res, {
        statusCode: 400,
        message: "resource_slot_key (or resource_block_id) is required for multi-internal launch.",
      });
    }

    const selectedResourceRefType = String(
      selectedSlot?.resource_ref_type || (!isMultiInternalTask ? task.resource_ref_type : "") || "",
    ).trim();
    const selectedResourceRefId = String(
      selectedSlot?.resource_ref_id || (!isMultiInternalTask ? task.resource_ref_id : "") || "",
    ).trim();
    const selectedResourceBlockId = String(
      selectedSlot?.resource_block_id || requestedResourceBlockId || "",
    ).trim();
    const selectedResourceSlotKey = String(
      selectedSlot?.resource_slot_key || requestedResourceSlotKey || "",
    ).trim();

    if (!selectedResourceRefType || !selectedResourceRefId) {
      return sendControllerError(req, res, {
        statusCode: 400,
        message: "Task internal resource is not configured",
      });
    }

    const hwctx = issueHomeworkContextToken({
      studentId: req.user.userId,
      assignmentId,
      taskId,
      resourceRefType: selectedResourceRefType,
      resourceRefId: selectedResourceRefId,
      resourceBlockId: selectedResourceBlockId,
      resourceSlotKey: selectedResourceSlotKey,
      nonce: req.body?.event_id,
    });

    const trackingResult = await trackHomeworkActivityOpen({
      studentId: req.user.userId,
      resourceRefType: selectedResourceRefType,
      resourceRefId: selectedResourceRefId,
      hwctx,
      eventId: req.body?.event_id,
      tabSessionId: req.body?.tab_session_id,
      clientTs: req.body?.client_ts,
      payload: {
        source: "homework_launch",
      },
    });

    const launchUrl = resolveHomeworkLaunchUrl({
      resourceRefType: selectedResourceRefType,
      resourceRefId: selectedResourceRefId,
      hwctx,
    });

    return res.status(200).json({
      success: true,
      data: {
        launch_url: launchUrl,
        student_assignment_status: trackingResult?.status || "opened",
        tracked: Boolean(trackingResult?.tracked),
        resource_slot_key: selectedResourceSlotKey || null,
      },
    });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const upsertMyHomeworkTaskSubmission = async (req, res) => {
  try {
    const assignmentId = req.params.assignmentId;
    const taskId = req.params.taskId;
    if (!mongoose.Types.ObjectId.isValid(assignmentId) || !mongoose.Types.ObjectId.isValid(taskId)) {
      return sendControllerError(req, res, { statusCode: 400, message: "Invalid assignment/task id" });
    }

    const assignment = await MonthlyAssignment.findById(assignmentId).lean();
    if (!assignment) {
      return sendControllerError(req, res, { statusCode: 404, message: "Assignment not found" });
    }

    const studentGroupIds = await getStudentGroupIds(req.user.userId);
    if (!isAssignmentVisibleToStudent(assignment, studentGroupIds)) {
      return sendControllerError(req, res, { statusCode: 403, message: "Forbidden" });
    }

    const lessonMatch = findLessonByTaskId(assignment, taskId);
    if (!lessonMatch) {
      return sendControllerError(req, res, { statusCode: 404, message: "Task not found" });
    }
    const { section, lesson } = lessonMatch;
    if (!toBoolean(section?.is_published, false) || !toBoolean(lesson?.is_published, false)) {
      return sendControllerError(req, res, {
        statusCode: 403,
        message: "Lesson is not published for student submissions",
      });
    }
    const task = lessonToTaskPayload(lesson, 0);
    const lessonDueDate = parseDateOrNull(task?.due_date);
    const assignmentDueDate = parseDateOrNull(assignment?.due_date);
    const effectiveDueDate = lessonDueDate || assignmentDueDate;
    if (!effectiveDueDate || Date.now() > effectiveDueDate.getTime()) {
      return sendControllerError(req, res, {
        statusCode: 403,
        code: "HOMEWORK_DEADLINE_PASSED",
        message: "Submission deadline has passed",
      });
    }

    const existingSubmission = await MonthlyAssignmentSubmission.findOne({
      assignment_id: assignmentId,
      task_id: taskId,
      student_id: req.user.userId,
    }).lean();

    const imageFiles = Array.isArray(req.files?.images) ? req.files.images : [];
    const audioFiles = Array.isArray(req.files?.audio) ? req.files.audio : [];
    const audioFile = audioFiles[0] || null;

    if ((imageFiles.length > 0 || audioFile) && !isObjectStorageConfigured()) {
      return sendControllerError(req, res, {
        statusCode: 503,
        code: "OBJECT_STORAGE_NOT_CONFIGURED",
        message: "Object storage is not configured",
      });
    }

    if (imageFiles.length > HOMEWORK_IMAGE_MAX_FILES) {
      return sendControllerError(req, res, {
        statusCode: 413,
        code: "PAYLOAD_TOO_LARGE",
        message: `Maximum ${HOMEWORK_IMAGE_MAX_FILES} files are allowed`,
      });
    }

    for (const file of imageFiles) {
      const mime = String(file?.mimetype || "").toLowerCase();
      const isImage = mime.startsWith("image/");
      const isVideo = mime.startsWith("video/");
      if (!isImage && !isVideo) {
        return sendControllerError(req, res, {
          statusCode: 415,
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Only image/video files are allowed in images[]",
        });
      }
      const maxBytes = isImage ? HOMEWORK_IMAGE_MAX_BYTES : HOMEWORK_SUBMISSION_MAX_BYTES;
      if (Number(file?.size || 0) > maxBytes) {
        return sendControllerError(req, res, {
          statusCode: 413,
          code: "PAYLOAD_TOO_LARGE",
          message: `${isImage ? "Image" : "Video"} exceeds ${maxBytes} bytes`,
        });
      }
    }

    if (audioFile) {
      if (!String(audioFile?.mimetype || "").toLowerCase().startsWith("audio/")) {
        return sendControllerError(req, res, {
          statusCode: 415,
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Only audio file is allowed in audio",
        });
      }
      if (Number(audioFile?.size || 0) > HOMEWORK_AUDIO_MAX_BYTES) {
        return sendControllerError(req, res, {
          statusCode: 413,
          code: "PAYLOAD_TOO_LARGE",
          message: `Audio exceeds ${HOMEWORK_AUDIO_MAX_BYTES} bytes`,
        });
      }
    }

    const hasTextAnswerField = Object.prototype.hasOwnProperty.call(req.body || {}, "text_answer");
    const incomingTextAnswer = normalizeOptionalString(req.body?.text_answer) || "";
    const hasObjectiveAnswersField = Object.prototype.hasOwnProperty.call(req.body || {}, "objective_answers");
    const incomingObjectiveAnswers = normalizeObjectiveAnswersPayload(req.body?.objective_answers);

    let nextTextAnswer = hasTextAnswerField
      ? incomingTextAnswer
      : normalizeOptionalString(existingSubmission?.text_answer) || "";
    let nextImageItems = Array.isArray(existingSubmission?.image_items) ? existingSubmission.image_items : [];
    let nextAudioItem = existingSubmission?.audio_item || null;
    const existingMeta = toPlainObject(existingSubmission?.meta);
    const existingObjectiveAnswers = hasObjectiveAnswersPayload(existingMeta.objective_answers)
      ? normalizeObjectiveAnswersPayload(existingMeta.objective_answers)
      : normalizeObjectiveAnswersPayload({ quiz_answers: existingMeta.quiz_answers });
    const nextObjectiveAnswers = hasObjectiveAnswersField ? incomingObjectiveAnswers : existingObjectiveAnswers;
    const hasObjectiveAnswers = hasObjectiveAnswersPayload(nextObjectiveAnswers);
    const nextMeta = {
      ...existingMeta,
    };
    if (hasObjectiveAnswers) {
      nextMeta.objective_answers = nextObjectiveAnswers;
      nextMeta.quiz_answers = nextObjectiveAnswers.quiz;
    } else {
      delete nextMeta.objective_answers;
      delete nextMeta.quiz_answers;
    }

    const uploadedKeys = [];
    const keysToDeleteAfterSuccess = [];

    try {
      if (imageFiles.length > 0) {
        const uploadedImageItems = [];
        for (const imageFile of imageFiles) {
          const key = buildHomeworkSubmissionImageObjectKey({
            assignmentId,
            taskId,
            studentId: req.user.userId,
            originalFileName: imageFile.originalname,
          });
          const uploaded = await uploadHomeworkSubmissionImageObject({
            key,
            buffer: imageFile.buffer,
            contentType: imageFile.mimetype || "image/jpeg",
            size: imageFile.size,
          });
          uploadedKeys.push(uploaded.key);
          uploadedImageItems.push({
            url: uploaded.url,
            storage_key: uploaded.key,
            mime: imageFile.mimetype || "image/jpeg",
            size: imageFile.size,
          });
        }

        keysToDeleteAfterSuccess.push(...collectSubmissionStorageKeys({ image_items: nextImageItems }));
        nextImageItems = uploadedImageItems;
      }

      if (audioFile) {
        const key = buildHomeworkSubmissionAudioObjectKey({
          assignmentId,
          taskId,
          studentId: req.user.userId,
          originalFileName: audioFile.originalname,
        });
        const uploaded = await uploadHomeworkSubmissionAudioObject({
          key,
          buffer: audioFile.buffer,
          contentType: audioFile.mimetype || "audio/mpeg",
          size: audioFile.size,
        });
        uploadedKeys.push(uploaded.key);

        if (nextAudioItem?.storage_key) {
          keysToDeleteAfterSuccess.push(nextAudioItem.storage_key);
        }

        nextAudioItem = {
          url: uploaded.url,
          storage_key: uploaded.key,
          mime: audioFile.mimetype || "audio/mpeg",
          size: audioFile.size,
        };
      }

      if (task.requires_text && !normalizeOptionalString(nextTextAnswer)) {
        return sendControllerError(req, res, {
          statusCode: 400,
          message: "text_answer is required for this task",
        });
      }
      if (task.requires_image && (!Array.isArray(nextImageItems) || nextImageItems.length === 0)) {
        return sendControllerError(req, res, {
          statusCode: 400,
          message: "At least one uploaded file is required for this task",
        });
      }
      if (task.requires_audio && !nextAudioItem) {
        return sendControllerError(req, res, {
          statusCode: 400,
          message: "audio is required for this task",
        });
      }

      const hasAnyPayload = Boolean(
        normalizeOptionalString(nextTextAnswer) ||
        (Array.isArray(nextImageItems) && nextImageItems.length > 0) ||
        nextAudioItem ||
        hasObjectiveAnswers,
      );
      if (!hasAnyPayload) {
        return sendControllerError(req, res, {
          statusCode: 400,
          message: "Submission payload is empty",
        });
      }

      const submission = await MonthlyAssignmentSubmission.findOneAndUpdate(
        {
          assignment_id: assignmentId,
          task_id: taskId,
          student_id: req.user.userId,
        },
        {
          $set: {
            text_answer: nextTextAnswer,
            image_items: nextImageItems,
            audio_item: nextAudioItem,
            status: "submitted",
            score: null,
            teacher_feedback: "",
            graded_by: null,
            graded_at: null,
            submitted_at: new Date(),
            meta: nextMeta,
          },
          $setOnInsert: {
            assignment_id: assignmentId,
            task_id: taskId,
            student_id: req.user.userId,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
        },
      ).lean();

      await deleteHomeworkKeysBestEffort(req, keysToDeleteAfterSuccess);

      return res.status(200).json({
        success: true,
        data: mapSubmissionToResponse(submission),
      });
    } catch (uploadOrSaveError) {
      await deleteHomeworkKeysBestEffort(req, uploadedKeys);
      throw uploadOrSaveError;
    }
  } catch (error) {
    if (error?.statusCode) {
      return sendControllerError(req, res, {
        statusCode: error.statusCode,
        code: error.code,
        message: error.message,
      });
    }
    return handleControllerError(req, res, error);
  }
};

export const getHomeworkAssignmentDashboard = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) {
      return sendControllerError(req, res, { statusCode: 400, message: "Invalid assignment id" });
    }

    const assignment = await MonthlyAssignment.findById(assignmentId)
      .populate("target_group_ids", "name level_label")
      .lean();
    if (!assignment) {
      return sendControllerError(req, res, { statusCode: 404, message: "Assignment not found" });
    }

    const targetStudents = await getAssignmentTargetStudents(assignment);
    const targetScopedStudents = filterStudentsByGradeScope({
      students: targetStudents,
      assignment,
      user: req.user,
    });
    const targetScopedStudentIdSet = new Set(
      targetScopedStudents.map((student) => String(student?._id || "")).filter(Boolean),
    );

    const allAssignmentSubmissions = await MonthlyAssignmentSubmission.find({
      assignment_id: assignment._id,
    }).lean();

    const submissionStudentIdSet = new Set(
      allAssignmentSubmissions.map((submission) => String(submission?.student_id || "")).filter(Boolean),
    );
    const additionalStudentObjectIds = Array.from(submissionStudentIdSet)
      .filter((studentId) => !targetScopedStudentIdSet.has(studentId))
      .filter((studentId) => mongoose.Types.ObjectId.isValid(studentId))
      .map((studentId) => new mongoose.Types.ObjectId(studentId));

    const additionalStudents = additionalStudentObjectIds.length
      ? await User.find({
        _id: { $in: additionalStudentObjectIds },
        role: { $in: STUDENT_ROLE_VALUES },
      })
        .select("_id name email homeroom_teacher_id")
        .lean()
      : [];
    const scopedAdditionalStudents = filterStudentsByGradeScope({
      students: additionalStudents,
      assignment,
      user: req.user,
    });

    const scopedStudents = [...targetScopedStudents];
    const visibleStudentIdSet = new Set(targetScopedStudentIdSet);
    scopedAdditionalStudents.forEach((student) => {
      const studentId = String(student?._id || "");
      if (!studentId || visibleStudentIdSet.has(studentId)) return;
      visibleStudentIdSet.add(studentId);
      scopedStudents.push(student);
    });

    const submissions = allAssignmentSubmissions.filter((submission) =>
      visibleStudentIdSet.has(String(submission?.student_id || "")),
    );

    const effectiveSections = getEffectivePublishedSections(assignment);
    const tasks = flattenSectionsToTasks(effectiveSections);
    const taskGroups = tasks.map((task) => {
      const taskId = String(task?._id || "");
      const title = String(task?.title || task?.type || "Task").trim() || "Task";
      const dueDate = task?.due_date || assignment?.due_date || null;
      const order = Number.isFinite(Number(task?.order)) ? Number(task.order) : 0;
      const isInternalTask = String(task?.resource_mode || "").trim().toLowerCase() === "internal";
      const internalSlotsRaw = isInternalTask ? collectInternalResourceSlotsForTask(task) : [];
      const internalSlots = internalSlotsRaw
        .map((slot, slotIndex) => {
          const resourceRefType = String(slot?.resource_ref_type || "").trim().toLowerCase();
          const resourceRefId = String(slot?.resource_ref_id || "").trim();
          const resourceBlockId = String(slot?.resource_block_id || "").trim();
          const slotKey =
            String(slot?.resource_slot_key || "").trim()
            || buildInternalSlotKey({
              blockId: resourceBlockId || `internal-${slotIndex + 1}`,
              resourceRefType,
              resourceRefId,
            });
          return {
            slot_key: slotKey,
            resource_block_id: resourceBlockId,
            resource_ref_type: resourceRefType,
            resource_ref_id: resourceRefId,
          };
        })
        .filter((slot) => slot.slot_key && slot.resource_ref_type && slot.resource_ref_id);

      return {
        task_id: taskId,
        title,
        order,
        due_date: dueDate,
        is_multi_internal: internalSlots.length > 1,
        internal_slots: internalSlots,
      };
    });

    const submissionMap = new Map();
    submissions.forEach((submission) => {
      submissionMap.set(`${String(submission.student_id || "")}:${String(submission.task_id || "")}`, submission);
    });

    const resolveTaskGroupState = ({ studentId, taskGroup }) => {
      const key = `${String(studentId || "")}:${String(taskGroup?.task_id || "")}`;
      const submission = submissionMap.get(key) || null;
      const submissionId = submission?._id ? String(submission._id) : null;
      const groupId = submissionId
        ? `submission:${submissionId}`
        : `virtual:${String(assignment?._id || "")}:${String(studentId || "")}:${String(taskGroup?.task_id || "")}`;
      const groupSubmittedAt = submission?.submitted_at || null;

      if (!taskGroup?.is_multi_internal) {
        const doneCount = submission && isSubmittedHomeworkStatus(submission?.status) ? 1 : 0;
        return {
          group_id: groupId,
          submission_id: submissionId,
          task_id: taskGroup?.task_id,
          task_title: taskGroup?.title || "Task",
          task_due_date: taskGroup?.due_date || null,
          status: doneCount <= 0 ? "not_started" : "completed",
          done_count: doneCount,
          total_count: 1,
          submitted_at: groupSubmittedAt,
          graded_at: submission?.graded_at || null,
          score: doneCount > 0 ? (submission?.score ?? null) : null,
          internal_items: [],
        };
      }

      const completionRows = parseInternalCompletionRowsFromMeta(submission?.meta);
      const internalItems = (Array.isArray(taskGroup?.internal_slots) ? taskGroup.internal_slots : []).map((slot) => {
        const slotKey = String(slot?.slot_key || "").trim();
        const matchedCompletion = completionRows.find((row) => {
          if (String(row?.resource_slot_key || "").trim() === slotKey) return true;
          if (
            String(row?.resource_block_id || "").trim()
            && String(slot?.resource_block_id || "").trim()
            && String(row.resource_block_id).trim() === String(slot.resource_block_id).trim()
          ) {
            return true;
          }
          return (
            String(row?.resource_ref_type || "").trim().toLowerCase() === String(slot?.resource_ref_type || "")
            && String(row?.resource_ref_id || "").trim() === String(slot?.resource_ref_id || "")
          );
        });
        const completedAt = matchedCompletion?.submitted_at || null;
        return {
          slot_key: slotKey,
          resource_block_id: String(slot?.resource_block_id || ""),
          resource_ref_type: String(slot?.resource_ref_type || ""),
          resource_ref_id: String(slot?.resource_ref_id || ""),
          status: completedAt ? "completed" : "not_started",
          completed_at: completedAt,
        };
      });

      const totalCount = internalItems.length;
      const doneCount = internalItems.filter((item) => item.status === "completed").length;
      const status = doneCount <= 0 ? "not_started" : doneCount >= totalCount ? "completed" : "in_progress";

      return {
        group_id: groupId,
        submission_id: submissionId,
        task_id: taskGroup?.task_id,
        task_title: taskGroup?.title || "Task",
        task_due_date: taskGroup?.due_date || null,
        status,
        done_count: doneCount,
        total_count: totalCount,
        submitted_at: groupSubmittedAt,
        graded_at: submission?.graded_at || null,
        score: submission?.score ?? null,
        internal_items: internalItems,
      };
    };

    const taskSummary = taskGroups.map((taskGroup) => {
      let submitted = 0;
      targetScopedStudents.forEach((student) => {
        const groupState = resolveTaskGroupState({
          studentId: String(student?._id || ""),
          taskGroup,
        });
        if (Number(groupState?.done_count || 0) > 0) submitted += 1;
      });
      return {
        task_id: taskGroup.task_id,
        task_slot_id: `task:${String(taskGroup.task_id || "")}`,
        title: taskGroup.title,
        order: taskGroup.order || 0,
        submitted,
        not_submitted: Math.max(0, targetScopedStudents.length - submitted),
      };
    });

    const students = scopedStudents.map((student) => ({
      _id: student._id,
      name: student.name,
      email: student.email,
      homeroom_teacher_id: student.homeroom_teacher_id || null,
      tasks: taskGroups.map((taskGroup) => {
        const groupState = resolveTaskGroupState({
          studentId: String(student?._id || ""),
          taskGroup,
        });
        return {
          task_id: groupState.task_id,
          task_slot_id: `task:${String(groupState.task_id || "")}`,
          task_title: groupState.task_title,
          task_due_date: groupState.task_due_date,
          submission_id: groupState.submission_id,
          homework_submission_id: groupState.submission_id,
          group_id: groupState.group_id,
          submitted: Number(groupState.done_count || 0) > 0,
          status: groupState.status,
          score: groupState.score,
          graded_at: groupState.graded_at,
          submitted_at: groupState.submitted_at,
          done_count: groupState.done_count,
          total_count: groupState.total_count,
          internal_items: groupState.internal_items,
        };
      }),
    }));

    const submittedTotal = taskSummary.reduce((sum, item) => sum + Number(item.submitted || 0), 0);
    const totalGroups = targetScopedStudents.length * taskGroups.length;
    const notSubmittedTotal = Math.max(0, totalGroups - submittedTotal);

    return res.status(200).json({
      success: true,
      data: {
        assignment: {
          ...mapAssignmentForResponse(assignment),
          sections: effectiveSections,
          tasks,
        },
        totals: {
          students_in_target: targetStudents.length,
          students_in_scope: targetScopedStudents.length,
          students_with_submissions: scopedStudents.length,
          tasks_total: taskGroups.length,
          submitted_total: submittedTotal,
          not_submitted_total: notSubmittedTotal,
        },
        tasks: taskSummary,
        students,
      },
    });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const getHomeworkTaskSubmissions = async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const taskId = req.params.taskId;
    if (!mongoose.Types.ObjectId.isValid(assignmentId) || !mongoose.Types.ObjectId.isValid(taskId)) {
      return sendControllerError(req, res, { statusCode: 400, message: "Invalid assignment/task id" });
    }

    const assignment = await MonthlyAssignment.findById(assignmentId).lean();
    if (!assignment) {
      return sendControllerError(req, res, { statusCode: 404, message: "Assignment not found" });
    }

    const effectiveTasks = flattenSectionsToTasks(getEffectivePublishedSections(assignment));
    const hasTask = effectiveTasks.some((task) => String(task._id || "") === String(taskId));
    if (!hasTask) {
      return sendControllerError(req, res, { statusCode: 404, message: "Task not found" });
    }

    const targetStudents = await getAssignmentTargetStudents(assignment);
    const targetScopedStudents = filterStudentsByGradeScope({
      students: targetStudents,
      assignment,
      user: req.user,
    });
    const targetScopedStudentIdSet = new Set(
      targetScopedStudents.map((student) => String(student?._id || "")).filter(Boolean),
    );

    const allTaskSubmissions = await MonthlyAssignmentSubmission.find({
      assignment_id: assignmentId,
      task_id: taskId,
    }).lean();

    const submissionStudentIdSet = new Set(
      allTaskSubmissions.map((submission) => String(submission?.student_id || "")).filter(Boolean),
    );
    const additionalStudentObjectIds = Array.from(submissionStudentIdSet)
      .filter((studentId) => !targetScopedStudentIdSet.has(studentId))
      .filter((studentId) => mongoose.Types.ObjectId.isValid(studentId))
      .map((studentId) => new mongoose.Types.ObjectId(studentId));

    const additionalStudents = additionalStudentObjectIds.length
      ? await User.find({
        _id: { $in: additionalStudentObjectIds },
        role: { $in: STUDENT_ROLE_VALUES },
      })
        .select("_id name email homeroom_teacher_id")
        .lean()
      : [];
    const scopedAdditionalStudents = filterStudentsByGradeScope({
      students: additionalStudents,
      assignment,
      user: req.user,
    });

    const scopedStudents = [...targetScopedStudents];
    const visibleStudentIdSet = new Set(targetScopedStudentIdSet);
    scopedAdditionalStudents.forEach((student) => {
      const studentId = String(student?._id || "");
      if (!studentId || visibleStudentIdSet.has(studentId)) return;
      visibleStudentIdSet.add(studentId);
      scopedStudents.push(student);
    });

    const submissions = allTaskSubmissions.filter((submission) =>
      visibleStudentIdSet.has(String(submission?.student_id || "")),
    );

    const studentMap = new Map(scopedStudents.map((student) => [String(student._id), student]));
    const submittedTargetStudentSet = new Set(
      submissions
        .map((submission) => String(submission.student_id || ""))
        .filter((studentId) => targetScopedStudentIdSet.has(studentId)),
    );
    const notSubmittedStudents = targetScopedStudents.filter(
      (student) => !submittedTargetStudentSet.has(String(student._id)),
    );

    const task = effectiveTasks.find((t) => String(t._id || "") === String(taskId));
    let testInfo = null;
    if (task && task.resource_mode === "internal" && task.resource_ref_type === "test" && task.resource_ref_id) {
      testInfo = await Test.findById(task.resource_ref_id).select("title type").lean();
    }

    const submissionResponses = submissions.map((submission) => {
      const subRes = {
        ...mapSubmissionToResponse(submission),
        student: studentMap.get(String(submission.student_id || "")) || null,
      };
      if (testInfo) {
        subRes.test_title = testInfo.title;
        if (subRes.internal_score !== null && ["reading", "listening"].includes(String(testInfo.type).toLowerCase())) {
          subRes.ielts_band = calculateIELTSBand(subRes.internal_score, testInfo.type);
        }
      }
      return subRes;
    });

    return res.status(200).json({
      success: true,
      data: {
        submissions: submissionResponses,
        not_submitted_students: notSubmittedStudents,
      },
    });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const getHomeworkSubmissionById = async (req, res) => {
  try {
    const submissionId = req.params.submissionId;
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return sendControllerError(req, res, { statusCode: 400, message: "Invalid submission id" });
    }

    const submission = await MonthlyAssignmentSubmission.findById(submissionId).lean();
    if (!submission) {
      return sendControllerError(req, res, { statusCode: 404, message: "Submission not found" });
    }

    const [assignment, student] = await Promise.all([
      MonthlyAssignment.findById(submission.assignment_id).lean(),
      User.findById(submission.student_id).select("_id name email role homeroom_teacher_id").lean(),
    ]);

    if (!assignment) {
      return sendControllerError(req, res, { statusCode: 404, message: "Assignment not found" });
    }
    if (!student) {
      return sendControllerError(req, res, { statusCode: 404, message: "Student not found" });
    }

    const gradePermission = canGradeStudentForAssignment({
      assignment,
      student,
      user: req.user,
    });

    if (!gradePermission.allowed) {
      return sendControllerError(req, res, {
        statusCode: 403,
        code: gradePermission.code,
        message: "You do not have permission to access this submission",
      });
    }

    const mappedAssignment = mapAssignmentForResponse(assignment);
    const assignmentTasks = Array.isArray(mappedAssignment?.tasks) ? mappedAssignment.tasks : [];
    const task = assignmentTasks.find(
      (item) => String(item?._id || "") === String(submission?.task_id || ""),
    ) || null;

    const subResponse = mapSubmissionToResponse(submission);
    let testTitle = null;
    let ieltsBand = null;
    let internalItems = [];

    if (task) {
      const baseInternalItems = buildInternalSubmissionItemsForTask({ task, submission });
      if (baseInternalItems.length > 0) {
        const testRefIds = Array.from(new Set(
          baseInternalItems
            .filter((item) => String(item?.resource_ref_type || "").trim().toLowerCase() === "test")
            .map((item) => String(item?.resource_ref_id || "").trim())
            .filter((id) => mongoose.Types.ObjectId.isValid(id)),
        ));
        const testMap = new Map();
        if (testRefIds.length > 0) {
          const tests = await Test.find({
            _id: { $in: testRefIds.map((id) => new mongoose.Types.ObjectId(id)) },
          })
            .select("_id title type")
            .lean();
          tests.forEach((test) => {
            testMap.set(String(test?._id || ""), test);
          });
        }

        internalItems = baseInternalItems.map((item) => {
          const normalizedRefType = String(item?.resource_ref_type || "").trim().toLowerCase();
          const normalizedRefId = String(item?.resource_ref_id || "").trim();
          const testInfo = normalizedRefType === "test" ? (testMap.get(normalizedRefId) || null) : null;
          const itemScore = toFiniteNumberOrNull(item?.score_snapshot);
          const normalizedTestType = String(testInfo?.type || "").trim().toLowerCase();
          const itemBand = itemScore !== null && ["reading", "listening"].includes(normalizedTestType)
            ? calculateIELTSBand(itemScore, normalizedTestType)
            : null;
          return {
            ...item,
            score_snapshot: itemScore,
            test_title: testInfo?.title || null,
            test_type: testInfo?.type || null,
            ielts_band: itemBand,
          };
        });
      }
    }

    if (task && task.resource_mode === "internal" && task.resource_ref_type === "test" && task.resource_ref_id) {
      const test = await Test.findById(task.resource_ref_id).select("title type").lean();
      if (test) {
        testTitle = test.title;
        if (subResponse.internal_score !== null && ["reading", "listening"].includes(String(test.type).toLowerCase())) {
          ieltsBand = calculateIELTSBand(subResponse.internal_score, test.type);
        }
      }
    }
    if (!testTitle) {
      testTitle = String(internalItems.find((item) => String(item?.test_title || "").trim())?.test_title || "").trim() || null;
    }
    if (!ieltsBand) {
      ieltsBand = internalItems.find((item) => item?.ielts_band !== null && item?.ielts_band !== undefined)?.ielts_band || null;
    }

    return res.status(200).json({
      success: true,
      data: {
        ...subResponse,
        assignment: mappedAssignment,
        task,
        student,
        internal_items: internalItems,
        test_title: testTitle,
        ielts_band: ieltsBand,
      },
    });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};

export const gradeHomeworkSubmission = async (req, res) => {
  try {
    const submissionId = req.params.submissionId;
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return sendControllerError(req, res, { statusCode: 400, message: "Invalid submission id" });
    }

    const submission = await MonthlyAssignmentSubmission.findById(submissionId);
    if (!submission) {
      return sendControllerError(req, res, { statusCode: 404, message: "Submission not found" });
    }

    const [assignment, student] = await Promise.all([
      MonthlyAssignment.findById(submission.assignment_id).lean(),
      User.findById(submission.student_id).select("_id name email role homeroom_teacher_id").lean(),
    ]);

    if (!assignment) {
      return sendControllerError(req, res, { statusCode: 404, message: "Assignment not found" });
    }
    if (!student) {
      return sendControllerError(req, res, { statusCode: 404, message: "Student not found" });
    }

    const gradePermission = canGradeStudentForAssignment({
      assignment,
      student,
      user: req.user,
    });
    if (!gradePermission.allowed) {
      return sendControllerError(req, res, {
        statusCode: 403,
        code: gradePermission.code,
        message: "You do not have permission to grade this student",
      });
    }

    const score = parseScoreOrNull(req.body?.score);
    if (score === null || score < 0 || score > 10) {
      return sendControllerError(req, res, {
        statusCode: 400,
        message: "score must be a number between 0 and 10",
      });
    }

    submission.score = score;
    submission.teacher_feedback = normalizeOptionalString(req.body?.teacher_feedback) || "";
    submission.status = "graded";
    submission.graded_by = req.user.userId;
    submission.graded_at = new Date();
    await submission.save();

    return res.status(200).json({
      success: true,
      data: mapSubmissionToResponse(submission.toObject()),
    });
  } catch (error) {
    return handleControllerError(req, res, error);
  }
};
