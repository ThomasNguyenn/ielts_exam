import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { JWT_SECRET } from "../config/security.config.js";
import HomeworkGroup from "../models/HomeworkGroup.model.js";
import MonthlyAssignment from "../models/MonthlyAssignment.model.js";
import MonthlyAssignmentSubmission from "../models/MonthlyAssignmentSubmission.model.js";

const HWCTX_SECRET = String(process.env.HOMEWORK_TRACKING_SECRET || JWT_SECRET).trim();
const HWCTX_EXPIRES_IN = Number.parseInt(process.env.HOMEWORK_TRACKING_TOKEN_TTL_SEC || "", 10) || 15 * 60;
const RESOURCE_TYPES = ["test", "passage", "section", "speaking", "writing"];

const normalizeString = (value = "") => String(value ?? "").trim();
const toObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) return null;
  return new mongoose.Types.ObjectId(value);
};
const toDateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const createEventId = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeResourceType = (value) => {
  const normalized = normalizeString(value).toLowerCase();
  return RESOURCE_TYPES.includes(normalized) ? normalized : "";
};

const buildCandidateResourceTypes = (resourceRefType) => {
  const normalized = normalizeResourceType(resourceRefType);
  if (!normalized) return RESOURCE_TYPES;
  if (normalized === "test") {
    return ["test", "passage", "section", "writing", "speaking"];
  }
  return [normalized];
};

const normalizeTaskForMapping = (task = {}, assignment = {}) => ({
  _id: task?._id,
  resource_mode: normalizeString(task?.resource_mode || "internal").toLowerCase() || "internal",
  resource_ref_type: normalizeResourceType(task?.resource_ref_type),
  resource_ref_id: normalizeString(task?.resource_ref_id),
  due_date: toDateOrNull(task?.due_date) || toDateOrNull(assignment?.due_date),
});

const collectPublishedTasks = (assignment = {}) => {
  const sections = Array.isArray(assignment?.sections) ? assignment.sections : [];
  if (sections.length > 0) {
    const tasks = [];
    sections.forEach((section) => {
      if (!section?.is_published) return;
      (Array.isArray(section?.lessons) ? section.lessons : []).forEach((lesson) => {
        if (!lesson?.is_published) return;
        tasks.push(normalizeTaskForMapping(lesson, assignment));
      });
    });
    return tasks;
  }

  return (Array.isArray(assignment?.tasks) ? assignment.tasks : []).map((task) =>
    normalizeTaskForMapping(task, assignment),
  );
};

const getStudentGroupIds = async (studentId) => {
  const studentObjectId = toObjectId(studentId);
  if (!studentObjectId) return [];
  const groups = await HomeworkGroup.find({
    is_active: true,
    student_ids: studentObjectId,
  })
    .select("_id")
    .lean();
  return groups.map((group) => group._id);
};

const isAssignmentVisibleToStudent = (assignment = {}, studentGroupIds = []) => {
  if (normalizeString(assignment?.status).toLowerCase() !== "published") return false;
  const groupIdSet = new Set((studentGroupIds || []).map((id) => normalizeString(id)).filter(Boolean));
  const targets = Array.isArray(assignment?.target_group_ids) ? assignment.target_group_ids : [];
  return targets.some((targetId) => groupIdSet.has(normalizeString(targetId)));
};

const computeEffectiveDueTs = (candidate = {}) => {
  const due = toDateOrNull(candidate?.due_date);
  return due ? due.getTime() : Number.POSITIVE_INFINITY;
};

const generateSubmissionMeta = ({ mapping, resourceRefType, resourceRefId, testAttemptId, scoreSnapshot }) => ({
  resource_ref_type: normalizeResourceType(resourceRefType || mapping?.resource_ref_type || "test"),
  resource_ref_id: normalizeString(resourceRefId || mapping?.resource_ref_id || ""),
  linked_test_attempt_id: normalizeString(testAttemptId || ""),
  score_snapshot: scoreSnapshot ?? null,
  synced_at: new Date().toISOString(),
});

const mergeResourceMeta = (existingMeta = {}, nextMeta = {}) => ({
  ...(existingMeta && typeof existingMeta === "object" ? existingMeta : {}),
  ...(nextMeta && typeof nextMeta === "object" ? nextMeta : {}),
});

