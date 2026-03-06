import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { JWT_SECRET } from "../config/security.config.js";
import HomeworkGroup from "../models/HomeworkGroup.model.js";
import HomeworkAttempt from "../models/HomeworkAttempt.model.js";
import HomeworkAttemptAnswer from "../models/HomeworkAttemptAnswer.model.js";
import HomeworkAttemptEvent from "../models/HomeworkAttemptEvent.model.js";
import HomeworkStudentAssignment from "../models/HomeworkStudentAssignment.model.js";
import MonthlyAssignment from "../models/MonthlyAssignment.model.js";
import MonthlyAssignmentSubmission from "../models/MonthlyAssignmentSubmission.model.js";

const HWCTX_SECRET = String(process.env.HOMEWORK_TRACKING_SECRET || JWT_SECRET).trim();
const HWCTX_EXPIRES_IN = Number.parseInt(process.env.HOMEWORK_TRACKING_TOKEN_TTL_SEC || "", 10) || 15 * 60;
const HEARTBEAT_LEASE_SEC = Number.parseInt(process.env.HOMEWORK_TRACKING_HEARTBEAT_LEASE_SEC || "", 10) || 45;
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

const transitionStudentAssignment = (studentAssignment, targetStatus, now) => {
  if (!studentAssignment || !targetStatus) return;
  const current = normalizeString(studentAssignment.status).toLowerCase();
  if (current === "submitted" && targetStatus !== "submitted") return;

  if (targetStatus === "opened") {
    if (!studentAssignment.opened_at) studentAssignment.opened_at = now;
    studentAssignment.last_activity_at = now;
    if (current === "assigned" || current === "abandoned") {
      studentAssignment.status = "opened";
      studentAssignment.abandoned_at = null;
    }
    return;
  }

  if (targetStatus === "started") {
    if (!studentAssignment.opened_at) studentAssignment.opened_at = now;
    if (!studentAssignment.started_at) studentAssignment.started_at = now;
    studentAssignment.last_activity_at = now;
    if (["assigned", "opened", "abandoned"].includes(current)) {
      studentAssignment.status = "started";
      studentAssignment.abandoned_at = null;
    }
    return;
  }

  if (targetStatus === "in_progress") {
    if (!studentAssignment.opened_at) studentAssignment.opened_at = now;
    if (!studentAssignment.started_at) studentAssignment.started_at = now;
    if (!studentAssignment.first_interaction_at) studentAssignment.first_interaction_at = now;
    studentAssignment.last_activity_at = now;
    studentAssignment.abandoned_at = null;
    studentAssignment.status = "in_progress";
    return;
  }

  if (targetStatus === "submitted") {
    if (!studentAssignment.opened_at) studentAssignment.opened_at = now;
    if (!studentAssignment.started_at) studentAssignment.started_at = now;
    if (!studentAssignment.first_interaction_at) studentAssignment.first_interaction_at = now;
    studentAssignment.last_activity_at = now;
    studentAssignment.submitted_at = now;
    studentAssignment.abandoned_at = null;
    studentAssignment.status = "submitted";
    return;
  }

  if (targetStatus === "abandoned") {
    if (current !== "submitted") {
      studentAssignment.abandoned_at = now;
      studentAssignment.status = "abandoned";
    }
  }
};

