import { api } from '@/shared/api/client';
import { sanitizeActiveUIRoleForUser } from '@/app/activeUIRole';
import { USER_ROLE_ADMIN, USER_ROLE_SUPERVISOR } from '@/app/roleRouting';
import {
  getHomeworkTodayDayKey,
  resolveHomeworkDayEndTimestamp,
  resolveHomeworkDueCutoffTimestamp,
  resolveHomeworkDueDayKey,
} from '@/shared/utils/homeworkDueDate';

const MAX_FETCH_PAGES = 50;
const USER_FETCH_LIMIT = 100;
const ASSIGNMENT_FETCH_LIMIT = 50;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const STUDENT_ROLE_KEYS = ['student', 'studentIELTS', 'studentACA'];

export const TODAY = getHomeworkTodayDayKey() || new Date().toISOString().slice(0, 10);

const resolveViewerScopeContext = (user = api.getUser()) => {
  const currentUser = user || {};
  const currentUserId = String(currentUser?._id || '').trim();
  const activeUIRole = sanitizeActiveUIRoleForUser(currentUser, '');
  const viewerRole = String(activeUIRole || '').trim();
  return {
    currentUserId,
    viewerRole,
  };
};

const resolveEffectiveStudentScope = ({ viewerRole = '', requestedScope = 'homeroom' } = {}) => {
  if (viewerRole === USER_ROLE_SUPERVISOR) return 'all';
  const normalizedScope = String(requestedScope || '').trim().toLowerCase();
  if (viewerRole === USER_ROLE_ADMIN && normalizedScope === 'all') return 'all';
  return 'homeroom';
};

const filterStudentsByScope = ({ students = [], currentUserId = '', scope = 'homeroom' } = {}) => {
  if (scope === 'all') return students;
  if (!currentUserId) return [];
  return students.filter((student) => String(student?.homeroom_teacher_id || '').trim() === currentUserId);
};

const toIsoDay = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const toLocalIsoDay = (value) => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shiftMonthValue = (monthValue, offset = 0) => {
  const normalized = String(monthValue || '').trim();
  if (!/^\d{4}-\d{2}$/.test(normalized)) return '';
  const [yearRaw, monthRaw] = normalized.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) return '';
  const date = new Date(Date.UTC(year, monthIndex + Number(offset || 0), 1));
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const expandMonthKeys = (months = []) => {
  const expanded = new Set();
  months.forEach((month) => {
    const normalized = String(month || '').trim();
    if (!normalized) return;
    expanded.add(normalized);
    const previous = shiftMonthValue(normalized, -1);
    const next = shiftMonthValue(normalized, 1);
    if (previous) expanded.add(previous);
    if (next) expanded.add(next);
  });
  return Array.from(expanded);
};

const buildLookbackMonthKeys = (centerMonth, lookback = 6, forward = 1) => {
  const normalized = String(centerMonth || '').trim();
  if (!normalized) return [];
  const keys = new Set([normalized]);
  for (let offset = 1; offset <= Number(lookback || 0); offset += 1) {
    const previous = shiftMonthValue(normalized, -offset);
    if (previous) keys.add(previous);
  }
  for (let offset = 1; offset <= Number(forward || 0); offset += 1) {
    const next = shiftMonthValue(normalized, offset);
    if (next) keys.add(next);
  }
  return Array.from(keys);
};

const normalizeAssignmentStatus = (status) => String(status || '').trim().toLowerCase();

const normalizeStudentLevel = (role) => {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'studentaca') return 'ACA';
  return 'IELTS';
};

const toBaseStudent = (user) => ({
  id: String(user?._id || ''),
  name: String(user?.name || 'Unnamed student'),
  level: normalizeStudentLevel(user?.role),
  dailyProgress: [],
  assignments: [],
  missing: 0,
  pending: 0,
  completed: false,
  hasMissing: false,
  hasPendingReview: false,
});