export const issueHomeworkContextToken = ({
  studentId,
  assignmentId,
  taskId,
  resourceRefType,
  resourceRefId,
  nonce = "",
}) => {
  const payload = {
    v: 1,
    student_id: normalizeString(studentId),
    assignment_id: normalizeString(assignmentId),
    task_id: normalizeString(taskId),
    resource_ref_type: normalizeResourceType(resourceRefType),
    resource_ref_id: normalizeString(resourceRefId),
    nonce: normalizeString(nonce) || createEventId(),
  };
  return jwt.sign(payload, HWCTX_SECRET, {
    expiresIn: HWCTX_EXPIRES_IN,
  });
};

export const verifyHwctxOrNull = (hwctx) => {
  const token = normalizeString(hwctx);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, HWCTX_SECRET);
    return decoded && typeof decoded === "object" ? decoded : null;
  } catch {
    return null;
  }
};

export async function resolveHomeworkTaskMapping({
  studentId,
  resourceRefType,
  resourceRefId,
  hwctx = null,
}) {
  const normalizedStudentId = normalizeString(studentId);
  const normalizedResourceRefId = normalizeString(resourceRefId);
  if (!normalizedStudentId || !normalizedResourceRefId) return null;
  if (!toObjectId(normalizedStudentId)) return null;

  const decodedCtx = verifyHwctxOrNull(hwctx);
  if (decodedCtx && normalizeString(decodedCtx.student_id) === normalizedStudentId) {
    const assignmentObjectId = toObjectId(decodedCtx.assignment_id);
    const taskObjectId = toObjectId(decodedCtx.task_id);
    if (assignmentObjectId && taskObjectId) {
      const studentGroupIds = await getStudentGroupIds(normalizedStudentId);
      const assignment = await MonthlyAssignment.findById(assignmentObjectId)
        .select("status due_date target_group_ids sections tasks")
        .lean();

      if (assignment && isAssignmentVisibleToStudent(assignment, studentGroupIds)) {
        const mappedTask = collectPublishedTasks(assignment).find(
          (task) => normalizeString(task?._id) === normalizeString(taskObjectId),
        );
        if (mappedTask) {
          return {
            source: "hwctx",
            student_id: normalizedStudentId,
            assignment_id: normalizeString(assignmentObjectId),
            task_id: normalizeString(taskObjectId),
            resource_ref_type: normalizeResourceType(mappedTask.resource_ref_type || decodedCtx.resource_ref_type),
            resource_ref_id: normalizeString(mappedTask.resource_ref_id || decodedCtx.resource_ref_id),
            due_date: mappedTask.due_date || toDateOrNull(assignment?.due_date),
          };
        }
      }
    }
  }

  const studentGroupIds = await getStudentGroupIds(normalizedStudentId);
  if (!studentGroupIds.length) return null;

  const resourceTypesToTry = buildCandidateResourceTypes(resourceRefType);
  const assignments = await MonthlyAssignment.find({
    status: "published",
    target_group_ids: { $in: studentGroupIds },
  })
    .select("status due_date target_group_ids sections tasks")
    .lean();

  if (!assignments.length) return null;

  const candidates = [];
  assignments.forEach((assignment) => {
    collectPublishedTasks(assignment).forEach((task) => {
      if (normalizeString(task.resource_mode) !== "internal") return;
      if (!resourceTypesToTry.includes(normalizeResourceType(task.resource_ref_type))) return;
      if (normalizeString(task.resource_ref_id) !== normalizedResourceRefId) return;
      candidates.push({
        student_id: normalizedStudentId,
        assignment_id: normalizeString(assignment?._id),
        task_id: normalizeString(task?._id),
        resource_ref_type: normalizeResourceType(task.resource_ref_type),
        resource_ref_id: normalizeString(task.resource_ref_id),
        due_date: task.due_date || toDateOrNull(assignment?.due_date),
      });
    });
  });

  if (!candidates.length) return null;

  const assignmentObjectIds = Array.from(
    new Set(candidates.map((item) => normalizeString(item.assignment_id)).filter(Boolean)),
  )
    .map((id) => toObjectId(id))
    .filter(Boolean);

  const existingSubmissions = assignmentObjectIds.length
    ? await MonthlyAssignmentSubmission.find({
      student_id: toObjectId(normalizedStudentId),
      assignment_id: { $in: assignmentObjectIds },
    })
      .select("assignment_id task_id")
      .lean()
    : [];

  const submittedKeySet = new Set(
    existingSubmissions.map(
      (submission) => `${normalizeString(submission.assignment_id)}:${normalizeString(submission.task_id)}`,
    ),
  );

  const unresolvedCandidates = candidates.filter(
    (candidate) =>
      !submittedKeySet.has(`${normalizeString(candidate.assignment_id)}:${normalizeString(candidate.task_id)}`),
  );
  const preferred = unresolvedCandidates.length > 0 ? unresolvedCandidates : candidates;
  preferred.sort((a, b) => computeEffectiveDueTs(a) - computeEffectiveDueTs(b));

  return {
    ...preferred[0],
    source: unresolvedCandidates.length > 0 ? "nearest_due" : "existing_submission",
  };
}

