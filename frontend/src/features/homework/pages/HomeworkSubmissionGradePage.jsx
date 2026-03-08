import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import { clampScore, formatDate, statusLabel } from "./homework.utils";
import { getRenderableTaskBlocks } from "./myHomeworkStudentUtils";
import { toSanitizedInnerHtml } from "@/shared/utils/safeHtml";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";


const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;
const isHtmlLike = (value = "") => HTML_TAG_PATTERN.test(String(value || ""));
const normalizeBlockType = (value = "") => String(value || "").trim().toLowerCase();

const renderRichText = (value, className = "text-sm text-foreground/90") => {
  const raw = String(value || "");
  if (!raw.trim()) return null;
  if (!isHtmlLike(raw)) return <p className={className}>{raw}</p>;
  return <div className={className} dangerouslySetInnerHTML={toSanitizedInnerHtml(raw)} />;
};

const toNumericOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatScoreDisplay = (value) => {
  const numeric = toNumericOrNull(value);
  return numeric === null ? "--" : String(numeric);
};

const resolveQuizQuestions = (block = {}) => {
  const data = block?.data && typeof block.data === "object" && !Array.isArray(block.data) ? block.data : {};
  if (Array.isArray(data.questions) && data.questions.length > 0) {
    return data.questions;
  }
  const hasLegacyQuestion =
    String(data.question || data.text || "").trim() !== "" || (Array.isArray(data.options) && data.options.length > 0);
  if (!hasLegacyQuestion) return [];
  return [
    {
      question: String(data.question || data.text || ""),
      options: Array.isArray(data.options) ? data.options : [],
    },
  ];
};