const fetchAllUsersByRole = async (role) => {
  const rows = [];
  let page = 1;

  while (page <= MAX_FETCH_PAGES) {
    const response = await api.getUsers({
      role,
      page,
      limit: USER_FETCH_LIMIT,
      include_total: false,
    });
    const chunk = Array.isArray(response?.data) ? response.data : [];
    rows.push(...chunk);

    const hasNextPage = Boolean(response?.pagination?.hasNextPage);
    if (!hasNextPage || chunk.length === 0) break;
    page += 1;
  }

  return rows;
};

const fetchAllStudentUsers = async () => {
  const roleFetches = await Promise.allSettled(STUDENT_ROLE_KEYS.map((role) => fetchAllUsersByRole(role)));
  const dedupMap = new Map();

  roleFetches.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    const users = Array.isArray(result.value) ? result.value : [];
    users.forEach((user) => {
      const id = String(user?._id || '').trim();
      if (!id) return;
      dedupMap.set(id, user);
    });
  });

  return Array.from(dedupMap.values());
};

const fetchAllPublishedAssignmentsForMonth = async (monthValue) => {
  const rows = [];
  let page = 1;
  let totalPages = 1;

  while (page <= MAX_FETCH_PAGES && page <= totalPages) {
    const response = await api.homeworkGetAssignments({
      page,
      limit: ASSIGNMENT_FETCH_LIMIT,
      ...(monthValue ? { month: monthValue } : {}),
    });
    const chunkRaw = Array.isArray(response?.data) ? response.data : [];
    const chunk = chunkRaw.filter((assignment) => normalizeAssignmentStatus(assignment?.status) !== 'draft');
    rows.push(...chunk);

    const reportedTotalPages = Number(response?.pagination?.totalPages || 1);
    totalPages = Math.max(1, reportedTotalPages);
    if (page >= totalPages || chunkRaw.length === 0) break;
    page += 1;
  }

  return rows;
};

const toLocalDayStart = (value = new Date()) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

const addLocalDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + (Number(days) || 0));
  return next;
};

const toTimestamp = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
};

const toDayEndTimestamp = (isoDay) => {
  return resolveHomeworkDayEndTimestamp(isoDay);
};

const resolveEffectiveDueAt = (taskDueAt, assignmentDueAt) => {
  const taskDueTs = resolveHomeworkDueCutoffTimestamp(taskDueAt);
  const assignmentDueTs = resolveHomeworkDueCutoffTimestamp(assignmentDueAt);
  if (taskDueTs === null) return assignmentDueAt || taskDueAt || null;
  if (assignmentDueTs === null) return taskDueAt || assignmentDueAt || null;
  return assignmentDueTs < taskDueTs ? assignmentDueAt : taskDueAt;
};

const resolveTaskSubmissionTiming = ({ task = {}, dueAt = null } = {}) => {
  const submissionId = String(task?.submission_id || task?.homework_submission_id || '').trim();
  const submittedAtTs = toTimestamp(task?.submitted_at);
  const hasSubmission = Boolean(submissionId) || submittedAtTs !== null;
  const dueTs = resolveHomeworkDueCutoffTimestamp(dueAt);
  const dueDay = resolveHomeworkDueDayKey(dueAt) || toIsoDay(dueAt);
  const isLate = hasSubmission && dueTs !== null && submittedAtTs !== null && submittedAtTs > dueTs;
  const isOnTime = hasSubmission && !isLate;

  return {
    hasSubmission,
    submittedAtTs,
    dueTs,
    dueDay,
    isLate,
    isOnTime,
  };
};

const clampNumber = (value, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(Math.max(parsed, min), max);
};

