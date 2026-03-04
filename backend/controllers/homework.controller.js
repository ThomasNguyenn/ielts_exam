import mongoose from "mongoose";
import HomeworkGroup from "../models/HomeworkGroup.model.js";
import MonthlyAssignment from "../models/MonthlyAssignment.model.js";
import MonthlyAssignmentSubmission from "../models/MonthlyAssignmentSubmission.model.js";
import Passage from "../models/Passage.model.js";
import Section from "../models/Section.model.js";
import Speaking from "../models/Speaking.model.js";
import User from "../models/User.model.js";
import Writing from "../models/Writing.model.js";
import { ASSIGNMENT_STATUSES, TASK_RESOURCE_MODES } from "../models/MonthlyAssignment.model.js";
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
import { parsePagination, buildPaginationMeta } from "../utils/pagination.js";
import { handleControllerError, sendControllerError } from "../utils/controllerError.js";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const TASK_RESOURCE_MODES_SET = new Set(TASK_RESOURCE_MODES);
const TASK_RESOURCE_REF_TYPES_SET = new Set(["passage", "section", "speaking", "writing"]);

const HOMEWORK_IMAGE_MAX_BYTES = getHomeworkImageUploadLimitBytes();
const HOMEWORK_IMAGE_MAX_FILES = getHomeworkImageMaxFiles();
const HOMEWORK_AUDIO_MAX_BYTES = getHomeworkAudioUploadLimitBytes();

const normalizeOptionalString = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
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

const parseOptionalDateOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  return parseDateOrNull(value);
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
          message: "resource_ref_type must be one of passage|section|speaking|writing for internal mode",
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
    role: "student",
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
};

