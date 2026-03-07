import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, ClipboardList, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TODAY, loadHomeroomHomeworkProgress } from './homeworkProgress.data';
import { DailyProgressBadge } from './status-badge';

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
  if (normalized === 'submitted') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (normalized === 'missing') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-border bg-muted text-muted-foreground';
};

const toGradingStatusTone = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'done') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (normalized === 'pending') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-border bg-muted text-muted-foreground';
};

const toSubmissionLabel = (assignment, index) =>
  String(assignment?.title || '').trim() || `Submission ${index + 1}`;

export default function HomeworkProgressDetailPage() {
  const navigate = useNavigate();
  const { studentId } = useParams();
  const location = useLocation();

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
              {error || 'This student is not in your homeroom scope for Homework Progress.'}
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
  const missingTotal = dailyProgress.reduce((sum, entry) => sum + Number(entry?.missing || 0), 0);
  const submittedCount = assignments.filter(
    (item) => String(item?.status || '').toLowerCase() === 'submitted',
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
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Assignments Submitted</p>
              <div className="mt-2 inline-flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {submittedCount}/{assignments.length || 0}
                </span>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Missing (tracked dates)</p>
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
                <DailyProgressBadge missing={entry.missing} />
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
          <CardDescription>Progress summary by assignment for this student.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {assignments.length ? (
            assignments.map((assignment, index) => {
              const assignmentId = String(assignment?.assignmentId || assignment?.id || '').trim();
              return (
                <div
                  key={`${student.id}-${assignment?.id || index}`}
                  className="rounded-lg border border-border/70 p-4"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                      <p className="font-medium text-foreground">{toSubmissionLabel(assignment, index)}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={toAssignmentStatusTone(assignment?.status)}>
                          {assignment?.status || '--'}
                        </Badge>
                        <Badge variant="outline" className={toGradingStatusTone(assignment?.gradingStatus)}>
                          {assignment?.gradingStatus || '--'}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!assignmentId}
                      onClick={() => navigate(`/homework/assignments/${assignmentId}/dashboard`)}
                    >
                      Open Dashboard
                    </Button>
                  </div>
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