const ensureStudentAssignment = async (mapping, now) => {
  const assignmentId = toObjectId(mapping?.assignment_id);
  const taskId = toObjectId(mapping?.task_id);
  const studentId = toObjectId(mapping?.student_id);
  if (!assignmentId || !taskId || !studentId) return null;

  return HomeworkStudentAssignment.findOneAndUpdate(
    {
      assignment_id: assignmentId,
      task_id: taskId,
      student_id: studentId,
    },
    {
      $setOnInsert: {
        assignment_id: assignmentId,
        task_id: taskId,
        student_id: studentId,
        status: "assigned",
        assigned_at: now,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    },
  );
};

const ensureAttempt = async ({
  studentAssignment,
  mapping,
  now,
  tabSessionId = "",
  originSurface = "tests_direct",
  targetStatus = "started",
}) => {
  if (!studentAssignment) return null;

  const currentAttemptId = toObjectId(studentAssignment.current_attempt_id);
  let attempt = null;
  if (currentAttemptId) {
    attempt = await HomeworkAttempt.findOne({
      _id: currentAttemptId,
      student_assignment_id: studentAssignment._id,
      status: { $ne: "submitted" },
    });
  }

  if (!attempt) {
    attempt = await HomeworkAttempt.findOne({
      student_assignment_id: studentAssignment._id,
      status: { $ne: "submitted" },
    }).sort({ createdAt: -1 });
  }

  if (!attempt) {
    const latestAttempt = await HomeworkAttempt.findOne({
      student_assignment_id: studentAssignment._id,
    }).sort({ attempt_no: -1 });
    const nextAttemptNo = Math.max(1, Number(latestAttempt?.attempt_no || 0) + 1);

    attempt = await HomeworkAttempt.create({
      student_assignment_id: studentAssignment._id,
      assignment_id: toObjectId(mapping?.assignment_id),
      task_id: toObjectId(mapping?.task_id),
      student_id: toObjectId(mapping?.student_id),
      attempt_no: nextAttemptNo,
      status: targetStatus === "in_progress" ? "in_progress" : "started",
      started_at: now,
      first_interaction_at: targetStatus === "in_progress" ? now : null,
      last_activity_at: now,
      active_tab_session_id: normalizeString(tabSessionId) || null,
      lease_expires_at: new Date(now.getTime() + HEARTBEAT_LEASE_SEC * 1000),
      origin_surface: originSurface,
      resource_ref_type: normalizeResourceType(mapping?.resource_ref_type) || "test",
      resource_ref_id: normalizeString(mapping?.resource_ref_id),
    });
  } else {
    const normalizedTabSessionId = normalizeString(tabSessionId);
    const currentTabSessionId = normalizeString(attempt.active_tab_session_id);
    if (normalizedTabSessionId && currentTabSessionId && normalizedTabSessionId !== currentTabSessionId) {
      attempt.resume_count = Number(attempt.resume_count || 0) + 1;
    }
    if (normalizedTabSessionId) {
      attempt.active_tab_session_id = normalizedTabSessionId;
    }

    if (!attempt.started_at) attempt.started_at = now;
    if (targetStatus === "in_progress") {
      if (!attempt.first_interaction_at) attempt.first_interaction_at = now;
      if (normalizeString(attempt.status).toLowerCase() !== "submitted") {
        attempt.status = "in_progress";
      }
    } else if (normalizeString(attempt.status).toLowerCase() === "abandoned") {
      attempt.status = "started";
      attempt.abandoned_at = null;
    }

    attempt.last_activity_at = now;
    attempt.lease_expires_at = new Date(now.getTime() + HEARTBEAT_LEASE_SEC * 1000);
    await attempt.save();
  }

  if (normalizeString(studentAssignment.current_attempt_id) !== normalizeString(attempt._id)) {
    studentAssignment.current_attempt_id = attempt._id;
  }
  return attempt;
};

const persistEvent = async ({
  studentAssignmentId,
  attemptId = null,
  eventType,
  eventId,
  tabSessionId = "",
  clientTs = null,
  payload = {},
}) => {
  const normalizedEventType = normalizeString(eventType) || "heartbeat";
  const normalizedEventId = normalizeString(eventId) || createEventId();
  const normalizedClientTs = toDateOrNull(clientTs);
  try {
    await HomeworkAttemptEvent.create({
      student_assignment_id: studentAssignmentId,
      attempt_id: toObjectId(attemptId) || null,
      event_id: normalizedEventId,
      event_type: normalizedEventType,
      tab_session_id: normalizeString(tabSessionId) || null,
      client_ts: normalizedClientTs,
      server_ts: new Date(),
      payload: payload && typeof payload === "object" ? payload : {},
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
};

const saveAnswerBatch = async ({ attemptId, studentAssignmentId, updates = [], saveSeq = 0, now }) => {
  if (!attemptId || !Array.isArray(updates) || updates.length === 0) return 0;

  const normalizedRows = updates
    .map((entry, index) => {
      const questionKey = normalizeString(entry?.question_key || entry?.questionKey || "");
      if (!questionKey) return null;
      const answerValue = entry?.answer_value ?? entry?.answerValue ?? "";
      const normalizedAnswer = normalizeString(answerValue).toLowerCase();
      return {
        question_key: questionKey,
        answer_value: answerValue,
        normalized_answer: normalizedAnswer || null,
        save_seq: Number.isFinite(Number(entry?.save_seq))
          ? Number(entry.save_seq)
          : Number.isFinite(Number(saveSeq))
            ? Number(saveSeq)
            : index,
      };
    })
    .filter(Boolean);

  if (!normalizedRows.length) return 0;

  await Promise.all(
    normalizedRows.map((row) =>
      HomeworkAttemptAnswer.findOneAndUpdate(
        {
          attempt_id: attemptId,
          question_key: row.question_key,
        },
        {
          $set: {
            student_assignment_id: studentAssignmentId,
            answer_value: row.answer_value,
            normalized_answer: row.normalized_answer,
            save_seq: row.save_seq,
            answered_at: now,
            updated_at: now,
          },
          $setOnInsert: {
            attempt_id: attemptId,
            question_key: row.question_key,
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      ),
    ),
  );

  return normalizedRows.length;
};

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

  if (!unresolvedCandidates.length) return null;
  unresolvedCandidates.sort((a, b) => computeEffectiveDueTs(a) - computeEffectiveDueTs(b));

  return {
    ...unresolvedCandidates[0],
    source: "nearest_due",
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

  const now = new Date();
  const studentAssignment = await ensureStudentAssignment(mapping, now);
  if (!studentAssignment) return null;

  return { mapping, studentAssignment, now };
};

export const trackHomeworkActivityOpen = async ({
  studentId,
  resourceRefType = "test",
  resourceRefId,
  hwctx = null,
  eventId = "",
  tabSessionId = "",
  clientTs = null,
  payload = {},
}) => {
  const context = await resolveBridgeContext({ studentId, resourceRefType, resourceRefId, hwctx });
  if (!context) return { tracked: false, reason: "mapping_not_found" };

  const { mapping, studentAssignment, now } = context;
  transitionStudentAssignment(studentAssignment, "opened", now);
  studentAssignment.open_count = Number(studentAssignment.open_count || 0) + 1;
  await studentAssignment.save();

  await persistEvent({
    studentAssignmentId: studentAssignment._id,
    eventType: "opened",
    eventId,
    tabSessionId,
    clientTs,
    payload,
  });

  return {
    tracked: true,
    mapping,
    student_assignment_id: studentAssignment._id,
    status: studentAssignment.status,
  };
};

export const trackHomeworkActivityStart = async ({
  studentId,
  resourceRefType = "test",
  resourceRefId,
  hwctx = null,
  eventId = "",
  tabSessionId = "",
  clientTs = null,
  payload = {},
}) => {
  const context = await resolveBridgeContext({ studentId, resourceRefType, resourceRefId, hwctx });
  if (!context) return { tracked: false, reason: "mapping_not_found" };

  const { mapping, studentAssignment, now } = context;
  transitionStudentAssignment(studentAssignment, "started", now);
  const attempt = await ensureAttempt({
    studentAssignment,
    mapping,
    now,
    tabSessionId,
    originSurface: normalizeString(mapping.source) === "hwctx" ? "homework_launch" : "tests_direct",
    targetStatus: "started",
  });
  await studentAssignment.save();

  await persistEvent({
    studentAssignmentId: studentAssignment._id,
    attemptId: attempt?._id,
    eventType: "started",
    eventId,
    tabSessionId,
    clientTs,
    payload,
  });

  return {
    tracked: true,
    mapping,
    student_assignment_id: studentAssignment._id,
    attempt_id: attempt?._id || null,
    status: studentAssignment.status,
  };
};

export const trackHomeworkActivityHeartbeat = async ({
  studentId,
  resourceRefType = "test",
  resourceRefId,
  hwctx = null,
  interacted = false,
  visibility = "",
  visibilityEvent = "",
  focused = null,
  refresh = false,
  eventId = "",
  tabSessionId = "",
  clientTs = null,
  payload = {},
}) => {
  const context = await resolveBridgeContext({ studentId, resourceRefType, resourceRefId, hwctx });
  if (!context) return { tracked: false, reason: "mapping_not_found" };

  const { mapping, studentAssignment, now } = context;
  transitionStudentAssignment(studentAssignment, interacted ? "in_progress" : "opened", now);
  if (refresh) {
    studentAssignment.refresh_count = Number(studentAssignment.refresh_count || 0) + 1;
  }
  if (visibilityEvent === "hidden" || visibilityEvent === "visible") {
    studentAssignment.tab_switch_count = Number(studentAssignment.tab_switch_count || 0) + 1;
  }

  let attempt = null;
  const hasAttempt = Boolean(studentAssignment.current_attempt_id);
  if (interacted || hasAttempt) {
    attempt = await ensureAttempt({
      studentAssignment,
      mapping,
      now,
      tabSessionId,
      originSurface: normalizeString(mapping.source) === "hwctx" ? "homework_launch" : "tests_direct",
      targetStatus: interacted ? "in_progress" : "started",
    });
    if (attempt) {
      attempt.heartbeat_count = Number(attempt.heartbeat_count || 0) + 1;
      attempt.last_activity_at = now;
      attempt.lease_expires_at = new Date(now.getTime() + HEARTBEAT_LEASE_SEC * 1000);
      await attempt.save();
    }
  }

  await studentAssignment.save();

  const resolvedEventType =
    visibilityEvent === "hidden"
      ? "tab_hidden"
      : visibilityEvent === "visible"
        ? "tab_visible"
        : "heartbeat";

  await persistEvent({
    studentAssignmentId: studentAssignment._id,
    attemptId: attempt?._id || null,
    eventType: resolvedEventType,
    eventId,
    tabSessionId,
    clientTs,
    payload: {
      ...(payload && typeof payload === "object" ? payload : {}),
      interacted: Boolean(interacted),
      visibility: normalizeString(visibility) || null,
      focused: typeof focused === "boolean" ? focused : null,
      refresh: Boolean(refresh),
    },
  });

  return {
    tracked: true,
    mapping,
    student_assignment_id: studentAssignment._id,
    attempt_id: attempt?._id || null,
    status: studentAssignment.status,
  };
};

export const trackHomeworkActivityAnswer = async ({
  studentId,
  resourceRefType = "test",
  resourceRefId,
  hwctx = null,
  updates = [],
  saveSeq = 0,
  eventId = "",
  tabSessionId = "",
  clientTs = null,
  payload = {},
}) => {
  const context = await resolveBridgeContext({ studentId, resourceRefType, resourceRefId, hwctx });
  if (!context) return { tracked: false, reason: "mapping_not_found" };

  const { mapping, studentAssignment, now } = context;
  transitionStudentAssignment(studentAssignment, "in_progress", now);
  const attempt = await ensureAttempt({
    studentAssignment,
    mapping,
    now,
    tabSessionId,
    originSurface: normalizeString(mapping.source) === "hwctx" ? "homework_launch" : "tests_direct",
    targetStatus: "in_progress",
  });
  const savedCount = await saveAnswerBatch({
    attemptId: attempt?._id,
    studentAssignmentId: studentAssignment._id,
    updates,
    saveSeq,
    now,
  });
  await studentAssignment.save();

  await persistEvent({
    studentAssignmentId: studentAssignment._id,
    attemptId: attempt?._id || null,
    eventType: "answer_saved",
    eventId,
    tabSessionId,
    clientTs,
    payload: {
      ...(payload && typeof payload === "object" ? payload : {}),
      save_count: savedCount,
    },
  });

  return {
    tracked: true,
    mapping,
    student_assignment_id: studentAssignment._id,
    attempt_id: attempt?._id || null,
    saved_count: savedCount,
    status: studentAssignment.status,
  };
};

export const markHomeworkSubmittedFromTestAttempt = async ({
  studentId,
  resourceRefType = "test",
  resourceRefId,
  hwctx = null,
  testAttemptId = null,
  scoreSnapshot = null,
  eventId = "",
  tabSessionId = "",
  clientTs = null,
}) => {
  const context = await resolveBridgeContext({ studentId, resourceRefType, resourceRefId, hwctx });
  if (!context) return { tracked: false, reason: "mapping_not_found" };

  const { mapping, studentAssignment, now } = context;
  transitionStudentAssignment(studentAssignment, "in_progress", now);
  const attempt = await ensureAttempt({
    studentAssignment,
    mapping,
    now,
    tabSessionId,
    originSurface: normalizeString(mapping.source) === "hwctx" ? "homework_launch" : "tests_direct",
    targetStatus: "in_progress",
  });

  if (attempt) {
    attempt.status = "submitted";
    attempt.submitted_at = now;
    attempt.last_activity_at = now;
    attempt.lease_expires_at = null;
    if (toObjectId(testAttemptId)) {
      attempt.linked_test_attempt_id = toObjectId(testAttemptId);
    }
    await attempt.save();
    studentAssignment.current_attempt_id = attempt._id;
  }

  transitionStudentAssignment(studentAssignment, "submitted", now);
  await studentAssignment.save();

  const existingSubmission = await MonthlyAssignmentSubmission.findOne({
    assignment_id: toObjectId(mapping.assignment_id),
    task_id: toObjectId(mapping.task_id),
    student_id: toObjectId(mapping.student_id),
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
      assignment_id: toObjectId(mapping.assignment_id),
      task_id: toObjectId(mapping.task_id),
      student_id: toObjectId(mapping.student_id),
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
        assignment_id: toObjectId(mapping.assignment_id),
        task_id: toObjectId(mapping.task_id),
        student_id: toObjectId(mapping.student_id),
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

  await persistEvent({
    studentAssignmentId: studentAssignment._id,
    attemptId: attempt?._id || null,
    eventType: "submitted",
    eventId,
    tabSessionId,
    clientTs,
    payload: {
      linked_test_attempt_id: normalizeString(testAttemptId || ""),
      score_snapshot: scoreSnapshot ?? null,
    },
  });

  return {
    tracked: true,
    mapping,
    student_assignment_id: studentAssignment._id,
    attempt_id: attempt?._id || null,
    status: studentAssignment.status,
  };
};

export const markStaleHomeworkAttemptsAbandoned = async ({ staleMinutes = 10 } = {}) => {
  const threshold = new Date(Date.now() - Math.max(1, Number(staleMinutes) || 10) * 60 * 1000);
  const staleAttempts = await HomeworkAttempt.find({
    status: { $in: ["started", "in_progress"] },
    last_activity_at: { $lt: threshold },
  })
    .select("_id student_assignment_id")
    .lean();

  if (!staleAttempts.length) return { processed: 0 };

  const now = new Date();
  let processed = 0;
  for (const staleAttempt of staleAttempts) {
    const attemptId = toObjectId(staleAttempt?._id);
    const studentAssignmentId = toObjectId(staleAttempt?.student_assignment_id);
    if (!attemptId || !studentAssignmentId) continue;

    await HomeworkAttempt.updateOne(
      { _id: attemptId, status: { $in: ["started", "in_progress"] } },
      {
        $set: {
          status: "abandoned",
          abandoned_at: now,
          lease_expires_at: null,
        },
      },
    );

    const studentAssignment = await HomeworkStudentAssignment.findById(studentAssignmentId);
    if (!studentAssignment) continue;
    transitionStudentAssignment(studentAssignment, "abandoned", now);
    await studentAssignment.save();

    await persistEvent({
      studentAssignmentId: studentAssignment._id,
      attemptId,
      eventType: "abandoned_auto",
      eventId: createEventId(),
      payload: { stale_threshold_iso: threshold.toISOString() },
    });
    processed += 1;
  }

  return { processed };
};
