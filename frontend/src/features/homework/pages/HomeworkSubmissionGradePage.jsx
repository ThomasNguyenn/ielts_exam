import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import { clampScore, formatDate, statusLabel } from "./homework.utils";
import { getRenderableTaskBlocks, normalizeTaskBlockType } from "./myHomeworkStudentUtils";
import HomeworkAiReviewCard from "./HomeworkAiReviewCard";
import { buildAiReviewPayload, normalizeAiReviewOutput } from "./homeworkAiReview.utils";
import {
  GAPFILL_MODE_PARAGRAPH,
  normalizeFindMistakeBlockData,
  normalizeGapfillBlockData,
  parseGapfillTemplate,
} from "./gapfill.utils";
import { toSanitizedInnerHtml } from "@/shared/utils/safeHtml";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronsUpDown, RotateCw, X } from "lucide-react";


const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;
const isHtmlLike = (value = "") => HTML_TAG_PATTERN.test(String(value || ""));
const normalizeBlockType = (value = "") => normalizeTaskBlockType(value);

const resolveTaskBlockId = (block = {}) =>
  String(block?.data?.block_id || block?.id || block?.clientId || block?._id || "").trim();

const resolveFirstNonEmptyString = (...values) => {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
};

const toPlainObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const parseJsonObjectSafely = (value) => {
  if (value === undefined || value === null) return {};
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return {};
    try {
      return toPlainObject(JSON.parse(normalized));
    } catch {
      return {};
    }
  }
  return toPlainObject(value);
};

const normalizeObjectiveAnswerEntries = (entries = [], keyField, valueField) => {
  const entryMap = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const key = String(entry?.[keyField] || "").trim();
    const value = String(entry?.[valueField] || "").trim();
    if (!key || !value) return;
    entryMap.set(key, { [keyField]: key, [valueField]: value });
  });
  return Array.from(entryMap.values());
};

const normalizeMatchingObjectiveAnswerEntries = (entries = []) => {
  const blockMap = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const blockKey = String(
      entry?.block_key || entry?.blockKey || entry?.block_id || entry?.blockId || entry?.key || "",
    ).trim();
    if (!blockKey) return;

    const rawPairs = Array.isArray(entry?.matches)
      ? entry.matches
      : Array.isArray(entry?.pairs)
        ? entry.pairs
        : [];
    const candidatePairs = rawPairs.length ? rawPairs : [entry];
    const pairMap = new Map();
    candidatePairs.forEach((pair) => {
      const leftId = String(pair?.left_id || pair?.leftId || pair?.from || "").trim();
      const rightId = String(pair?.right_id || pair?.rightId || pair?.to || "").trim();
      if (!leftId || !rightId) return;
      pairMap.set(`${leftId}:${rightId}`, {
        left_id: leftId,
        right_id: rightId,
      });
    });

    if (pairMap.size === 0) return;
    blockMap.set(blockKey, {
      block_key: blockKey,
      matches: Array.from(pairMap.values()),
    });
  });
  return Array.from(blockMap.values());
};

const normalizeObjectiveAnswersFromMeta = (meta = {}) => {
  const normalizedMeta = toPlainObject(meta);
  const objectiveAnswers = parseJsonObjectSafely(normalizedMeta.objective_answers);
  const rawQuiz = Array.isArray(objectiveAnswers.quiz)
    ? objectiveAnswers.quiz
    : Array.isArray(normalizedMeta.quiz_answers)
      ? normalizedMeta.quiz_answers
      : [];
  const rawGapfill = Array.isArray(objectiveAnswers.gapfill) ? objectiveAnswers.gapfill : [];
  const rawFindMistake = Array.isArray(objectiveAnswers.find_mistake) ? objectiveAnswers.find_mistake : [];
  const rawMatching = Array.isArray(objectiveAnswers.matching)
    ? objectiveAnswers.matching
    : Array.isArray(normalizedMeta.matching_answers)
      ? normalizedMeta.matching_answers
      : [];

  return {
    quiz: normalizeObjectiveAnswerEntries(
      rawQuiz.map((entry) => ({
        question_key: String(entry?.question_key || entry?.questionKey || entry?.key || "").trim(),
        selected_option_id: String(
          entry?.selected_option_id || entry?.selectedOptionId || entry?.option_id || entry?.value || "",
        ).trim(),
      })),
      "question_key",
      "selected_option_id",
    ),
    gapfill: normalizeObjectiveAnswerEntries(
      rawGapfill.map((entry) => ({
        blank_key: String(entry?.blank_key || entry?.blankKey || entry?.key || "").trim(),
        value: String(entry?.value || entry?.answer || entry?.text || "").trim(),
      })),
      "blank_key",
      "value",
    ),
    find_mistake: normalizeObjectiveAnswerEntries(
      rawFindMistake.map((entry) => ({
        line_key: String(entry?.line_key || entry?.lineKey || entry?.key || "").trim(),
        token_key: String(entry?.token_key || entry?.tokenKey || entry?.value || "").trim(),
      })),
      "line_key",
      "token_key",
    ),
    matching: normalizeMatchingObjectiveAnswerEntries(rawMatching),
  };
};