const resolveTaskGroupMetrics = (task = {}) => {
  const taskStatus = String(task?.status || '').trim().toLowerCase();
  const totalCountRaw = Number(task?.total_count);
  const totalCount = Number.isFinite(totalCountRaw) && totalCountRaw > 0
    ? Math.trunc(totalCountRaw)
    : 1;

  const doneCountRaw = Number(task?.done_count);
  const statusBasedDoneCount = taskStatus === 'completed'
    ? totalCount
    : taskStatus === 'in_progress'
      ? 1
      : 0;
  const doneCount = Number.isFinite(doneCountRaw)
    ? clampNumber(Math.trunc(doneCountRaw), 0, totalCount)
    : statusBasedDoneCount;

  const normalizedStatus = doneCount <= 0
    ? 'not_started'
    : doneCount >= totalCount
      ? 'completed'
      : 'in_progress';

  return {
    totalCount,
    doneCount,
    normalizedStatus,
    isStarted: doneCount > 0,
    isCompleted: doneCount >= totalCount,
    isPending: doneCount > 0 && doneCount < totalCount,
    isGraded:
      Boolean(task?.graded_at)
      || (
        task?.score !== null
        && task?.score !== undefined
        && normalizedStatus === 'completed'
      ),
  };
};

const formatTimeAgo = (value) => {
  const timestamp = toTimestamp(value);
  if (timestamp === null) return '--';

  const diffMs = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const formatJoinedAgo = (createdAt) => {
  const timestamp = toTimestamp(createdAt);
  if (timestamp === null) return '--';
  const diffDays = Math.max(0, Math.floor((Date.now() - timestamp) / MS_PER_DAY));
  if (diffDays === 0) return 'today';
  return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
};

const buildRangeDays = (rangeDaysInput = 7) => {
  const safeRangeDays = Number(rangeDaysInput) === 30 ? 30 : 7;
  const end = toLocalDayStart(new Date());
  const start = addLocalDays(end, -(safeRangeDays - 1));
  const days = Array.from(
    { length: safeRangeDays },
    (_, index) => toLocalIsoDay(addLocalDays(start, index)),
  );
  return {
    safeRangeDays,
    days,
    daySet: new Set(days),
    startDay: days[0] || TODAY,
    endDay: days[days.length - 1] || TODAY,
  };
};

const createEmptyStaffDashboardData = (rangeDaysInput = 7) => {
  const { safeRangeDays, days } = buildRangeDays(rangeDaysInput);
  return {
    rangeDays: safeRangeDays,
    stats: {
      totalStudents: 0,
      totalSubmitted: 0,
      onTimeToday: 0,
      completionRate: 0,
      totalAssignments: 0,
      totalPendingReviews: 0,
    },
    submissionStackedSeries: days.map((date) => ({
      date,
      submitted: 0,
      notSubmitted: 0,
    })),
    submissionEvents: [],
    newStudents: [],
    activeStudents: [],
    students: [],
  };
};

const fetchPublishedAssignmentsByMonths = async (months = []) => {
  const assignmentMap = new Map();
  for (const month of months) {
    const monthKey = String(month || '').trim();
    if (!monthKey) continue;
    const rows = await fetchAllPublishedAssignmentsForMonth(monthKey);
    rows.forEach((assignment) => {
      const id = String(assignment?._id || '').trim();
      if (!id) return;
      assignmentMap.set(id, assignment);
    });
  }
  return Array.from(assignmentMap.values());
};

export const loadHomeroomStudentsQuick = async () => {
  const { currentUserId, viewerRole } = resolveViewerScopeContext();
  if (!currentUserId) return [];

  const effectiveScope = resolveEffectiveStudentScope({ viewerRole, requestedScope: 'homeroom' });
  const allStudents = await fetchAllStudentUsers();
  const scopedStudents = filterStudentsByScope({ students: allStudents, currentUserId, scope: effectiveScope });

  return scopedStudents
    .map((student) => ({
      id: String(student?._id || ''),
      name: String(student?.name || 'Unnamed student'),
      level: normalizeStudentLevel(student?.role),
      missing: -1, // sentinel: progress not loaded yet
      pending: -1,
      completed: false,
      dailyProgress: [],
      assignments: [],
      overallStatus: '_loading',
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
};

export const loadHomeroomHomeworkProgress = async ({ selectedDate = TODAY } = {}) => {
  const { currentUserId, viewerRole } = resolveViewerScopeContext();
  const normalizedSelectedDate = String(selectedDate || TODAY).slice(0, 10);
  const selectedDateDayEndTs = toDayEndTimestamp(normalizedSelectedDate);

  if (!currentUserId) {
    return {
      students: [],
      dateOptions: [normalizedSelectedDate || TODAY],
    };
  }

  const effectiveScope = resolveEffectiveStudentScope({ viewerRole, requestedScope: 'homeroom' });
  const allStudents = await fetchAllStudentUsers();
  const scopedStudents = filterStudentsByScope({ students: allStudents, currentUserId, scope: effectiveScope });

  const studentById = new Map();
  scopedStudents.forEach((student) => {
    const normalized = toBaseStudent(student);
    if (!normalized.id) return;
    studentById.set(normalized.id, normalized);
  });

  if (studentById.size === 0) {
    return {
      students: [],
      dateOptions: [normalizedSelectedDate || TODAY],
    };
  }

  const assignmentMonth = normalizedSelectedDate.slice(0, 7);
  const assignmentMonths = buildLookbackMonthKeys(assignmentMonth, 6, 1);
  const assignments = await fetchPublishedAssignmentsByMonths(assignmentMonths);
  const dateSet = new Set([normalizedSelectedDate || TODAY, TODAY]);

  // Fetch all assignment dashboards in parallel instead of sequentially
  const dashboardPromises = assignments
    .filter((assignment) => String(assignment?._id || '').trim())
    .map(async (assignment) => {
      const assignmentId = String(assignment._id).trim();
      const dashboardResponse = await api.homeworkGetAssignmentDashboard(assignmentId);
      return { assignmentId, assignment, dashboardData: dashboardResponse?.data || {} };
    });

  const dashboardResults = await Promise.allSettled(dashboardPromises);

  for (const result of dashboardResults) {
    if (result.status !== 'fulfilled') continue;
    const { assignmentId, assignment, dashboardData } = result.value;

    const dashboardStudents = Array.isArray(dashboardData?.students) ? dashboardData.students : [];
    const assignmentTitle = String(
      dashboardData?.assignment?.title || assignment?.title || 'Untitled assignment',
    ).trim();

    // Build a map of task_id -> { due_date, title, section_id, section_title } from dashboard assignment data
    const dashboardTasks = Array.isArray(dashboardData?.assignment?.tasks) ? dashboardData.assignment.tasks : [];
    const dashboardSections = Array.isArray(dashboardData?.assignment?.sections)
      ? dashboardData.assignment.sections
      : [];
    const taskSectionMetaMap = new Map();
    dashboardSections.forEach((section, sectionIndex) => {
      const sectionId = String(section?._id || '').trim();
      const sectionTitle = String(section?.name || section?.title || `Section ${sectionIndex + 1}`).trim() || `Section ${sectionIndex + 1}`;
      const lessons = Array.isArray(section?.lessons) ? section.lessons : [];
      lessons.forEach((lesson) => {
        const lessonId = String(lesson?._id || '').trim();
        if (!lessonId) return;
        taskSectionMetaMap.set(lessonId, {
          section_id: sectionId || null,
          section_title: sectionTitle,
        });
      });
    });

    const taskMetaMap = new Map();
    dashboardTasks.forEach((task) => {
      const taskId = String(task?._id || '').trim();
      if (!taskId) return;
      const sectionMeta = taskSectionMetaMap.get(taskId) || {};
      taskMetaMap.set(taskId, {
        title: String(task?.title || task?.type || 'Task').trim(),
        due_date: resolveHomeworkDueDayKey(task?.due_date) || toIsoDay(task?.due_date) || null,
        due_at: task?.due_date || null,
        section_id: sectionMeta.section_id || null,
        section_title: sectionMeta.section_title || null,
      });
    });
    const assignmentDueAt = dashboardData?.assignment?.due_date || assignment?.due_date || null;
    const assignmentDueDay = resolveHomeworkDueDayKey(assignmentDueAt) || toIsoDay(assignmentDueAt) || null;

    dashboardStudents.forEach((dashboardStudent) => {
      const studentId = String(dashboardStudent?._id || '').trim();
      const target = studentById.get(studentId);
      if (!target) return;

      const tasks = Array.isArray(dashboardStudent?.tasks) ? dashboardStudent.tasks : [];
      if (tasks.length === 0) return;
      const assignmentMonthValue = String(
        dashboardData?.assignment?.month || assignment?.month || '',
      ).slice(0, 7);

      let startedTaskGroups = 0;
      let completedTaskGroups = 0;
      let gradedTaskGroups = 0;
      let pendingReviewTaskGroups = 0;
      let missingTaskGroups = 0;
      let pendingTaskGroups = 0;
      const taskSubmissions = [];
      let assignmentDoneCount = 0;
      let assignmentTotalCount = 0;

      tasks.forEach((task) => {
        const metrics = resolveTaskGroupMetrics(task);
        const taskStatus = metrics.normalizedStatus;
        const taskId = String(task?.task_id || '').trim();
        const taskSlotId = String(task?.task_slot_id || '').trim();
        const meta = taskMetaMap.get(taskId) || {};
        const taskDueAtRaw = task?.task_due_date || meta.due_at || assignmentDueAt;
        const taskDueAt = resolveEffectiveDueAt(taskDueAtRaw, assignmentDueAt);
        const taskDueDay =
          resolveHomeworkDueDayKey(taskDueAt)
          || meta.due_date
          || assignmentDueDay;
        const taskTiming = resolveTaskSubmissionTiming({
          task,
          metrics,
          dueAt: taskDueAt,
        });
        const isDeadlinePassedOnSelectedDate = taskTiming.dueTs !== null
          ? (selectedDateDayEndTs !== null ? taskTiming.dueTs <= selectedDateDayEndTs : false)
          : true;
        const isMissingByRule = !taskTiming.hasSubmission && isDeadlinePassedOnSelectedDate;
        const isPendingByRule = !taskTiming.hasSubmission && !isDeadlinePassedOnSelectedDate;

        assignmentDoneCount += metrics.doneCount;
        assignmentTotalCount += metrics.totalCount;

        if (metrics.isStarted) startedTaskGroups += 1;
        if (metrics.isCompleted) completedTaskGroups += 1;
        if (metrics.isGraded) gradedTaskGroups += 1;
        if (metrics.isStarted && !metrics.isGraded) pendingReviewTaskGroups += 1;
        if (isMissingByRule) missingTaskGroups += 1;
        if (isPendingByRule) pendingTaskGroups += 1;
        if (taskDueDay) dateSet.add(taskDueDay);

        const submissionIdRaw = task?.submission_id || task?.homework_submission_id || null;
        const submissionId = submissionIdRaw ? String(submissionIdRaw) : null;
        taskSubmissions.push({
          task_id: taskId,
          task_slot_id: taskSlotId || `task:${taskId || taskSubmissions.length}`,
          task_title: String(task?.task_title || meta.title || 'Task').trim(),
          section_id: String(meta?.section_id || '').trim() || null,
          section_title: String(meta?.section_title || '').trim() || null,
          task_due_date: taskDueDay || null,
          status: taskStatus,
          submitted_at: task?.submitted_at || null,
          score: task?.score ?? null,
          graded_at: task?.graded_at || null,
          homework_submission_id: submissionId,
          group_id: String(task?.group_id || '').trim() || null,
          done_count: metrics.doneCount,
          total_count: metrics.totalCount,
          submission_timing: taskTiming.isOnTime
            ? 'on_time'
            : taskTiming.isLate
              ? 'late'
              : isMissingByRule
                ? 'missing'
                : 'not_submitted',
          is_late: taskTiming.isLate,
          is_on_time: taskTiming.isOnTime,
          is_missing: isMissingByRule,
          is_not_submitted: isPendingByRule,
          internal_items: Array.isArray(task?.internal_items) ? task.internal_items : [],
        });
      });

      const submittedDateCandidates = tasks.map((task) => toIsoDay(task?.submitted_at)).filter(Boolean);
      const latestSubmittedAt = submittedDateCandidates.sort().at(-1) || null;
      if (latestSubmittedAt) dateSet.add(latestSubmittedAt);
      const shouldInclude = assignmentMonthValue === assignmentMonth || startedTaskGroups > 0;
      if (!shouldInclude) return;
      const assignmentCompletionStatus =
        missingTaskGroups > 0
          ? 'missing'
          : assignmentDoneCount <= 0
            ? 'not_started'
            : assignmentDoneCount >= assignmentTotalCount
              ? 'completed'
              : 'in_progress';

      target.assignments.push({
        id: assignmentId,
        assignmentId,
        title: assignmentTitle || 'Untitled assignment',
        status: assignmentCompletionStatus,
        gradingStatus: startedTaskGroups > 0 && pendingReviewTaskGroups === 0 ? 'Done' : 'Pending',
        submittedAt: latestSubmittedAt,
        submittedTasks: startedTaskGroups,
        totalTasks: tasks.length,
        doneCount: assignmentDoneCount,
        totalCount: assignmentTotalCount,
        completedTasks: completedTaskGroups,
        gradedTasks: gradedTaskGroups,
        taskSubmissions,
      });
      target.missing += missingTaskGroups;
      target.pending += pendingTaskGroups;
      if (missingTaskGroups > 0) target.hasMissing = true;
      const hasPending = pendingReviewTaskGroups > 0;
      if (hasPending) target.hasPendingReview = true;
    });
  }

  const students = Array.from(studentById.values())
    .map((student) => {
      const hasAssignments = Array.isArray(student.assignments) && student.assignments.length > 0;
      const completed = hasAssignments && student.assignments.every(
        (assignment) => String(assignment?.status || '').trim().toLowerCase() === 'completed',
      );
      const overallStatus = student.hasMissing
        ? 'needs_attention'
        : student.hasPendingReview
          ? 'in_review'
          : 'on_track';
      return {
        id: student.id,
        name: student.name,
        level: student.level,
        missing: student.missing,
        pending: student.pending,
        completed,
        dailyProgress: [{
          date: normalizedSelectedDate || TODAY,
          missing: student.missing,
          pending: student.pending,
          completed,
        }],
        assignments: student.assignments,
        overallStatus,
      };
    })
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));

  const dateOptions = Array.from(dateSet)
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .sort((a, b) => (a < b ? 1 : -1));

  return { students, dateOptions };
};

export const loadStaffDashboardData = async ({ rangeDays = 7, scope = 'homeroom' } = {}) => {
  const { currentUserId, viewerRole } = resolveViewerScopeContext();
  const localToday = TODAY;

  const { safeRangeDays, days, daySet, startDay, endDay } = buildRangeDays(rangeDays);
  const emptyData = createEmptyStaffDashboardData(safeRangeDays);

  if (!currentUserId) return emptyData;

  const effectiveScope = resolveEffectiveStudentScope({ viewerRole, requestedScope: scope });

  const allStudents = await fetchAllStudentUsers();
  const scopedStudents = filterStudentsByScope({ students: allStudents, currentUserId, scope: effectiveScope });

  if (scopedStudents.length === 0) return emptyData;

  const studentById = new Map();
  scopedStudents.forEach((student) => {
    const id = String(student?._id || '').trim();
    if (!id) return;
    studentById.set(id, {
      id,
      name: String(student?.name || 'Unnamed student'),
      level: normalizeStudentLevel(student?.role),
      joinedAtIso: toLocalIsoDay(student?.createdAt),
      joinedAt: formatJoinedAgo(student?.createdAt),
      assignments: [],
      totalMissing: 0,
      totalSubmitted: 0,
      totalSlots: 0,
      pendingReviewSlots: 0,
      todayMissingSlots: 0,
      todayTotalSlots: 0,
      hasMissing: false,
      hasPendingReview: false,
    });
  });

  const monthKeys = Array.from(new Set(days.map((day) => String(day).slice(0, 7)).filter(Boolean)));
  const publishedAssignments = await fetchPublishedAssignmentsByMonths(expandMonthKeys(monthKeys));

  const daySubmittedStudents = new Map(days.map((day) => [day, new Set()]));
  const eventRows = [];

  let totalSlots = 0;
  let totalSubmitted = 0;
  let totalPendingReviews = 0;

  // Fetch all assignment dashboards in parallel
  const staffDashPromises = publishedAssignments
    .filter((assignment) => String(assignment?._id || '').trim())
    .map(async (assignment) => {
      const assignmentId = String(assignment._id).trim();
      const dueDay = resolveHomeworkDueDayKey(assignment?.due_date) || toLocalIsoDay(assignment?.due_date);
      const dashboardResponse = await api.homeworkGetAssignmentDashboard(assignmentId);
      return { assignmentId, assignment, dueDay, dashboardData: dashboardResponse?.data || {} };
    });

  const staffDashResults = await Promise.allSettled(staffDashPromises);

  for (const result of staffDashResults) {
    if (result.status !== 'fulfilled') continue;
    const { assignmentId, assignment, dueDay, dashboardData } = result.value;

    const assignmentTitle = String(
      dashboardData?.assignment?.title || assignment?.title || 'Untitled assignment',
    ).trim();
    const dashboardStudents = Array.isArray(dashboardData?.students) ? dashboardData.students : [];
    const assignmentDueAt = dashboardData?.assignment?.due_date || assignment?.due_date || null;

    dashboardStudents.forEach((dashboardStudent) => {
      const studentId = String(dashboardStudent?._id || '').trim();
      const targetStudent = studentById.get(studentId);
      if (!targetStudent) return;

      const tasks = Array.isArray(dashboardStudent?.tasks) ? dashboardStudent.tasks : [];
      if (tasks.length === 0) return;

      let doneUnits = 0;
      let totalUnits = 0;
      let pendingReviewUnits = 0;
      let missingGroups = 0;
      let hasDueInRange = false;
      let latestSubmittedAt = null;
      let latestSubmissionId = '';
      let latestSubmissionIsLate = false;

      tasks.forEach((task) => {
        const metrics = resolveTaskGroupMetrics(task);
        const submittedAtTs = toTimestamp(task?.submitted_at);
        const submittedAtDay = toLocalIsoDay(task?.submitted_at);
        const submittedInRange = submittedAtTs !== null && submittedAtDay && daySet.has(submittedAtDay);
        const submissionIdRaw = task?.submission_id || task?.homework_submission_id || '';
        const submissionId = String(submissionIdRaw || '').trim();
        const taskDueAtRaw = task?.task_due_date || assignmentDueAt;
        const taskDueAt = resolveEffectiveDueAt(taskDueAtRaw, assignmentDueAt);
        const taskDueDay = resolveHomeworkDueDayKey(taskDueAt) || dueDay;
        const taskDueInRange = Boolean(taskDueDay && daySet.has(taskDueDay));
        const taskTiming = resolveTaskSubmissionTiming({
          task,
          metrics,
          dueAt: taskDueAt,
        });

        if (taskDueInRange) {
          hasDueInRange = true;
          const onTimeDoneCount = taskTiming.isOnTime ? metrics.doneCount : 0;
          const isPastDue = taskDueDay ? taskDueDay <= localToday : true;

          totalUnits += metrics.totalCount;
          doneUnits += onTimeDoneCount;
          if (metrics.isStarted && !metrics.isGraded) pendingReviewUnits += metrics.doneCount;
          if (isPastDue && !taskTiming.isOnTime) missingGroups += 1;
        }

        if (submittedInRange && taskTiming.hasSubmission) {
          const submittedStudents = daySubmittedStudents.get(submittedAtDay);
          if (submittedStudents) submittedStudents.add(studentId);
        }

        if (submittedInRange) {
          if (!latestSubmittedAt || submittedAtTs > latestSubmittedAt) {
            latestSubmittedAt = submittedAtTs;
            latestSubmissionId = submissionId;
            latestSubmissionIsLate = taskTiming.isLate;
          } else if (submittedAtTs === latestSubmittedAt && !latestSubmissionId && submissionId) {
            latestSubmissionId = submissionId;
          }
        }
      });

      if (hasDueInRange) {
        targetStudent.assignments.push({
          id: assignmentId,
          title: assignmentTitle || 'Untitled assignment',
          dueDay,
          status: doneUnits > 0 && missingGroups === 0 ? 'Submitted' : 'Missing',
          gradingStatus: pendingReviewUnits > 0 ? 'Pending' : 'Done',
          totalSlots: totalUnits,
          submittedSlots: doneUnits,
          missingSlots: missingGroups,
        });

        targetStudent.totalMissing += missingGroups;
        targetStudent.totalSubmitted += doneUnits;
        targetStudent.totalSlots += totalUnits;
        targetStudent.pendingReviewSlots += pendingReviewUnits;
        if (missingGroups > 0) targetStudent.hasMissing = true;
        if (pendingReviewUnits > 0) targetStudent.hasPendingReview = true;

        if (dueDay === localToday) {
          targetStudent.todayMissingSlots += missingGroups;
          targetStudent.todayTotalSlots += totalUnits;
        }

        totalSubmitted += doneUnits;
        totalSlots += totalUnits;
        totalPendingReviews += pendingReviewUnits;
      }

      if (latestSubmittedAt !== null) {
        eventRows.push({
          id: latestSubmissionId || `${assignmentId}-${studentId}-${latestSubmittedAt}`,
          studentName: targetStudent.name,
          assignmentName: assignmentTitle || 'Untitled assignment',
          submittedAtTs: latestSubmittedAt,
          submissionId: latestSubmissionId || null,
          status: latestSubmissionIsLate ? 'Late' : 'Submitted',
        });
      }
    });
  }

  const students = Array.from(studentById.values())
    .map((student) => ({
      id: student.id,
      name: student.name,
      level: student.level,
      joinedAt: student.joinedAt,
      joinedAtIso: student.joinedAtIso,
      missing: student.totalMissing,
      totalSubmitted: student.totalSubmitted,
      totalSlots: student.totalSlots,
      assignments: student.assignments,
      overallStatus: student.hasMissing ? 'needs_attention' : student.hasPendingReview ? 'in_review' : 'on_track',
      todayMissingSlots: student.todayMissingSlots,
      todayTotalSlots: student.todayTotalSlots,
    }))
    .sort((left, right) => String(left.name).localeCompare(String(right.name)));

  const newStudents = students
    .filter((student) => {
      const joinedDay = String(student.joinedAtIso || '').trim();
      if (!joinedDay || !startDay || !endDay) return false;
      return joinedDay >= startDay && joinedDay <= endDay;
    })
    .sort((left, right) => {
      const leftDay = String(left.joinedAtIso || '').trim();
      const rightDay = String(right.joinedAtIso || '').trim();
      return rightDay.localeCompare(leftDay);
    })
    .slice(0, 4);

  const activeStudents = students
    .filter((student) => student.todayTotalSlots > 0 && student.todayMissingSlots === 0)
    .slice(0, 8);

  const totalStudents = Number(students.length || 0);
  const submissionStackedSeries = days.map((day) => {
    const submittedStudents = daySubmittedStudents.get(day);
    const submitted = submittedStudents instanceof Set ? submittedStudents.size : 0;
    return {
      date: day,
      submitted,
      notSubmitted: Math.max(0, totalStudents - submitted),
    };
  });

  const submissionEvents = eventRows
    .sort((left, right) => right.submittedAtTs - left.submittedAtTs)
    .slice(0, 12)
    .map((event) => ({
      id: event.id,
      studentName: event.studentName,
      status: event.status,
      assignmentName: event.assignmentName,
      timeAgo: formatTimeAgo(event.submittedAtTs),
      submissionId: event.submissionId || null,
    }));

  const completionRate = totalSlots > 0
    ? Math.round((totalSubmitted / totalSlots) * 100)
    : 0;
  const onTimeToday = students.filter(
    (student) => student.todayTotalSlots > 0 && student.todayMissingSlots === 0,
  ).length;

  return {
    rangeDays: safeRangeDays,
    stats: {
      totalStudents: students.length,
      totalSubmitted,
      onTimeToday,
      completionRate,
      totalAssignments: totalSlots,
      totalPendingReviews,
    },
    submissionStackedSeries,
    submissionEvents,
    newStudents,
    activeStudents,
    students,
  };
};
