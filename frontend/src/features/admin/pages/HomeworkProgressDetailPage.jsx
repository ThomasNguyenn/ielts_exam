import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckCircle2, ClipboardList, Clock, FileText, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { sanitizeActiveUIRoleForUser } from '@/app/activeUIRole';
import { USER_ROLE_SUPERVISOR } from '@/app/roleRouting';
import { api } from '@/shared/api/client';
import { TODAY, loadHomeroomHomeworkProgress } from '../data/homeworkProgress.data';
import { DailyProgressBadge } from '../components/status-badge';

const toDateLabel = (isoDate) => {
  const normalized = String(isoDate || '').trim();
  if (!normalized) return '--';
  if (normalized === TODAY) return 'Today';
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return normalized;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const toAssignmentStatusTone = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'completed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'in_progress') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (normalized === 'not_started') return 'border-zinc-200 bg-zinc-50 text-zinc-500';
  if (normalized === 'submitted') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'graded') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (normalized === 'missing') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (normalized === 'not_submitted') return 'border-zinc-200 bg-zinc-50 text-zinc-500';
  return 'border-border bg-muted text-muted-foreground';
};

const toAssignmentStatusLabel = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'in_progress') return 'In progress';
  if (normalized === 'not_started') return 'Not started';
  if (normalized === 'missing') return 'Missing';
  return status || '--';
};

const toGradingStatusTone = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'done') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (normalized === 'pending') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-border bg-muted text-muted-foreground';
};

const toSubmissionLabel = (assignment, index) =>
  String(assignment?.title || '').trim() || `Submission ${index + 1}`;

const toTaskStatusLabel = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'in_progress') return 'In progress';
  if (normalized === 'not_started') return 'Not started';
  return status || '--';
};

const toTaskProgressLabel = (taskSub = {}) => {
  const doneCount = Number(taskSub?.done_count || 0);
  const totalCountRaw = Number(taskSub?.total_count || 0);
  const totalCount = totalCountRaw > 0 ? totalCountRaw : 1;
  return `${doneCount}/${totalCount}`;
};

const toDeadlineLabel = (dueDate) => {
  if (!dueDate) return null;
  const today = TODAY;
  if (dueDate < today) return 'Overdue';
  if (dueDate === today) return 'Due today';
  return `Due ${toDateLabel(dueDate)}`;
};

const toDeadlineTone = (dueDate) => {
  if (!dueDate) return '';
  const today = TODAY;
  if (dueDate < today) return 'text-rose-600';
  if (dueDate === today) return 'text-amber-600';
  return 'text-muted-foreground';
};