const resolveBridgeContext = async ({
  studentId,
  resourceRefType,
  resourceRefId,
  hwctx,
}) => {
  const mapping = await resolveHomeworkTaskMapping({
    studentId,
    resourceRefType,
    resourceRefId,
    hwctx,
  });
  if (!mapping) return null;
  return { mapping, now: new Date() };
};

export const trackHomeworkActivityOpen = async ({
  studentId,
  resourceRefType = "test",
  resourceRefId,
  hwctx = null,
}) => {
  const context = await resolveBridgeContext({ studentId, resourceRefType, resourceRefId, hwctx });
  if (!context) return { tracked: false, reason: "mapping_not_found" };
  return {
    tracked: true,
    mapping: context.mapping,
    status: "opened",
  };
};

export const trackHomeworkActivityStart = async ({
  studentId,
  resourceRefType = "test",
  resourceRefId,
  hwctx = null,
}) => {
  const context = await resolveBridgeContext({ studentId, resourceRefType, resourceRefId, hwctx });
  if (!context) return { tracked: false, reason: "mapping_not_found" };
  return {
    tracked: true,
    mapping: context.mapping,
    status: "started",
  };
};

export const trackHomeworkActivityHeartbeat = async ({
  studentId,
  resourceRefType = "test",
  resourceRefId,
  hwctx = null,
}) => {
  const context = await resolveBridgeContext({ studentId, resourceRefType, resourceRefId, hwctx });
  if (!context) return { tracked: false, reason: "mapping_not_found" };
  return {
    tracked: true,
    mapping: context.mapping,
    status: "in_progress",
  };
};

export const trackHomeworkActivityAnswer = async ({
  studentId,
  resourceRefType = "test",
  resourceRefId,
  hwctx = null,
  updates = [],
}) => {
  const context = await resolveBridgeContext({ studentId, resourceRefType, resourceRefId, hwctx });
  if (!context) return { tracked: false, reason: "mapping_not_found" };
  return {
    tracked: true,
    mapping: context.mapping,
    saved_count: Array.isArray(updates) ? updates.length : 0,
    status: "in_progress",
  };
};

export const markHomeworkSubmittedFromTestAttempt = async ({
  studentId,
  resourceRefType = "test",
  resourceRefId,
  hwctx = null,
  testAttemptId = null,
  scoreSnapshot = null,
}) => {
  const context = await resolveBridgeContext({ studentId, resourceRefType, resourceRefId, hwctx });
  if (!context) return { tracked: false, reason: "mapping_not_found" };

  const { mapping, now } = context;
  const assignmentObjectId = toObjectId(mapping.assignment_id);
  const taskObjectId = toObjectId(mapping.task_id);
  const studentObjectId = toObjectId(mapping.student_id);
  if (!assignmentObjectId || !taskObjectId || !studentObjectId) {
    return { tracked: false, reason: "mapping_invalid" };
  }

  const existingSubmission = await MonthlyAssignmentSubmission.findOne({
    assignment_id: assignmentObjectId,
    task_id: taskObjectId,
    student_id: studentObjectId,
  }).lean();

  const nextMeta = generateSubmissionMeta({
    mapping,
    resourceRefType,
    resourceRefId,
    testAttemptId,
    scoreSnapshot,
  });

  await MonthlyAssignmentSubmission.findOneAndUpdate(
    {
      assignment_id: assignmentObjectId,
      task_id: taskObjectId,
      student_id: studentObjectId,
    },
    {
      $set: {
        status: "submitted",
        score: null,
        teacher_feedback: "",
        graded_by: null,
        graded_at: null,
        submitted_at: now,
        submission_source: "linked_test_attempt",
        linked_test_attempt_id: toObjectId(testAttemptId) || null,
        meta: mergeResourceMeta(existingSubmission?.meta, nextMeta),
      },
      $setOnInsert: {
        assignment_id: assignmentObjectId,
        task_id: taskObjectId,
        student_id: studentObjectId,
        text_answer: "",
        image_items: [],
        audio_item: null,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );

  return {
    tracked: true,
    mapping,
    status: "submitted",
  };
};

export const markStaleHomeworkAttemptsAbandoned = async () => ({ processed: 0, disabled: true });