const renderPromptBlock = (block, index = 0, { testTitle = "" } = {}) => {

  const blockType = normalizeBlockType(block?.type);
  const data = block?.data && typeof block.data === "object" && !Array.isArray(block.data) ? block.data : {};

  if (blockType === "title") {
    const text = String(data.text || "").trim();
    if (!text) return null;
    return <h4 className="text-base font-semibold text-foreground">{text}</h4>;
  }

  if (blockType === "instruction") {
    return renderRichText(data.text || "", "text-sm leading-7 text-foreground/90");
  }

  if (blockType === "video") {
    const url = String(data.url || "").trim();
    if (!url) return null;
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Video</p>
        <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary underline-offset-4 hover:underline">
          {url}
        </a>
      </div>
    );
  }

  if (blockType === "internal") {
    const resourceRefType = String(data.resource_ref_type || "").trim() || "--";
    const resourceRefId = String(data.resource_ref_id || "").trim() || "--";
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Internal Content</p>
        <p className="text-sm font-medium text-foreground/90">
          {testTitle ? testTitle : `${resourceRefType} - ${resourceRefId}`}
        </p>
      </div>
    );
  }


  if (blockType === "input") {
    const inputType = String(data.input_type || "").trim() || "text";
    const minWords = data.min_words ?? "";
    const maxWords = data.max_words ?? "";
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Student Input</p>
        <p className="text-sm text-foreground/90">
          Type: {inputType}
          {inputType === "text" ? ` | Words: ${minWords || 0} - ${maxWords || "inf"}` : ""}
        </p>
      </div>
    );
  }

  if (blockType === "passage") {
    const content = renderRichText(data.text || "", "text-sm leading-7 text-foreground/90");
    if (!content) return null;
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Passage</p>
        {content}
      </div>
    );
  }

  if (blockType === "quiz") {
    const questions = resolveQuizQuestions(block);
    if (!questions.length) return null;
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quiz</p>
        <div className="space-y-3">
          {questions.map((question, questionIndex) => (
            <div key={`quiz-${index}-${questionIndex}`} className="rounded-md border p-2">
              {renderRichText(question?.question || question?.text || "", "text-sm font-medium text-foreground")}
              {Array.isArray(question?.options) && question.options.length > 0 ? (
                <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-foreground/80">
                  {question.options.map((option, optionIndex) => (
                    <li key={`quiz-opt-${index}-${questionIndex}-${optionIndex}`}>{String(option?.text || option || "")}</li>
                  ))}
                </ol>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (blockType === "matching") {
    const leftItems = Array.isArray(data.left_items) ? data.left_items : [];
    const rightItems = Array.isArray(data.right_items) ? data.right_items : [];
    if (!leftItems.length && !rightItems.length) return null;
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Table Matching</p>
        {String(data.prompt || "").trim() ? <p className="text-sm text-foreground/80">{String(data.prompt || "")}</p> : null}
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            {leftItems.map((item, itemIndex) => (
              <div key={`left-${index}-${itemIndex}`} className="rounded border px-2 py-1 text-sm">
                {String(item?.text || "")}
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {rightItems.map((item, itemIndex) => (
              <div key={`right-${index}-${itemIndex}`} className="rounded border px-2 py-1 text-sm">
                {String(item?.text || "")}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (blockType === "gapfill" || blockType === "find_mistake") {
    const numberedItems = Array.isArray(data.numbered_items) ? data.numbered_items : [];
    const paragraphText = String(data.paragraph_text || "").trim();
    const prompt = String(data.prompt || "").trim();
    const hasContent = numberedItems.length > 0 || paragraphText;
    if (!hasContent && !prompt) return null;
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {blockType === "gapfill" ? "Gap Filling" : "Find Mistake"}
        </p>
        {prompt ? <p className="text-sm text-foreground/80">{prompt}</p> : null}
        {paragraphText ? <p className="text-sm text-foreground/90">{paragraphText}</p> : null}
        {numberedItems.length > 0 ? (
          <ol className="list-inside list-decimal space-y-1 text-sm text-foreground/90">
            {numberedItems.map((item, itemIndex) => (
              <li key={`${blockType}-${index}-${itemIndex}`}>{String(item || "")}</li>
            ))}
          </ol>
        ) : null}
      </div>
    );
  }

  if (blockType === "dictation") {
    const prompt = renderRichText(data.prompt || "", "text-sm text-foreground/90");
    const audioUrl = String(data.audio_url || "").trim();
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dictation</p>
        {prompt}
        {audioUrl ? <audio controls src={audioUrl} className="w-full" /> : null}
      </div>
    );
  }

  if (blockType === "answer") return null;
  return renderRichText(data.text || "", "text-sm leading-7 text-foreground/90");
};

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
  const [selectedImage, setSelectedImage] = useState(null);


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

  const task = useMemo(() => {
    if (submission?.task && typeof submission.task === "object") return submission.task;
    const tasks = Array.isArray(assignment?.tasks) ? assignment.tasks : [];
    const targetTaskId = String(submission?.task_id || "").trim();
    if (!targetTaskId) return null;
    return tasks.find((item) => String(item?._id || "").trim() === targetTaskId) || null;
  }, [submission?.task, assignment?.tasks, submission?.task_id]);

  const taskBlocks = useMemo(() => {
    if (!task) return [];
    return getRenderableTaskBlocks(task);
  }, [task]);

  const answerBlocks = useMemo(
    () => taskBlocks.filter((block) => normalizeBlockType(block?.type) === "answer"),
    [taskBlocks],
  );

  const promptBlocks = useMemo(
    () => taskBlocks.filter((block) => normalizeBlockType(block?.type) !== "answer"),
    [taskBlocks],
  );

  const canPlayAudio = useMemo(() => Boolean(submission?.audio_item?.url), [submission?.audio_item?.url]);
  const hasStudentSubmissionContent = Boolean(
    String(submission?.text_answer || "").trim() || (submission?.image_items || []).length || canPlayAudio,
  );

  const scoreSnapshot = toNumericOrNull(submission?.score_snapshot);
  const internalScore = toNumericOrNull(submission?.internal_score);
  const internalScoreSource = scoreSnapshot !== null ? "snapshot" : internalScore !== null ? "submission" : "none";
  const isInternalTask =
    String(task?.resource_mode || "").trim().toLowerCase() === "internal"
    || promptBlocks.some((block) => normalizeBlockType(block?.type) === "internal");

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
              {promptBlocks.length > 0 ? (
                <Card className="border-border/70 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Lesson Prompt</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {promptBlocks.map((block, index) => {
                      const rendered = renderPromptBlock(block, index, { testTitle: payload?.test_title });

                      if (!rendered) return null;
                      return (
                        <div key={`prompt-${String(block?.data?.block_id || index)}`} className="rounded-md border p-3">
                          {rendered}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ) : null}

              {answerBlocks.length > 0 ? (
                <Card className="border-border/70 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Answer</CardTitle>
                    <CardDescription>Teacher-only reference from lesson blocks.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {answerBlocks.map((block, index) => {
                      const content = renderRichText(block?.data?.text || "", "text-sm leading-7 text-foreground/90");
                      if (!content) return null;
                      return (
                        <div key={`answer-${String(block?.data?.block_id || index)}`} className="rounded-md border p-3">
                          {content}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ) : null}

              {isInternalTask ? (
                <Card className="border-border/70 shadow-none">
                  <CardHeader>
                    <CardTitle className="text-base">Internal Test Result</CardTitle>
                    <CardDescription>
                      {payload?.test_title || "Snapshot-first fallback: score_snapshot - score"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-foreground">
                      {payload?.ielts_band ? (
                        <>
                          IELTS Band: <span className="font-semibold text-primary">{payload.ielts_band}</span>
                          <span className="ml-2 text-xs text-muted-foreground">({formatScoreDisplay(internalScore)})</span>
                        </>
                      ) : (
                        <>
                          Score: <span className="font-semibold">{formatScoreDisplay(internalScore)}</span>
                        </>
                      )}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      Source: {internalScoreSource}
                      {String(submission?.submission_source || "").trim()
                        ? ` | Submission source: ${submission.submission_source}`
                        : ""}
                    </p>
                    {submission?.linked_test_attempt_id ? (
                      <p className="text-xs text-muted-foreground">
                        Linked attempt ID: {String(submission.linked_test_attempt_id)}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}

              <Card className="border-border/70 shadow-none">
                <CardHeader>
                  <CardTitle className="text-base">Student Submission</CardTitle>
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
                        <CardTitle className="text-base">Uploaded Attachments</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          {submission.image_items.map((item) => (
                            <div key={item?.storage_key || item?.url} className="overflow-hidden rounded-md border shadow-sm transition-shadow hover:shadow-md">
                              {String(item?.mime || "").toLowerCase().startsWith("video/") ? (
                                <video controls src={item?.url} className="aspect-video w-full object-cover" />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setSelectedImage(item?.url)}
                                  className="group relative block w-full focus:outline-none"
                                >
                                  <img
                                    src={item?.url}
                                    alt="Submission"
                                    className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                                    <span className="rounded-full bg-black/50 p-2 text-white">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
                                    </span>
                                  </div>
                                </button>
                              )}
                            </div>
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

                  {!hasStudentSubmissionContent ? (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Submission has no uploaded answer content.
                    </div>
                  ) : null}
                </CardContent>
              </Card>
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
      {selectedImage && <ImageLightbox url={selectedImage} onClose={() => setSelectedImage(null)} />}
    </div>

  );
}

const ImageLightbox = ({ url, onClose }) => {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 transition-all animate-in fade-in zoom-in duration-200"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-6 right-6 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
        aria-label="Close"
      >
        <X size={32} />
      </button>
      <img
        src={url}
        alt="Full width preview"
        className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