export default function HomeworkProgressDetailPage() {
  const navigate = useNavigate();
  const { studentId } = useParams();
  const location = useLocation();
  const activeUIRole = sanitizeActiveUIRoleForUser(api.getUser(), '');
  const isAllStudentsScope = activeUIRole === USER_ROLE_SUPERVISOR;

  const selectedDate = String(location?.state?.selectedDate || TODAY).slice(0, 10);
  const stateStudent = location?.state?.studentSnapshot || null;
  const hasMatchedStateStudent = String(stateStudent?.id || '') === String(studentId || '');

  const [student, setStudent] = useState(hasMatchedStateStudent ? stateStudent : null);
  const [loading, setLoading] = useState(!hasMatchedStateStudent);
  const [error, setError] = useState('');

  useEffect(() => {
    if (hasMatchedStateStudent) {
      setStudent(stateStudent);
      setLoading(false);
      setError('');
      return;
    }

    let isActive = true;
    const loadStudent = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await loadHomeroomHomeworkProgress({ selectedDate });
        if (!isActive) return;
        const found = (Array.isArray(data?.students) ? data.students : []).find(
          (item) => String(item?.id || '') === String(studentId || ''),
        ) || null;
        setStudent(found);
      } catch (loadError) {
        if (!isActive) return;
        setStudent(null);
        setError(loadError?.message || 'Failed to load student progress.');
      } finally {
        if (isActive) setLoading(false);
      }
    };

    void loadStudent();
    return () => {
      isActive = false;
    };
  }, [hasMatchedStateStudent, selectedDate, stateStudent, studentId]);

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
        <Card className="border-border/70 shadow-sm">
          <CardContent className="p-6 text-sm text-muted-foreground">Loading student progress...</CardContent>
        </Card>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Student not found</CardTitle>
            <CardDescription>
              {error || (isAllStudentsScope
                ? 'This student is not available in Homework Progress scope.'
                : 'This student is not in your homeroom scope for Homework Progress.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" onClick={() => navigate('/dashboard/homework-progress')}>
              Back to Homework Progress
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dailyProgress = Array.isArray(student.dailyProgress) ? student.dailyProgress : [];
  const assignments = Array.isArray(student.assignments) ? student.assignments : [];
  const missingTotal = Number(student.missing || 0);
  const isAllAssignmentsCompleted = assignments.length > 0 && assignments.every(
    (item) => String(item?.status || '').trim().toLowerCase() === 'completed',
  );
  const completedAssignmentCount = assignments.filter(
    (item) => String(item?.status || '').toLowerCase() === 'completed',
  ).length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={() => navigate('/dashboard/homework-progress')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl tracking-tight">{student.name}</CardTitle>
          <CardDescription>Homework progress detail for this student.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-border/70 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Level</p>
              <div className="mt-2 inline-flex items-center gap-2">
                <UserRound className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{student.level}</span>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Assignments Completed</p>
              <div className="mt-2 inline-flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {completedAssignmentCount}/{assignments.length || 0}
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Missing (past deadline)</p>
              <div className="mt-2 inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{missingTotal}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Daily Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {dailyProgress.length ? (
            dailyProgress.map((entry) => (
              <div
                key={`${student.id}-${entry.date}`}
                className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2"
              >
                <p className="text-sm font-medium">{toDateLabel(entry.date)}</p>
                <DailyProgressBadge
                  missing={entry.missing}
                  pending={entry.pending}
                  completed={Boolean(entry?.completed ?? isAllAssignmentsCompleted)}
                />
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No daily progress data.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Assignment Snapshots</CardTitle>
          <CardDescription>Student submissions by assignment. Use Grade to review and score.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignments.length ? (
            assignments.map((assignment, index) => {
              const taskSubmissions = Array.isArray(assignment?.taskSubmissions) ? assignment.taskSubmissions : [];
              return (
                <div
                  key={`${student.id}-${assignment?.id || index}`}
                  className="rounded-lg border border-border/70"
                >
                  {/* Assignment header */}
                  <div className="flex flex-col gap-2 border-b border-border/50 bg-muted/20 px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{toSubmissionLabel(assignment, index)}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={toAssignmentStatusTone(assignment?.status)}>
                          {toAssignmentStatusLabel(assignment?.status)}
                        </Badge>
                        <Badge variant="outline" className={toGradingStatusTone(assignment?.gradingStatus)}>
                          {assignment?.gradingStatus || '--'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Per-task submissions */}
                  {taskSubmissions.length > 0 ? (
                    <div className="divide-y divide-border/40">
                      {taskSubmissions.map((taskSub, taskIndex) => {
                        const taskStatus = String(taskSub?.status || '').toLowerCase();
                        const submissionTiming = String(taskSub?.submission_timing || '').toLowerCase();
                        const isLateSubmission = Boolean(taskSub?.is_late) || submissionTiming === 'late';
                        const doneCount = Number(taskSub?.done_count || 0);
                        const hasSubmissionTiming = submissionTiming === 'on_time' || submissionTiming === 'late';
                        const isSubmitted = hasSubmissionTiming || Boolean(taskSub?.submitted_at) || Boolean(taskSub?.homework_submission_id);
                        const isGraded =
                          Boolean(taskSub?.graded_at)
                          || (taskSub?.score !== null && taskSub?.score !== undefined && taskStatus === 'completed');
                        const hasSubmissionId = Boolean(taskSub?.homework_submission_id);
                        const deadlineLabel = toDeadlineLabel(taskSub?.task_due_date);
                        const deadlineTone = toDeadlineTone(taskSub?.task_due_date);
                        const internalItems = Array.isArray(taskSub?.internal_items) ? taskSub.internal_items : [];

                        return (
                          <div
                            key={`${assignment?.id}-${taskSub?.task_slot_id || taskSub?.task_id || taskIndex}`}
                            className="flex flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between"
                          >
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                {isGraded ? (
                                  <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-500" />
                                ) : isSubmitted ? (
                                  <FileText className="h-4 w-4 shrink-0 text-emerald-500" />
                                ) : (
                                  <Clock className="h-4 w-4 shrink-0 text-zinc-400" />
                                )}
                                <span className="text-sm font-medium">{taskSub?.task_title || 'Task'}</span>
                              </div>
                              <div className="ml-6 flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className={toAssignmentStatusTone(taskStatus)}>
                                  {toTaskStatusLabel(taskStatus)}
                                </Badge>
                                {isLateSubmission ? (
                                  <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
                                    Late
                                  </Badge>
                                ) : null}
                                <Badge variant="outline" className="border-border/60 bg-muted/30 text-foreground">
                                  {toTaskProgressLabel(taskSub)}
                                </Badge>
                                {isSubmitted && taskSub?.submitted_at ? (
                                  <span className="text-xs text-muted-foreground">
                                    Submitted {toDateLabel(String(taskSub.submitted_at).slice(0, 10))}
                                  </span>
                                ) : null}
                                {isGraded && taskSub?.score !== null && taskSub?.score !== undefined ? (
                                  <span className="text-xs font-medium text-blue-600">
                                    Score: {taskSub.score}/10
                                  </span>
                                ) : null}
                                {deadlineLabel ? (
                                  <span className={`text-xs ${deadlineTone}`}>
                                    {deadlineLabel}
                                  </span>
                                ) : null}
                              </div>
                              {internalItems.length ? (
                                <div className="ml-6 mt-2 space-y-1">
                                  {internalItems.map((item, itemIndex) => {
                                    const itemStatus = String(item?.status || '').trim().toLowerCase() || 'not_started';
                                    const statusTone =
                                      itemStatus === 'completed'
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : itemStatus === 'in_progress'
                                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                                          : 'border-zinc-200 bg-zinc-50 text-zinc-500';
                                    const slotLabel = String(item?.slot_key || '').trim()
                                      || String(item?.resource_block_id || '').trim()
                                      || `Slot ${itemIndex + 1}`;
                                    return (
                                      <div
                                        key={`${taskSub?.task_slot_id || taskSub?.task_id || taskIndex}-${slotLabel}-${itemIndex}`}
                                        className="flex flex-wrap items-center gap-2"
                                      >
                                        <span className="text-xs text-muted-foreground">{slotLabel}</span>
                                        <Badge variant="outline" className={statusTone}>
                                          {toTaskStatusLabel(itemStatus)}
                                        </Badge>
                                        {item?.completed_at ? (
                                          <span className="text-xs text-muted-foreground">
                                            Completed {toDateLabel(String(item.completed_at).slice(0, 10))}
                                          </span>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2 md:ml-4">
                              {isSubmitted && hasSubmissionId ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={isGraded ? 'outline' : 'default'}
                                  onClick={() =>
                                    navigate(`/homework/submissions/${taskSub.homework_submission_id}`)
                                  }
                                >
                                  {isGraded ? 'View Grade' : 'Grade'}
                                </Button>
                              ) : isSubmitted && !hasSubmissionId ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled
                                >
                                  No data
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      No task submissions available.
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No assignment data for this student in the selected month.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
