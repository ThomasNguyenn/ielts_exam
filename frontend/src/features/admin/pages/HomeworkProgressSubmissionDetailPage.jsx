import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CircleDollarSign, FileText } from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TODAY, students } from '../data/staffDashboard.mock';

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

const toSubmissionLabel = (assignment) =>
  String(assignment?.title || '').trim() || `Submission ${String(assignment?.id || '').trim() || '--'}`;

const toSafeScore = (value) => {
  if (value === null || value === undefined || value === '') return '--';
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number;
};

const FALLBACK_ANSWER_KEYS_BY_ASSIGNMENT = {
  a1: 'Use present perfect correctly and keep verb tense consistent in the sentence.',
  a2: 'Identify the incorrect collocation and replace it with the standard academic form.',
  a3: 'Fix the grammar error and keep the original meaning unchanged.',
};

const toScoreInputValue = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : '';
};

const clampScore = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number < 0 || number > 10) return null;
  return Number(Math.round(number * 10) / 10);
};

const resolveAnswerKey = (submission = {}) =>
  String(
    submission?.answerKey
    || submission?.answer_key
    || submission?.modelAnswer
    || submission?.model_answer
    || submission?.expectedAnswer
    || submission?.expected_answer
    || submission?.reference_answer
    || FALLBACK_ANSWER_KEYS_BY_ASSIGNMENT[String(submission?.id || '').trim()]
    || '',
  ).trim();

const resolveStudentAnswer = (submission = {}) =>
  String(
    submission?.studentAnswer
    || submission?.student_answer
    || submission?.textAnswer
    || submission?.text_answer
    || '',
  ).trim();

export default function HomeworkProgressSubmissionDetailPage() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { studentId, submissionId } = useParams();

  const student = useMemo(
    () => students.find((item) => String(item?.id || '') === String(studentId || '')) || null,
    [studentId],
  );

  const submission = useMemo(() => {
    if (!student) return null;
    const assignments = Array.isArray(student.assignments) ? student.assignments : [];
    return assignments.find((item) => String(item?.id || '') === String(submissionId || '')) || null;
  }, [student, submissionId]);

  if (!student || !submission) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle>Submission not found</CardTitle>
            <CardDescription>We could not find this submission for the selected student.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" onClick={() => navigate(`/dashboard/homework-progress/${studentId}`)}>
              Back to Student Detail
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSubmitted = String(submission?.status || '').toLowerCase() === 'submitted';
  const submittedAt = submission?.submittedAt || submission?.submitted_at || TODAY;
  const [scoreDraft, setScoreDraft] = useState(() => toScoreInputValue(submission?.score));
  const [feedbackDraft, setFeedbackDraft] = useState(
    () => String(submission?.teacherFeedback || submission?.teacher_feedback || '').trim(),
  );
  const [saving, setSaving] = useState(false);
  const score = toSafeScore(scoreDraft || submission?.score);
  const answerKey = resolveAnswerKey(submission);
  const studentAnswer = resolveStudentAnswer(submission);
  const hasRealSubmissionId = Boolean(String(submission?.homework_submission_id || '').trim());

  const handleSaveGrade = async () => {
    if (!isSubmitted) {
      showNotification('Submission is missing. Cannot grade yet.', 'error');
      return;
    }

    const normalizedScore = clampScore(scoreDraft);
    if (normalizedScore === null) {
      showNotification('Score must be a number between 0 and 10.', 'error');
      return;
    }

    const normalizedFeedback = String(feedbackDraft || '').trim();
    if (!normalizedFeedback) {
      showNotification('Please add feedback before saving.', 'error');
      return;
    }

    if (!hasRealSubmissionId) {
      showNotification('Saved locally in Homework Progress view (mock mode).', 'success');
      return;
    }

    setSaving(true);
    try {
      await api.homeworkGradeSubmission(submission.homework_submission_id, {
        score: normalizedScore,
        teacher_feedback: normalizedFeedback,
      });
      showNotification('Grade and feedback saved.', 'success');
    } catch (error) {
      showNotification(error?.message || 'Failed to save grade.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate(`/dashboard/homework-progress/${student.id}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Student
        </Button>
        {isSubmitted && submission?.homework_submission_id ? (
          <Button
            type="button"
            onClick={() => navigate(`/homework/submissions/${submission.homework_submission_id}`)}
          >
            Open Grading Interface
          </Button>
        ) : null}
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl tracking-tight">{toSubmissionLabel(submission)}</CardTitle>
          <CardDescription>
            Student: {student.name} ({student.level})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={toAssignmentStatusTone(submission?.status)}>
              {submission?.status || '--'}
            </Badge>
            <Badge variant="outline" className={toGradingStatusTone(submission?.gradingStatus)}>
              {submission?.gradingStatus || '--'}
            </Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border/70 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Submitted At</p>
              <div className="mt-2 inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{isSubmitted ? toDateLabel(submittedAt) : '--'}</span>
              </div>
            </div>
            <div className="rounded-lg border border-border/70 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Score</p>
              <div className="mt-2 inline-flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{score}</span>
              </div>
            </div>
          </div>

          <Card className="border-border/70 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Submission Content</CardTitle>
            </CardHeader>
            <CardContent>
              {isSubmitted ? (
                <div className="space-y-2 text-sm text-foreground/90">
                  <p className="inline-flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Detail view is available. Click "Open Grading Interface" to inspect full submission if linked.
                  </p>
                  {studentAnswer ? (
                    <p className="rounded-md border border-border/70 bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                      {studentAnswer}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  This item has no submission yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Answer Key</CardTitle>
              <CardDescription>Reference answer for grading.</CardDescription>
            </CardHeader>
            <CardContent>
              {answerKey ? (
                <div className="rounded-md border border-border/70 bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {answerKey}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No answer key available for this submission.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Grade And Feedback</CardTitle>
              <CardDescription>Set score and teacher comment for this submission.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="homework-progress-score">Score (0 - 10)</Label>
                <Input
                  id="homework-progress-score"
                  type="number"
                  min={0}
                  max={10}
                  step="0.1"
                  value={scoreDraft}
                  onChange={(event) => setScoreDraft(event.target.value)}
                  placeholder="e.g. 7.5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="homework-progress-feedback">Feedback</Label>
                <Textarea
                  id="homework-progress-feedback"
                  value={feedbackDraft}
                  onChange={(event) => setFeedbackDraft(event.target.value)}
                  rows={6}
                  placeholder="Write teacher feedback..."
                />
              </div>
              <div className="flex items-center justify-end">
                <Button type="button" onClick={handleSaveGrade} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Grade'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