const toSelectionMap = (entries = [], keyField, valueField) =>
  (Array.isArray(entries) ? entries : []).reduce((acc, entry) => {
    const key = String(entry?.[keyField] || "").trim();
    const value = String(entry?.[valueField] || "").trim();
    if (!key || !value) return acc;
    acc[key] = value;
    return acc;
  }, {});

const toMatchingSelectionMap = (entries = []) =>
  (Array.isArray(entries) ? entries : []).reduce((acc, entry) => {
    const blockKey = String(entry?.block_key || "").trim();
    const matches = Array.isArray(entry?.matches) ? entry.matches : [];
    if (!blockKey || matches.length === 0) return acc;
    acc[blockKey] = matches;
    return acc;
  }, {});

const normalizeQuizOption = (option = {}, fallbackIndex = 0) => ({
  id: String(option?.id || "").trim() || `option-${fallbackIndex + 1}`,
  text: resolveFirstNonEmptyString(option?.text, option?.label, option),
});

const normalizeQuizQuestion = (question = {}, fallbackIndex = 0) => {
  const normalizedQuestion =
    question && typeof question === "object" && !Array.isArray(question) ? question : {};
  const options = (Array.isArray(normalizedQuestion.options) ? normalizedQuestion.options : [])
    .map((option, optionIndex) => normalizeQuizOption(option, optionIndex))
    .filter((option) => option.id);
  return {
    id: String(normalizedQuestion.id || "").trim() || `question-${fallbackIndex + 1}`,
    question: resolveFirstNonEmptyString(
      normalizedQuestion.question,
      normalizedQuestion.text,
      normalizedQuestion.question_html,
      normalizedQuestion.prompt,
    ),
    options,
  };
};

const buildQuizQuestionKey = ({ blockId, questionId, questionIndex = 0 }) => {
  const normalizedBlockId = String(blockId || "quiz").trim() || "quiz";
  const normalizedQuestionId = String(questionId || "").trim() || `question-${questionIndex + 1}`;
  return `${normalizedBlockId}:${normalizedQuestionId}`;
};

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
    return data.questions
      .map((question, questionIndex) => normalizeQuizQuestion(question, questionIndex))
      .filter((question) => question.question || question.options.length > 0);
  }
  const hasLegacyQuestion =
    String(data.question || data.text || "").trim() !== "" || (Array.isArray(data.options) && data.options.length > 0);
  if (!hasLegacyQuestion) return [];
  return [
    normalizeQuizQuestion(
      {
        id: String(data.id || "").trim() || "legacy-question",
        question: resolveFirstNonEmptyString(data.question, data.text, data.question_html, data.prompt),
        options: Array.isArray(data.options) ? data.options : [],
      },
      0,
    ),
  ];
};

