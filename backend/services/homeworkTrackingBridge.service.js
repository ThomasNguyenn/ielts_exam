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

const isSubmittedStatus = (status) => {
  const normalized = normalizeString(status).toLowerCase();
  return normalized === "submitted" || normalized === "graded";
};

const buildResourceSlotKey = ({ resourceBlockId = "", resourceRefType = "", resourceRefId = "" } = {}) => {
  const normalizedBlockId = normalizeString(resourceBlockId);
  if (normalizedBlockId) return `block:${normalizedBlockId}`;
  const normalizedType = normalizeResourceType(resourceRefType);
  const normalizedId = normalizeString(resourceRefId);
  if (!normalizedType || !normalizedId) return "";
  return `ref:${normalizedType}:${normalizedId}`;
};

const collectInternalResourceSlotsFromTask = (task = {}) => {
  const slots = [];
  const blockRefKeys = new Set();

  const pushSlot = ({
    resourceRefType,
    resourceRefId,
    resourceBlockId = "",
    resourceSlotKey = "",
    slotIndex = 0,
  } = {}) => {
    const normalizedType = normalizeResourceType(resourceRefType);
    const normalizedRefId = normalizeString(resourceRefId);
    if (!normalizedType || !normalizedRefId) return;
    const normalizedBlockId = normalizeString(resourceBlockId);
    // Internal blocks are independent completion units. Always keep one slot per block.
    const blockIdForKey = normalizedBlockId || `internal-${slotIndex + 1}`;
    const configuredSlotKey = normalizeString(resourceSlotKey);
    const slotKey = configuredSlotKey || buildResourceSlotKey({
      resourceBlockId: blockIdForKey,
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
    if (normalizeString(block?.type).toLowerCase() !== "internal") return;
    const blockData = block?.data && typeof block.data === "object" ? block.data : {};
    const refType = normalizeResourceType(blockData?.resource_ref_type);
    const refId = normalizeString(blockData?.resource_ref_id);
    if (!refType || !refId) return;
    blockRefKeys.add(`${refType}:${refId}`);
    pushSlot({
      resourceRefType: refType,
      resourceRefId: refId,
      resourceBlockId: normalizeString(blockData?.block_id),
      resourceSlotKey: normalizeString(blockData?.resource_slot_key),
      slotIndex: blockIndex,
    });
  });

  if (normalizeString(task?.resource_mode).toLowerCase() === "internal") {
    const rootType = normalizeResourceType(task?.resource_ref_type);
    const rootRefId = normalizeString(task?.resource_ref_id);
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

const parseInternalContentCompletionsFromMeta = (meta = {}) => {
  const normalizedMeta = meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {};
  const rows = Array.isArray(normalizedMeta.internal_content_completions)
    ? normalizedMeta.internal_content_completions
    : [];

  const normalizedRows = rows
    .map((entry) => {
      const normalizedType = normalizeResourceType(entry?.resource_ref_type);
      const normalizedRefId = normalizeString(entry?.resource_ref_id);
      const normalizedBlockId = normalizeString(entry?.resource_block_id);
      const normalizedSlotKey = normalizeString(entry?.resource_slot_key)
        || buildResourceSlotKey({
          resourceBlockId: normalizedBlockId,
          resourceRefType: normalizedType,
          resourceRefId: normalizedRefId,
        });
      if (!normalizedSlotKey && (!normalizedType || !normalizedRefId)) return null;
      return {
        resource_slot_key: normalizedSlotKey,
        resource_block_id: normalizedBlockId,
        resource_ref_type: normalizedType,
        resource_ref_id: normalizedRefId,
        submitted_at: entry?.submitted_at || null,
        linked_test_attempt_id: normalizeString(entry?.linked_test_attempt_id),
        score_snapshot: entry?.score_snapshot ?? null,
      };
    })
    .filter(Boolean);

  // Merge repeated slot rows into a single canonical slot item.
  const rowMap = new Map();
  normalizedRows.forEach((entry) => {
    const key = normalizeString(entry?.resource_slot_key)
      || buildResourceSlotKey({
        resourceBlockId: normalizeString(entry?.resource_block_id),
        resourceRefType: normalizeResourceType(entry?.resource_ref_type),
        resourceRefId: normalizeString(entry?.resource_ref_id),
      });
    if (!key) return;
    const current = rowMap.get(key);
    if (!current) {
      rowMap.set(key, {
        ...entry,
        resource_slot_key: key,
      });
      return;
    }
    const currentTs = toDateOrNull(current?.submitted_at)?.getTime() || 0;
    const nextTs = toDateOrNull(entry?.submitted_at)?.getTime() || 0;
    if (nextTs >= currentTs) {
      rowMap.set(key, {
        ...current,
        ...entry,
        resource_slot_key: key,
      });
    }
  });

  return Array.from(rowMap.values());
};

const resolveCompletionSlotKeysForSubmission = ({ submission = {}, slots = [] } = {}) => {
  const completed = new Set();
  if (!submission || !Array.isArray(slots) || slots.length === 0) return completed;

  const entries = parseInternalContentCompletionsFromMeta(submission?.meta);
  entries.forEach((entry) => {
    const matchedSlot = slots.find((slot) => {
      if (entry.resource_slot_key && slot.resource_slot_key === entry.resource_slot_key) return true;
      if (entry.resource_block_id && slot.resource_block_id && slot.resource_block_id === entry.resource_block_id) {
        return true;
      }
      return (
        entry.resource_ref_type
        && entry.resource_ref_id
        && slot.resource_ref_type === entry.resource_ref_type
        && slot.resource_ref_id === entry.resource_ref_id
      );
    });
    if (matchedSlot?.resource_slot_key) {
      completed.add(matchedSlot.resource_slot_key);
    }
  });

  const legacyType = normalizeResourceType(submission?.meta?.resource_ref_type);
  const legacyRefId = normalizeString(submission?.meta?.resource_ref_id);
  if (legacyType && legacyRefId) {
    const matchedSlot = slots.find(
      (slot) => slot.resource_ref_type === legacyType && slot.resource_ref_id === legacyRefId,
    );
    if (matchedSlot?.resource_slot_key) {
      completed.add(matchedSlot.resource_slot_key);
    }
  }

  if (completed.size === 0 && isSubmittedStatus(submission?.status)) {
    if (slots.length === 1) {
      completed.add(slots[0].resource_slot_key);
    } else if (slots.length > 1) {
      // Legacy fallback: old records only tracked one completion per task.
      completed.add(slots[0].resource_slot_key);
    }
  }

  return completed;
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
  content_blocks: Array.isArray(task?.content_blocks) ? task.content_blocks : [],
  internal_slots: collectInternalResourceSlotsFromTask(task),
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
  resource_block_id: normalizeString(mapping?.resource_block_id || ""),
  resource_slot_key: normalizeString(mapping?.resource_slot_key || ""),
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
  resourceBlockId = "",
  resourceSlotKey = "",
  nonce = "",
}) => {
  const payload = {
    v: 1,
    student_id: normalizeString(studentId),
    assignment_id: normalizeString(assignmentId),
    task_id: normalizeString(taskId),
    resource_ref_type: normalizeResourceType(resourceRefType),
    resource_ref_id: normalizeString(resourceRefId),
    resource_block_id: normalizeString(resourceBlockId),
    resource_slot_key: normalizeString(resourceSlotKey),
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
  if (!normalizedStudentId || (!normalizedResourceRefId && !normalizeString(hwctx))) return null;
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
          const requestedSlotKey = normalizeString(decodedCtx.resource_slot_key);
          const requestedBlockId = normalizeString(decodedCtx.resource_block_id);
          const requestedType = normalizeResourceType(
            decodedCtx.resource_ref_type || resourceRefType || mappedTask.resource_ref_type,
          );
          const requestedRefId = normalizeString(
            decodedCtx.resource_ref_id || resourceRefId || mappedTask.resource_ref_id,
          );
          const taskSlots = Array.isArray(mappedTask.internal_slots) ? mappedTask.internal_slots : [];
          const requiresExplicitSlot = taskSlots.length > 1;
          let matchedSlot = null;
          if (requestedSlotKey) {
            matchedSlot = taskSlots.find((slot) => normalizeString(slot?.resource_slot_key) === requestedSlotKey);
          }
          if (!matchedSlot && requestedBlockId) {
            matchedSlot = taskSlots.find((slot) => normalizeString(slot?.resource_block_id) === requestedBlockId);
          }
          if (!matchedSlot && requestedType && requestedRefId) {
            const refMatchedSlots = taskSlots.filter(
              (slot) =>
                slot?.resource_ref_type === requestedType
                && normalizeString(slot?.resource_ref_id) === requestedRefId,
            );
            if (refMatchedSlots.length === 1) {
              matchedSlot = refMatchedSlots[0];
            } else if (refMatchedSlots.length > 1) {
              return null;
            }
          }
          if (!matchedSlot && !requiresExplicitSlot && taskSlots.length > 0) {
            matchedSlot = taskSlots[0];
          }
          if (requiresExplicitSlot && !matchedSlot) {
            return null;
          }
          return {
            source: "hwctx",
            student_id: normalizedStudentId,
            assignment_id: normalizeString(assignmentObjectId),
            task_id: normalizeString(taskObjectId),
            resource_ref_type: normalizeResourceType(
              matchedSlot?.resource_ref_type || mappedTask.resource_ref_type || decodedCtx.resource_ref_type,
            ),
            resource_ref_id: normalizeString(
              matchedSlot?.resource_ref_id || mappedTask.resource_ref_id || decodedCtx.resource_ref_id,
            ),
            resource_block_id: normalizeString(matchedSlot?.resource_block_id || requestedBlockId),
            resource_slot_key: normalizeString(matchedSlot?.resource_slot_key || requestedSlotKey),
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
      const slots = Array.isArray(task.internal_slots) ? task.internal_slots : [];
      slots.forEach((slot) => {
        if (!resourceTypesToTry.includes(normalizeResourceType(slot?.resource_ref_type))) return;
        if (normalizeString(slot?.resource_ref_id) !== normalizedResourceRefId) return;
        candidates.push({
          student_id: normalizedStudentId,
          assignment_id: normalizeString(assignment?._id),
          task_id: normalizeString(task?._id),
          resource_ref_type: normalizeResourceType(slot?.resource_ref_type),
          resource_ref_id: normalizeString(slot?.resource_ref_id),
          resource_block_id: normalizeString(slot?.resource_block_id),
          resource_slot_key: normalizeString(slot?.resource_slot_key),
          due_date: task.due_date || toDateOrNull(assignment?.due_date),
        });
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
      .select("assignment_id task_id status meta")
      .lean()
    : [];

  const candidatesByTaskKey = new Map();
  candidates.forEach((candidate) => {
    const taskKey = `${normalizeString(candidate.assignment_id)}:${normalizeString(candidate.task_id)}`;
    const current = candidatesByTaskKey.get(taskKey) || [];
    candidatesByTaskKey.set(taskKey, [...current, candidate]);
  });

  const unambiguousCandidates = [];
  candidatesByTaskKey.forEach((taskCandidates) => {
    const slotIdentitySet = new Set(
      taskCandidates
        .map((candidate) =>
          normalizeString(candidate.resource_slot_key)
          || normalizeString(candidate.resource_block_id)
          || "",
        )
        .filter(Boolean),
    );
    if (slotIdentitySet.size > 1) return;
    unambiguousCandidates.push(...taskCandidates);
  });
  if (!unambiguousCandidates.length) return null;

  const effectiveCandidatesByTaskKey = new Map();
  unambiguousCandidates.forEach((candidate) => {
    const taskKey = `${normalizeString(candidate.assignment_id)}:${normalizeString(candidate.task_id)}`;
    const current = effectiveCandidatesByTaskKey.get(taskKey) || [];
    effectiveCandidatesByTaskKey.set(taskKey, [...current, candidate]);
  });

  const completedSlotKeySet = new Set();
  existingSubmissions.forEach((submission) => {
    const taskKey = `${normalizeString(submission.assignment_id)}:${normalizeString(submission.task_id)}`;
    const taskCandidates = effectiveCandidatesByTaskKey.get(taskKey) || [];
    if (taskCandidates.length === 0) return;
    const slots = taskCandidates.map((candidate) => ({
      resource_slot_key: normalizeString(candidate.resource_slot_key),
      resource_block_id: normalizeString(candidate.resource_block_id),
      resource_ref_type: normalizeResourceType(candidate.resource_ref_type),
      resource_ref_id: normalizeString(candidate.resource_ref_id),
    }));
    const completedSlots = resolveCompletionSlotKeysForSubmission({ submission, slots });
    completedSlots.forEach((slotKey) => {
      completedSlotKeySet.add(`${taskKey}:${slotKey}`);
    });
  });

  const unresolvedCandidates = unambiguousCandidates.filter((candidate) => {
    const taskKey = `${normalizeString(candidate.assignment_id)}:${normalizeString(candidate.task_id)}`;
    const slotKey = normalizeString(candidate.resource_slot_key);
    return !completedSlotKeySet.has(`${taskKey}:${slotKey}`);
  });
  const preferred = unresolvedCandidates.length > 0 ? unresolvedCandidates : unambiguousCandidates;
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

  const completionSubmittedAt = now.toISOString();
  const normalizedCompletionSlotKey =
    normalizeString(nextMeta.resource_slot_key)
    || buildResourceSlotKey({
      resourceBlockId: normalizeString(nextMeta.resource_block_id),
      resourceRefType: normalizeResourceType(nextMeta.resource_ref_type),
      resourceRefId: normalizeString(nextMeta.resource_ref_id),
    });
  const normalizedCompletionBlockId = normalizeString(nextMeta.resource_block_id);
  const normalizedCompletionType = normalizeResourceType(nextMeta.resource_ref_type);
  const normalizedCompletionRefId = normalizeString(nextMeta.resource_ref_id);
  const normalizedLinkedTestAttemptId = normalizeString(testAttemptId || "");
  const mergedMeta = mergeResourceMeta(existingSubmission?.meta, nextMeta);
  const currentCompletionRows = parseInternalContentCompletionsFromMeta(existingSubmission?.meta);
  const completionMap = new Map();
  currentCompletionRows.forEach((entry) => {
    const entryKey = normalizeString(entry?.resource_slot_key)
      || buildResourceSlotKey({
        resourceBlockId: normalizeString(entry?.resource_block_id),
        resourceRefType: normalizeResourceType(entry?.resource_ref_type),
        resourceRefId: normalizeString(entry?.resource_ref_id),
      });
    if (!entryKey) return;
    completionMap.set(entryKey, entry);
  });
  if (normalizedCompletionSlotKey) {
    completionMap.set(normalizedCompletionSlotKey, {
      resource_slot_key: normalizedCompletionSlotKey,
      resource_block_id: normalizedCompletionBlockId,
      resource_ref_type: normalizedCompletionType,
      resource_ref_id: normalizedCompletionRefId,
      submitted_at: completionSubmittedAt,
      linked_test_attempt_id: normalizedLinkedTestAttemptId,
      score_snapshot: scoreSnapshot ?? null,
    });
  }
  mergedMeta.internal_content_completions = Array.from(completionMap.values());
  mergedMeta.internal_content_completed_total = mergedMeta.internal_content_completions.length;

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
        meta: mergedMeta,
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
