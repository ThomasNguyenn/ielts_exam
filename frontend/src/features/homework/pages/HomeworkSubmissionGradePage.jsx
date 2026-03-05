import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import { clampScore, formatDate, statusLabel } from "./homework.utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function HomeworkSubmissionGradePage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadSubmission = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.homeworkGetSubmissionById(submissionId);
      const data = response?.data || null;
      setPayload(data);
      setScore(data?.score ?? "");
      setFeedback(data?.teacher_feedback || "");
    } catch (loadError) {
      setError(loadError?.message || "Failed to load submission");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSubmission();
  }, [submissionId]);

  const handleSave = async () => {
    const normalizedScore = clampScore(score);
    if (normalizedScore === "") {
      showNotification("Score must be between 0 and 10", "error");
      return;
    }

    setSaving(true);
    try {
      await api.homeworkGradeSubmission(submissionId, {
        score: normalizedScore,
        teacher_feedback: feedback,
      });
      showNotification("Grade saved", "success");
      void loadSubmission();
    } catch (saveError) {
      showNotification(saveError?.message || "Failed to save grade", "error");
    } finally {
      setSaving(false);
    }
  };

  const submission = payload || {};
  const assignment = submission.assignment || {};
  const student = submission.student || {};

  const canPlayAudio = useMemo(() => Boolean(submission?.audio_item?.url), [submission?.audio_item?.url]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-70px)] bg-muted/30">
        <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
          <Card className="border-border/70 shadow-sm">
            <CardContent className="p-6 text-sm text-muted-foreground">Loading submission...</CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[calc(100vh-70px)] bg-muted/30">
        <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
          <Card className="border-border/70 shadow-sm">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm font-medium text-destructive">{error}</p>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-70px)] bg-muted/30">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-2xl tracking-tight">Grade Submission</CardTitle>
              <CardDescription>
                {assignment?.title || "Assignment"} - Student: {student?.name || "Unknown"}
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{statusLabel(submission?.status)}</Badge>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/homework/assignments/${assignment?._id}/dashboard`)}
              >
                Dashboard
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Back
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-6 xl:grid-cols-12">
          <Card className="border-border/70 shadow-sm xl:col-span-8">
            <CardHeader>
              <CardTitle>Submission Content</CardTitle>
              <CardDescription>
                Submitted at {formatDate(submission?.submitted_at)} - Updated {formatDate(submission?.updatedAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {submission?.text_answer ? (
                <Card className="border-border/70 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Text Answer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm text-foreground/90">{submission.text_answer}</p>
                  </CardContent>
                </Card>
              ) : null}

              {Array.isArray(submission?.image_items) && submission.image_items.length > 0 ? (
                <Card className="border-border/70 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Image Attachments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {submission.image_items.map((item) => (
                        <a
                          href={item?.url}
                          target="_blank"
                          rel="noreferrer"
                          key={item?.storage_key || item?.url}
                          className="overflow-hidden rounded-md border"
                        >
                          <img src={item?.url} alt="Submission" className="aspect-[4/3] w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {canPlayAudio ? (
                <Card className="border-border/70 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Audio Attachment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <audio controls src={submission.audio_item.url} className="w-full" />
                    <p className="text-xs text-muted-foreground">Type: {submission.audio_item?.mime || "audio"}</p>
                  </CardContent>
                </Card>
              ) : null}

              {!submission?.text_answer && !(submission?.image_items || []).length && !canPlayAudio ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Submission has no content.
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm xl:col-span-4">
            <CardHeader>
              <CardTitle>Grade</CardTitle>
              <CardDescription>Save score and actionable teacher feedback.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="submission-score">Score (0-10)</Label>
                <Input
                  id="submission-score"
                  type="number"
                  step="0.1"
                  min={0}
                  max={10}
                  value={score}
                  onChange={(event) => setScore(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="submission-feedback">Feedback</Label>
                <Textarea
                  id="submission-feedback"
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  placeholder="Write actionable feedback for student..."
                  rows={8}
                />
              </div>

              <Button type="button" onClick={handleSave} disabled={saving} className="w-full">
                {saving ? "Saving..." : "Save Grade"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
