import { api } from '@/shared/api/client';

const MAX_FETCH_PAGES = 50;
const USER_FETCH_LIMIT = 100;
const ASSIGNMENT_FETCH_LIMIT = 50;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const TODAY = new Date().toISOString().slice(0, 10);

const toIsoDay = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
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

const toUtcDayStart = (value = new Date()) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));

const addUtcDays = (date, days) => new Date(date.getTime() + (Number(days) || 0) * MS_PER_DAY);

const toTimestamp = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.getTime();
  const date = new Date(String(value || ''));
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
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
  const end = toUtcDayStart(new Date());
  const start = addUtcDays(end, -(safeRangeDays - 1));
  const days = Array.from({ length: safeRangeDays }, (_, index) => toIsoDay(addUtcDays(start, index)));
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
  const currentUser = api.getUser();
  const currentUserId = String(currentUser?._id || '').trim();
  if (!currentUserId) return [];

  const allStudents = await fetchAllUsersByRole('student');
  return allStudents
    .filter((student) => String(student?.homeroom_teacher_id || '').trim() === currentUserId)
    .map((student) => ({
      id: String(student?._id || ''),
      name: String(student?.name || 'Unnamed student'),
      level: normalizeStudentLevel(student?.role),
      missing: -1, // sentinel: progress not loaded yet
      dailyProgress: [],
      assignments: [],
      overallStatus: '_loading',
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
};

export const loadHomeroomHomeworkProgress = async ({ selectedDate = TODAY } = {}) => {
  const currentUser = api.getUser();
  const currentUserId = String(currentUser?._id || '').trim();

  if (!currentUserId) {
    return {
      students: [],
      dateOptions: [selectedDate || TODAY],
    };
  }

  const allStudents = await fetchAllUsersByRole('student');
  const homeroomStudents = allStudents.filter(
    (student) => String(student?.homeroom_teacher_id || '').trim() === currentUserId,
  );

  const studentById = new Map();
  homeroomStudents.forEach((student) => {
    const normalized = toBaseStudent(student);
    if (!normalized.id) return;
    studentById.set(normalized.id, normalized);
  });

  if (studentById.size === 0) {
    return {
      students: [],
      dateOptions: [selectedDate || TODAY],
    };
  }

  const assignmentMonth = String(selectedDate || TODAY).slice(0, 7);
  const assignmentMonths = buildLookbackMonthKeys(assignmentMonth, 6, 1);
  const assignments = await fetchPublishedAssignmentsByMonths(assignmentMonths);
  const dateSet = new Set([selectedDate || TODAY, TODAY]);

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

    // Build a map of task_id → { due_date, title } from dashboard tasks
    const dashboardTasks = Array.isArray(dashboardData?.assignment?.tasks) ? dashboardData.assignment.tasks : [];
    const taskMetaMap = new Map();
    dashboardTasks.forEach((task) => {
      const taskId = String(task?._id || '').trim();
      if (!taskId) return;
      taskMetaMap.set(taskId, {
        title: String(task?.title || task?.type || 'Task').trim(),
        due_date: toIsoDay(task?.due_date) || null,
      });
    });
    const assignmentDueDay = toIsoDay(dashboardData?.assignment?.due_date || assignment?.due_date) || null;

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
      const taskSubmissions = [];
      let assignmentDoneCount = 0;
      let assignmentTotalCount = 0;

      tasks.forEach((task) => {
        const metrics = resolveTaskGroupMetrics(task);
        const taskStatus = metrics.normalizedStatus;
        const taskId = String(task?.task_id || '').trim();
        const taskSlotId = String(task?.task_slot_id || '').trim();
        const meta = taskMetaMap.get(taskId) || {};
        const taskDueDay = toIsoDay(task?.task_due_date) || meta.due_date || assignmentDueDay;
        const isDeadlinePassed = taskDueDay ? taskDueDay <= TODAY : true;

        assignmentDoneCount += metrics.doneCount;
        assignmentTotalCount += metrics.totalCount;

        if (metrics.isStarted) startedTaskGroups += 1;
        if (metrics.isCompleted) completedTaskGroups += 1;
        if (metrics.isGraded) gradedTaskGroups += 1;
        if (metrics.isStarted && !metrics.isGraded) pendingReviewTaskGroups += 1;
        if (isDeadlinePassed && !metrics.isCompleted) {
          missingTaskGroups += 1;
        }

        const submissionIdRaw = task?.submission_id || task?.homework_submission_id || null;
        const submissionId = submissionIdRaw ? String(submissionIdRaw) : null;
        taskSubmissions.push({
          task_id: taskId,
          task_slot_id: taskSlotId || `task:${taskId || taskSubmissions.length}`,
          task_title: String(task?.task_title || meta.title || 'Task').trim(),
          task_due_date: taskDueDay || null,
          status: taskStatus,
          submitted_at: task?.submitted_at || null,
          score: task?.score ?? null,
          graded_at: task?.graded_at || null,
          homework_submission_id: submissionId,
          group_id: String(task?.group_id || '').trim() || null,
          done_count: metrics.doneCount,
          total_count: metrics.totalCount,
          internal_items: Array.isArray(task?.internal_items) ? task.internal_items : [],
        });
      });

      const submittedDateCandidates = tasks.map((task) => toIsoDay(task?.submitted_at)).filter(Boolean);
      const latestSubmittedAt = submittedDateCandidates.sort().at(-1) || null;
      if (latestSubmittedAt) dateSet.add(latestSubmittedAt);
      const shouldInclude = assignmentMonthValue === assignmentMonth || startedTaskGroups > 0;
      if (!shouldInclude) return;
      const assignmentCompletionStatus =
        assignmentDoneCount <= 0
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
      if (missingTaskGroups > 0) target.hasMissing = true;
      const hasPending = pendingReviewTaskGroups > 0;
      if (hasPending) target.hasPendingReview = true;
    });
  }

  const students = Array.from(studentById.values())
    .map((student) => {
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
        dailyProgress: [{ date: selectedDate || TODAY, missing: student.missing }],
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
  const currentUser = api.getUser();
  const currentUserId = String(currentUser?._id || '').trim();
  const isAdminUser = String(currentUser?.role || '').toLowerCase() === 'admin';

  const { safeRangeDays, days, daySet, startDay, endDay } = buildRangeDays(rangeDays);
  const emptyData = createEmptyStaffDashboardData(safeRangeDays);

  if (!currentUserId) return emptyData;

  const normalizedScope = String(scope || '').trim().toLowerCase();
  const effectiveScope = isAdminUser && normalizedScope === 'all' ? 'all' : 'homeroom';

  const allStudents = await fetchAllUsersByRole('student');
  const scopedStudents = effectiveScope === 'all'
    ? allStudents
    : allStudents.filter((student) => String(student?.homeroom_teacher_id || '').trim() === currentUserId);

  if (scopedStudents.length === 0) return emptyData;

  const studentById = new Map();
  scopedStudents.forEach((student) => {
    const id = String(student?._id || '').trim();
    if (!id) return;
    studentById.set(id, {
      id,
      name: String(student?.name || 'Unnamed student'),
      level: normalizeStudentLevel(student?.role),
      joinedAtIso: toIsoDay(student?.createdAt),
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

  const dayTotals = new Map(days.map((day) => [day, { submitted: 0, total: 0 }]));
  const eventRows = [];

  let totalSlots = 0;
  let totalSubmitted = 0;
  let totalPendingReviews = 0;

  // Fetch all assignment dashboards in parallel
  const staffDashPromises = publishedAssignments
    .filter((assignment) => String(assignment?._id || '').trim())
    .map(async (assignment) => {
      const assignmentId = String(assignment._id).trim();
      const dueDay = toIsoDay(assignment?.due_date);
      const dueInRange = Boolean(dueDay && daySet.has(dueDay));
      const dashboardResponse = await api.homeworkGetAssignmentDashboard(assignmentId);
      return { assignmentId, assignment, dueDay, dueInRange, dashboardData: dashboardResponse?.data || {} };
    });

  const staffDashResults = await Promise.allSettled(staffDashPromises);

  for (const result of staffDashResults) {
    if (result.status !== 'fulfilled') continue;
    const { assignmentId, assignment, dueDay, dueInRange, dashboardData } = result.value;

    const assignmentTitle = String(
      dashboardData?.assignment?.title || assignment?.title || 'Untitled assignment',
    ).trim();
    const dashboardStudents = Array.isArray(dashboardData?.students) ? dashboardData.students : [];
    const assignmentDueTs = toTimestamp(dashboardData?.assignment?.due_date || assignment?.due_date);

    dashboardStudents.forEach((dashboardStudent) => {
      const studentId = String(dashboardStudent?._id || '').trim();
      const targetStudent = studentById.get(studentId);
      if (!targetStudent) return;

      const tasks = Array.isArray(dashboardStudent?.tasks) ? dashboardStudent.tasks : [];
      if (tasks.length === 0) return;

      let doneUnits = 0;
      let doneUnitsInRange = 0;
      let totalUnits = 0;
      let totalUnitsInRange = 0;
      let pendingReviewUnits = 0;
      let pendingReviewUnitsInRange = 0;
      let missingGroups = 0;
      let latestSubmittedAt = null;
      let latestSubmissionId = '';
      const submittedUnitsByDay = new Map();

      tasks.forEach((task) => {
        const metrics = resolveTaskGroupMetrics(task);
        const submittedAtTs = toTimestamp(task?.submitted_at);
        const submittedAtDay = toIsoDay(task?.submitted_at);
        const submittedInRange = submittedAtTs !== null && submittedAtDay && daySet.has(submittedAtDay);
        const submissionIdRaw = task?.submission_id || task?.homework_submission_id || '';
        const submissionId = String(submissionIdRaw || '').trim();
        const taskDueDay = toIsoDay(task?.task_due_date) || dueDay;
        const isPastDue = taskDueDay ? taskDueDay <= TODAY : true;

        totalUnits += metrics.totalCount;
        doneUnits += metrics.doneCount;

        if (submittedInRange) {
          totalUnitsInRange += metrics.doneCount;
          doneUnitsInRange += metrics.doneCount;
          const currentSubmittedUnits = Number(submittedUnitsByDay.get(submittedAtDay) || 0);
          submittedUnitsByDay.set(submittedAtDay, currentSubmittedUnits + metrics.doneCount);
        }
        if (metrics.isStarted && !metrics.isGraded) {
          pendingReviewUnits += metrics.doneCount;
          if (submittedInRange) pendingReviewUnitsInRange += metrics.doneCount;
        }
        if (isPastDue && !metrics.isCompleted) missingGroups += 1;

        if (submittedInRange) {
          if (!latestSubmittedAt || submittedAtTs > latestSubmittedAt) {
            latestSubmittedAt = submittedAtTs;
            latestSubmissionId = submissionId;
          } else if (submittedAtTs === latestSubmittedAt && !latestSubmissionId && submissionId) {
            latestSubmissionId = submissionId;
          }
        }
      });

      const hasSubmissionInRange = doneUnitsInRange > 0;
      if (!dueInRange && !hasSubmissionInRange) return;

      const effectiveDoneUnits = dueInRange ? doneUnits : doneUnitsInRange;
      const effectivePendingReviewUnits = dueInRange ? pendingReviewUnits : pendingReviewUnitsInRange;
      const effectiveMissingGroups = dueInRange ? missingGroups : 0;
      const effectiveTotalUnits = dueInRange ? totalUnits : totalUnitsInRange;

      targetStudent.assignments.push({
        id: assignmentId,
        title: assignmentTitle || 'Untitled assignment',
        dueDay,
        status: effectiveDoneUnits > 0 && effectiveMissingGroups === 0 ? 'Submitted' : 'Missing',
        gradingStatus: effectivePendingReviewUnits > 0 ? 'Pending' : 'Done',
        totalSlots: effectiveTotalUnits,
        submittedSlots: effectiveDoneUnits,
        missingSlots: effectiveMissingGroups,
      });

      targetStudent.totalMissing += effectiveMissingGroups;
      targetStudent.totalSubmitted += effectiveDoneUnits;
      targetStudent.totalSlots += effectiveTotalUnits;
      targetStudent.pendingReviewSlots += effectivePendingReviewUnits;
      if (effectiveMissingGroups > 0) targetStudent.hasMissing = true;
      if (effectivePendingReviewUnits > 0) targetStudent.hasPendingReview = true;

      if (dueInRange && dueDay === TODAY) {
        targetStudent.todayMissingSlots += effectiveMissingGroups;
        targetStudent.todayTotalSlots += effectiveTotalUnits;
      }

      if (dueInRange) {
        const dayBucket = dayTotals.get(dueDay);
        if (dayBucket) {
          dayBucket.submitted += effectiveDoneUnits;
          dayBucket.total += effectiveTotalUnits;
        }
      } else if (submittedUnitsByDay.size > 0) {
        submittedUnitsByDay.forEach((submittedUnits, dayKey) => {
          const dayBucket = dayTotals.get(dayKey);
          if (!dayBucket) return;
          const normalizedSubmittedUnits = Number(submittedUnits || 0);
          dayBucket.submitted += normalizedSubmittedUnits;
          dayBucket.total += normalizedSubmittedUnits;
        });
      }

      totalSubmitted += effectiveDoneUnits;
      totalSlots += effectiveTotalUnits;
      totalPendingReviews += effectivePendingReviewUnits;

      if (latestSubmittedAt !== null) {
        eventRows.push({
          id: latestSubmissionId || `${assignmentId}-${studentId}-${latestSubmittedAt}`,
          studentName: targetStudent.name,
          assignmentName: assignmentTitle || 'Untitled assignment',
          submittedAtTs: latestSubmittedAt,
          submissionId: latestSubmissionId || null,
          status: assignmentDueTs !== null && latestSubmittedAt > assignmentDueTs ? 'Late' : 'Submitted',
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

  const startTs = toTimestamp(startDay);
  const endTs = toTimestamp(endDay);
  const newStudents = students
    .filter((student) => {
      const joinedTs = toTimestamp(student.joinedAtIso);
      if (joinedTs === null || startTs === null || endTs === null) return false;
      return joinedTs >= startTs && joinedTs <= endTs + MS_PER_DAY - 1;
    })
    .sort((left, right) => {
      const leftTs = toTimestamp(left.joinedAtIso) || 0;
      const rightTs = toTimestamp(right.joinedAtIso) || 0;
      return rightTs - leftTs;
    })
    .slice(0, 4);

  const activeStudents = students
    .filter((student) => student.todayTotalSlots > 0 && student.todayMissingSlots === 0)
    .slice(0, 8);

  const submissionStackedSeries = days.map((day) => {
    const bucket = dayTotals.get(day) || { submitted: 0, total: 0 };
    const submitted = Number(bucket.submitted || 0);
    const total = Number(bucket.total || 0);
    return {
      date: day,
      submitted,
      notSubmitted: Math.max(0, total - submitted),
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