const assertInternalRefsOrRespond = async (req, res, tasks = []) => {
  const grouped = {
    passage: new Set(),
    section: new Set(),
    speaking: new Set(),
    writing: new Set(),
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

const collectAssignmentTaskStorageKeys = (assignment = {}) => {
  const keys = [];
  const tasks = getAssignmentTasks(assignment);
  tasks.forEach((task) => {
    const key = normalizeOptionalString(task?.resource_storage_key);
    if (key) keys.push(key);
  });
  return keys;
};

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

const isAssignmentVisibleToStudent = (assignment = {}, studentGroupIds = []) => {
  if (!assignment || String(assignment.status || "").toLowerCase() !== "published") return false;
  const targetGroupIds = Array.isArray(assignment.target_group_ids) ? assignment.target_group_ids : [];
  const studentGroupSet = new Set((studentGroupIds || []).map((id) => String(id)));
  return targetGroupIds.some((groupId) => studentGroupSet.has(String(groupId)));
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

const mapAssignmentForResponse = (assignment = {}, { forStudent = false } = {}) => {
  const plain = toPlainAssignmentObject(assignment);
  const sections = forStudent ? getEffectivePublishedSections(plain) : getAssignmentSections(plain);
  const tasks = flattenSectionsToTasks(sections);
  return {
    ...plain,
    sections,
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
    role: "student",
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
});

const parseScoreOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 10) / 10;
};

const mapAssignmentForStudent = (assignment = {}, submissions = []) => {
  const mappedAssignment = mapAssignmentForResponse(assignment, { forStudent: true });
  const tasks = Array.isArray(mappedAssignment.tasks) ? mappedAssignment.tasks : [];
  const visibleTaskIdSet = new Set(tasks.map((task) => String(task?._id || "")));
  const submissionTaskSet = new Set(
    submissions
      .map((submission) => String(submission.task_id || ""))
      .filter((taskId) => visibleTaskIdSet.has(taskId)),
  );
  const gradedCount = submissions.filter(
    (submission) =>
      submission.status === "graded" && visibleTaskIdSet.has(String(submission?.task_id || "")),
  ).length;
  const submittedCount = submissionTaskSet.size;

  return {
    ...mappedAssignment,
    progress: {
      submitted_tasks: submittedCount,
      total_tasks: tasks.length,
      graded_tasks: gradedCount,
      pending_tasks: Math.max(0, tasks.length - submittedCount),
    },
  };
};

const resolveAssignmentResourceKeysToDeleteOnUpdate = (existingAssignment, nextTasks = []) => {
  const currentTasks = getAssignmentTasks(existingAssignment);
  const currentById = new Map();
  currentTasks.forEach((task) => {
    currentById.set(String(task._id), normalizeOptionalString(task.resource_storage_key));
  });

  const keepKeys = new Set();
  nextTasks.forEach((task) => {
    const key = normalizeOptionalString(task.resource_storage_key);
    if (key) keepKeys.add(key);
  });

  const removedKeys = [];
  currentById.forEach((storageKey) => {
    if (!storageKey) return;
    if (!keepKeys.has(storageKey)) removedKeys.push(storageKey);
  });
  return removedKeys;
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
      filter.created_by = req.user.userId;
    } else if (owner && mongoose.Types.ObjectId.isValid(owner)) {
      filter.created_by = owner;
    }

    const [totalItems, assignments] = await Promise.all([
      MonthlyAssignment.countDocuments(filter),
      MonthlyAssignment.find(filter)
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
        ...mapAssignmentForResponse(item),
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
    const month = ensureMonthValue(req.query.month, { optional: true });
    if (req.query.month && !month) {
      return sendControllerError(req, res, {
        statusCode: 400,
        message: "month must be in YYYY-MM format",
      });
    }

    const groupIds = await getStudentGroupIds(req.user.userId);
    if (!groupIds.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    const filter = {
      status: "published",
      target_group_ids: { $in: groupIds },
    };
    if (month) filter.month = month;

    const assignments = await MonthlyAssignment.find(filter)
      .sort({ month: -1, week: 1, due_date: 1, updatedAt: -1 })
      .populate("target_group_ids", "name level_label")
      .lean();

    if (!assignments.length) {
      return res.status(200).json({ success: true, data: [] });
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

    return res.status(200).json({ success: true, data: enriched });
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

    const dueDate = parseDateOrNull(assignment.due_date);
    if (!dueDate || Date.now() > dueDate.getTime()) {
      return sendControllerError(req, res, {
        statusCode: 403,
        code: "HOMEWORK_DEADLINE_PASSED",
        message: "Submission deadline has passed",
      });
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
        message: `Maximum ${HOMEWORK_IMAGE_MAX_FILES} images are allowed`,
      });
    }

    for (const file of imageFiles) {
      if (!String(file?.mimetype || "").toLowerCase().startsWith("image/")) {
        return sendControllerError(req, res, {
          statusCode: 415,
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Only image files are allowed in images[]",
        });
      }
      if (Number(file?.size || 0) > HOMEWORK_IMAGE_MAX_BYTES) {
        return sendControllerError(req, res, {
          statusCode: 413,
          code: "PAYLOAD_TOO_LARGE",
          message: `Image exceeds ${HOMEWORK_IMAGE_MAX_BYTES} bytes`,
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

    let nextTextAnswer = hasTextAnswerField
      ? incomingTextAnswer
      : normalizeOptionalString(existingSubmission?.text_answer) || "";
    let nextImageItems = Array.isArray(existingSubmission?.image_items) ? existingSubmission.image_items : [];
    let nextAudioItem = existingSubmission?.audio_item || null;

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
          message: "At least one image is required for this task",
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
        nextAudioItem,
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
    const scopedStudents = filterStudentsByGradeScope({
      students: targetStudents,
      assignment,
      user: req.user,
    });
    const scopedStudentIds = scopedStudents.map((student) => student._id);

    const submissions = scopedStudentIds.length
      ? await MonthlyAssignmentSubmission.find({
        assignment_id: assignment._id,
        student_id: { $in: scopedStudentIds },
      }).lean()
      : [];

    const effectiveSections = getEffectivePublishedSections(assignment);
    const tasks = flattenSectionsToTasks(effectiveSections);
    const taskSummary = tasks.map((task) => {
      const taskIdKey = String(task._id || "");
      const submittedStudentSet = new Set(
        submissions
          .filter((submission) => String(submission.task_id || "") === taskIdKey)
          .map((submission) => String(submission.student_id || "")),
      );
      const submitted = submittedStudentSet.size;
      const notSubmitted = Math.max(0, scopedStudents.length - submitted);
      return {
        task_id: task._id,
        title: task.title || task.type || "Task",
        order: task.order || 0,
        submitted,
        not_submitted: notSubmitted,
      };
    });

    const submissionMap = new Map();
    submissions.forEach((submission) => {
      submissionMap.set(`${submission.student_id}:${submission.task_id}`, submission);
    });

    const students = scopedStudents.map((student) => ({
      _id: student._id,
      name: student.name,
      email: student.email,
      homeroom_teacher_id: student.homeroom_teacher_id || null,
      tasks: tasks.map((task) => {
        const key = `${student._id}:${task._id}`;
        const submission = submissionMap.get(key);
        return {
          task_id: task._id,
          submitted: Boolean(submission),
          status: submission?.status || "not_submitted",
          score: submission?.score ?? null,
          graded_at: submission?.graded_at || null,
          submitted_at: submission?.submitted_at || null,
        };
      }),
    }));

    const submittedTotal = taskSummary.reduce((sum, item) => sum + Number(item.submitted || 0), 0);
    const totalSlots = scopedStudents.length * tasks.length;
    const notSubmittedTotal = Math.max(0, totalSlots - submittedTotal);

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
          students_in_scope: scopedStudents.length,
          tasks_total: tasks.length,
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
    const scopedStudents = filterStudentsByGradeScope({
      students: targetStudents,
      assignment,
      user: req.user,
    });
    const scopedStudentIds = scopedStudents.map((student) => student._id);
    const studentMap = new Map(scopedStudents.map((student) => [String(student._id), student]));

    const submissions = scopedStudentIds.length
      ? await MonthlyAssignmentSubmission.find({
        assignment_id: assignmentId,
        task_id: taskId,
        student_id: { $in: scopedStudentIds },
      }).lean()
      : [];

    const submittedStudentSet = new Set(submissions.map((submission) => String(submission.student_id || "")));
    const notSubmittedStudents = scopedStudents.filter(
      (student) => !submittedStudentSet.has(String(student._id)),
    );

    return res.status(200).json({
      success: true,
      data: {
        submissions: submissions.map((submission) => ({
          ...mapSubmissionToResponse(submission),
          student: studentMap.get(String(submission.student_id || "")) || null,
        })),
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

    return res.status(200).json({
      success: true,
      data: {
        ...mapSubmissionToResponse(submission),
        assignment: mapAssignmentForResponse(assignment),
        student,
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