const resolveFindMistakeTokenLabel = ({ parsedTemplate, tokenKey }) => {
  const normalizedToken = String(tokenKey || "").trim();
  if (!normalizedToken) return "";
  const [partRaw, optionRaw] = normalizedToken.split(":");
  const partIndex = Number(partRaw);
  if (!Number.isFinite(partIndex)) return normalizedToken;
  const part = Array.isArray(parsedTemplate?.parts) ? parsedTemplate.parts[partIndex] : null;
  if (!part || part.kind !== "blank") return normalizedToken;
  if (optionRaw !== undefined) {
    const optionIndex = Number(optionRaw);
    if (!Number.isFinite(optionIndex)) return normalizedToken;
    const option = Array.isArray(part.options) ? part.options[optionIndex] : "";
    return String(option || normalizedToken);
  }
  return String(part.correctAnswer || part.raw || normalizedToken);
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
  const [isLessonPromptOpen, setIsLessonPromptOpen] = useState(false);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [aiReviewError, setAiReviewError] = useState("");
  const [aiReviewResult, setAiReviewResult] = useState(null);


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

  useEffect(() => {
    setIsLessonPromptOpen(false);
  }, [submissionId]);

  useEffect(() => {
    setAiReviewLoading(false);
    setAiReviewError("");
    setAiReviewResult(null);
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

  const objectiveAnswers = useMemo(
    () => normalizeObjectiveAnswersFromMeta(submission?.meta),
    [submission?.meta],
  );

  const objectiveAnswerMaps = useMemo(
    () => ({
      quizByQuestionKey: toSelectionMap(objectiveAnswers?.quiz, "question_key", "selected_option_id"),
      gapfillByBlankKey: toSelectionMap(objectiveAnswers?.gapfill, "blank_key", "value"),
      findMistakeByLineKey: toSelectionMap(objectiveAnswers?.find_mistake, "line_key", "token_key"),
      matchingByBlockKey: toMatchingSelectionMap(objectiveAnswers?.matching),
    }),
    [objectiveAnswers],
  );

  const objectiveBlocks = useMemo(
    () =>
      promptBlocks.filter((block) => {
        const blockType = normalizeBlockType(block?.type);
        return blockType === "quiz" || blockType === "gapfill" || blockType === "find_mistake" || blockType === "matching";
      }),
    [promptBlocks],
  );

  const hasObjectiveSubmissionContent = Boolean(
    (objectiveAnswers?.quiz || []).length
    || (objectiveAnswers?.gapfill || []).length
    || (objectiveAnswers?.find_mistake || []).length
    || (objectiveAnswers?.matching || []).length
  );

  const canPlayAudio = useMemo(() => Boolean(submission?.audio_item?.url), [submission?.audio_item?.url]);
  const hasStudentSubmissionContent = Boolean(
    String(submission?.text_answer || "").trim()
    || (submission?.image_items || []).length
    || canPlayAudio
    || hasObjectiveSubmissionContent,
  );

  const scoreSnapshot = toNumericOrNull(submission?.score_snapshot);
  const internalScore = toNumericOrNull(submission?.internal_score);
  const internalScoreSource = scoreSnapshot !== null ? "snapshot" : internalScore !== null ? "submission" : "none";
  const internalItems = Array.isArray(payload?.internal_items) ? payload.internal_items : [];
  const completedInternalCount = internalItems.filter((item) => String(item?.status || "").trim() === "completed").length;
  const hasInternalItems = internalItems.length > 0;
  const isInternalTask =
    String(task?.resource_mode || "").trim().toLowerCase() === "internal"
    || promptBlocks.some((block) => normalizeBlockType(block?.type) === "internal");

  const aiReviewBuild = useMemo(
    () => buildAiReviewPayload({
      assignment,
      payload,
      promptBlocks,
      answerBlocks,
      submission,
      objectiveBlocks,
      objectiveAnswerMaps,
    }),
    [assignment, payload, promptBlocks, answerBlocks, submission, objectiveBlocks, objectiveAnswerMaps],
  );

  const aiReviewResultText = useMemo(
    () => normalizeAiReviewOutput(aiReviewResult),
    [aiReviewResult],
  );

  const handleGenerateAiReview = async () => {
    if (!aiReviewBuild?.canSubmit) {
      const reason = aiReviewBuild?.disabledReason || "No eligible data for AI review.";
      setAiReviewError(reason);
      showNotification(reason, "error");
      return;
    }

    setAiReviewLoading(true);
    setAiReviewError("");
    try {
      const response = await api.homeworkGenerateSubmissionAiReview(submissionId);
      const data = response?.data ?? response;
      setAiReviewResult(data);
      showNotification("AI review generated", "success");
    } catch (reviewError) {
      const message = reviewError?.message || "Failed to generate AI review";
      setAiReviewError(message);
      showNotification(message, "error");
    } finally {
      setAiReviewLoading(false);
    }
  };

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
                  <Collapsible open={isLessonPromptOpen} onOpenChange={setIsLessonPromptOpen}>
                    <CardHeader className="flex flex-row items-start justify-between gap-3">
                      <CardTitle className="text-base">Lesson Prompt</CardTitle>
                      <CollapsibleTrigger asChild>
                        <Button type="button" variant="outline" size="sm" className="shrink-0">
                          {isLessonPromptOpen ? "Collapse" : "Expand"}
                          <ChevronsUpDown className="ml-2 h-4 w-4" />
                        </Button>
                      </CollapsibleTrigger>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="space-y-3 pt-0">
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
                    </CollapsibleContent>
                  </Collapsible>
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
                      {hasInternalItems
                        ? `${completedInternalCount}/${internalItems.length} internal slot completed`
                        : (payload?.test_title || "Snapshot-first fallback: score_snapshot - score")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {hasInternalItems ? (
                      <div className="space-y-2">
                        {internalItems.map((item, index) => {
                          const itemScore = toNumericOrNull(item?.score_snapshot);
                          const itemBand = String(item?.ielts_band || "").trim();
                          const itemStatus = String(item?.status || "").trim() || "not_started";
                          return (
                            <div key={`internal-item-${String(item?.slot_key || index)}`} className="rounded-md border p-3">
                              <p className="text-sm font-medium text-foreground">
                                {String(item?.test_title || "").trim()
                                  || `${String(item?.resource_ref_type || "content")} - ${String(item?.resource_ref_id || "--")}`}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Slot: {String(item?.slot_key || "--")} | Status: {itemStatus}
                              </p>
                              {item?.completed_at ? (
                                <p className="text-xs text-muted-foreground">Completed at: {formatDate(item.completed_at)}</p>
                              ) : null}
                              <p className="text-sm text-foreground">
                                {itemBand ? (
                                  <>
                                    IELTS Band: <span className="font-semibold text-primary">{itemBand}</span>
                                    <span className="ml-2 text-xs text-muted-foreground">({formatScoreDisplay(itemScore)})</span>
                                  </>
                                ) : (
                                  <>
                                    Score: <span className="font-semibold">{formatScoreDisplay(itemScore)}</span>
                                  </>
                                )}
                              </p>
                              {item?.linked_test_attempt_id ? (
                                <p className="text-xs text-muted-foreground">
                                  Linked attempt ID: {String(item.linked_test_attempt_id)}
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
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
                    )}

                    <p className="text-xs text-muted-foreground">
                      Source: {internalScoreSource}
                      {String(submission?.submission_source || "").trim()
                        ? ` | Submission source: ${submission.submission_source}`
                        : ""}
                    </p>
                    {!hasInternalItems && submission?.linked_test_attempt_id ? (
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

                  {hasObjectiveSubmissionContent ? (
                    <Card className="border-border/70 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-base">Objective Answers</CardTitle>
                        <CardDescription>Student selections from Quiz, Gap Filling, Find Mistake, and Table Matching blocks.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {objectiveBlocks.length > 0 ? (
                          objectiveBlocks.map((block, blockIndex) => {
                            const blockType = normalizeBlockType(block?.type);
                            const blockId = resolveTaskBlockId(block);

                            if (blockType === "quiz") {
                              const questions = resolveQuizQuestions(block);
                              if (!questions.length) return null;
                              return (
                                <div key={`obj-quiz-${blockId || blockIndex}`} className="rounded-md border p-3">
                                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Quiz</p>
                                  <div className="mt-2 space-y-2">
                                    {questions.map((question, questionIndex) => {
                                      const questionKey = buildQuizQuestionKey({
                                        blockId: blockId || "quiz",
                                        questionId: question?.id,
                                        questionIndex,
                                      });
                                      const selectedOptionId = String(
                                        objectiveAnswerMaps.quizByQuestionKey?.[questionKey] || "",
                                      ).trim();
                                      const selectedOption = (Array.isArray(question?.options) ? question.options : []).find(
                                        (option) => String(option?.id || "").trim() === selectedOptionId,
                                      );
                                      const selectedText = selectedOption?.text || selectedOptionId || "--";
                                      return (
                                        <div key={`obj-quiz-q-${questionKey}`} className="rounded border p-2">
                                          <p className="text-sm font-medium text-foreground/90">
                                            Question {questionIndex + 1}: {question?.question || "--"}
                                          </p>
                                          <p className="mt-1 text-sm text-foreground/80">
                                            Student selected: <span className="font-medium">{selectedText}</span>
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }

                            if (blockType === "gapfill") {
                              const gapfillData = normalizeGapfillBlockData(block?.data || {});
                              const templates =
                                gapfillData.mode === GAPFILL_MODE_PARAGRAPH
                                  ? [String(gapfillData?.paragraph_text || "")]
                                  : Array.isArray(gapfillData?.numbered_items)
                                    ? gapfillData.numbered_items
                                    : [];
                              if (!templates.length) return null;
                              const normalizedBlockId = blockId || `gapfill-${blockIndex + 1}`;

                              return (
                                <div key={`obj-gapfill-${normalizedBlockId}`} className="rounded-md border p-3">
                                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Gap Filling</p>
                                  <div className="mt-2 space-y-2">
                                    {templates.map((template, templateIndex) => {
                                      const parsedTemplate = parseGapfillTemplate(template);
                                      const blanks = (Array.isArray(parsedTemplate?.parts) ? parsedTemplate.parts : []).filter(
                                        (part) => part.kind === "blank",
                                      );
                                      if (!blanks.length) return null;
                                      const lineKey = `${normalizedBlockId}-${templateIndex}`;
                                      return (
                                        <div key={`obj-gapfill-line-${lineKey}`} className="rounded border p-2">
                                          <p className="text-sm font-medium text-foreground/90">
                                            {gapfillData.mode === GAPFILL_MODE_PARAGRAPH ? "Paragraph" : `Sentence ${templateIndex + 1}`}
                                          </p>
                                          <div className="mt-1 space-y-1">
                                            {blanks.map((blankPart, blankIndex) => {
                                              const resolvedBlankIndex = Number.isFinite(Number(blankPart?.blankIndex))
                                                ? Number(blankPart.blankIndex)
                                                : blankIndex;
                                              const blankKey = `${lineKey}:${resolvedBlankIndex}`;
                                              const answerValue = String(
                                                objectiveAnswerMaps.gapfillByBlankKey?.[blankKey] || "",
                                              ).trim();
                                              return (
                                                <p key={`obj-gapfill-blank-${blankKey}`} className="text-sm text-foreground/80">
                                                  Blank {resolvedBlankIndex + 1}: <span className="font-medium">{answerValue || "--"}</span>
                                                </p>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }

                            if (blockType === "matching") {
                              const blockData =
                                block?.data && typeof block.data === "object" && !Array.isArray(block.data)
                                  ? block.data
                                  : {};
                              const leftItems = (Array.isArray(blockData.left_items) ? blockData.left_items : [])
                                .map((item, itemIndex) => ({
                                  id: String(item?.id || "").trim() || `left-${itemIndex + 1}`,
                                  text: String(item?.text || "").trim() || `Left item ${itemIndex + 1}`,
                                }));
                              const rightItems = (Array.isArray(blockData.right_items) ? blockData.right_items : [])
                                .map((item, itemIndex) => ({
                                  id: String(item?.id || "").trim() || `right-${itemIndex + 1}`,
                                  text: String(item?.text || "").trim() || `Right item ${itemIndex + 1}`,
                                }));
                              const normalizedBlockId = blockId || `matching-${blockIndex + 1}`;
                              const directMatches = objectiveAnswerMaps.matchingByBlockKey?.[normalizedBlockId];
                              const fallbackSingleBlockMatch =
                                !directMatches
                                && objectiveBlocks.filter((candidate) => normalizeBlockType(candidate?.type) === "matching").length === 1
                                && (objectiveAnswers?.matching || []).length === 1
                                  ? (objectiveAnswers?.matching || [])[0]?.matches
                                  : [];
                              const selectedMatches = Array.isArray(directMatches)
                                ? directMatches
                                : Array.isArray(fallbackSingleBlockMatch)
                                  ? fallbackSingleBlockMatch
                                  : [];

                              const leftItemMap = new Map(leftItems.map((item) => [String(item.id), item.text]));
                              const rightItemMap = new Map(rightItems.map((item) => [String(item.id), item.text]));

                              return (
                                <div key={`obj-matching-${normalizedBlockId}`} className="rounded-md border p-3">
                                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Table Matching</p>
                                  {String(blockData?.prompt || "").trim() ? (
                                    <p className="mt-1 text-sm text-foreground/80">{String(blockData.prompt || "").trim()}</p>
                                  ) : null}
                                  {selectedMatches.length > 0 ? (
                                    <div className="mt-2 space-y-2">
                                      {selectedMatches.map((pair, pairIndex) => {
                                        const leftId = String(pair?.left_id || "").trim();
                                        const rightId = String(pair?.right_id || "").trim();
                                        const leftText = leftItemMap.get(leftId) || leftId || "--";
                                        const rightText = rightItemMap.get(rightId) || rightId || "--";
                                        return (
                                          <div key={`obj-matching-pair-${normalizedBlockId}-${pairIndex}`} className="rounded border p-2">
                                            <p className="text-sm text-foreground/80">
                                              Pair {pairIndex + 1}: <span className="font-medium">{leftText}</span>{" -> "}
                                              <span className="font-medium">{rightText}</span>
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="mt-2 text-sm text-muted-foreground">Student chua chon cap matching.</p>
                                  )}
                                </div>
                              );
                            }

                            if (blockType === "find_mistake") {
                              const findMistakeData = normalizeFindMistakeBlockData(block?.data || {});
                              const numberedItems = Array.isArray(findMistakeData?.numbered_items)
                                ? findMistakeData.numbered_items
                                : [];
                              if (!numberedItems.length) return null;
                              const normalizedBlockId = blockId || `find-mistake-${blockIndex + 1}`;

                              return (
                                <div key={`obj-find-mistake-${normalizedBlockId}`} className="rounded-md border p-3">
                                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Find Mistake</p>
                                  <div className="mt-2 space-y-2">
                                    {numberedItems.map((template, templateIndex) => {
                                      const lineKey = `${normalizedBlockId}-find-${templateIndex}`;
                                      const tokenKey = String(
                                        objectiveAnswerMaps.findMistakeByLineKey?.[lineKey] || "",
                                      ).trim();
                                      const parsedTemplate = parseGapfillTemplate(template);
                                      const tokenLabel = resolveFindMistakeTokenLabel({
                                        parsedTemplate,
                                        tokenKey,
                                      }) || tokenKey;
                                      return (
                                        <div key={`obj-find-mistake-line-${lineKey}`} className="rounded border p-2">
                                          <p className="text-sm text-foreground/80">
                                            Line {templateIndex + 1}: <span className="font-medium">{tokenLabel || "--"}</span>
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            }

                            return null;
                          })
                        ) : (
                          <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">
                            Objective answers found, but no matching objective blocks in this task view.
                          </div>
                        )}
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

          <div className="space-y-6 xl:col-span-4">
            <Card className="border-border/70 shadow-sm">
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

            <HomeworkAiReviewCard
              loading={aiReviewLoading}
              canSubmit={aiReviewBuild.canSubmit}
              disabledReason={aiReviewBuild.disabledReason}
              onGenerate={handleGenerateAiReview}
              resultText={aiReviewResultText}
              error={aiReviewError}
              hasResult={Boolean(aiReviewResultText)}
            />
          </div>
        </div>
      </div>
      {selectedImage && <ImageLightbox url={selectedImage} onClose={() => setSelectedImage(null)} />}
    </div>

  );
}

const ImageLightbox = ({ url, onClose }) => {
  const [rotationDeg, setRotationDeg] = useState(0);

  useEffect(() => {
    setRotationDeg(0);
  }, [url]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
      if (String(e.key || "").toLowerCase() === "r") {
        setRotationDeg((prev) => (prev + 90) % 360);
      }
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
      <div className="absolute top-6 right-6 flex items-center gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setRotationDeg((prev) => (prev + 90) % 360);
          }}
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
          aria-label="Rotate image"
          title="Rotate 90°"
        >
          <RotateCw size={18} />
          <span className="hidden sm:inline">Rotate</span>
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
          aria-label="Close"
        >
          <X size={32} />
        </button>
      </div>
      <img
        src={url}
        alt="Full width preview"
        className="max-h-full max-w-full rounded-lg object-contain shadow-2xl transition-transform duration-200"
        style={{ transform: `rotate(${rotationDeg}deg)` }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

