import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import LiteYouTubeEmbed from "react-lite-youtube-embed";
import "react-lite-youtube-embed/dist/LiteYouTubeEmbed.css";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import { formatDate, resolveVideoPreview, statusLabel } from "./homework.utils";
import {
  createDraft,
  getRenderableTaskBlocks,
  getTaskBlockKey,
  resolveTaskInputType,
} from "./myHomeworkStudentUtils";
import {
  GAPFILL_MODE_NUMBERED,
  GAPFILL_MODE_PARAGRAPH,
  normalizeFindMistakeBlockData,
  normalizeGapfillBlockData,
  parseGapfillTemplate,
} from "./gapfill.utils";
import { useHomeworkAssignmentDetail } from "./useHomeworkAssignmentDetail";
import "./Homework.css";

const renderVideoBlock = ({ taskTitle, taskIndex, url }) => {
  const preview = resolveVideoPreview(url || "");
  if (preview.kind === "youtube" && preview.youtubeId) {
    return (
      <div className="overflow-hidden rounded-md border homework-video-lite">
        <LiteYouTubeEmbed
          id={preview.youtubeId}
          title={taskTitle || `Task ${taskIndex + 1} video`}
          noCookie
          adNetwork={false}
          poster="maxresdefault"
          params="cc_load_policy=0&iv_load_policy=3&modestbranding=1&rel=0"
          webp
        />
      </div>
    );
  }
  if (preview.kind === "vimeo") {
    return (
      <div className="overflow-hidden rounded-md border">
        <iframe
          src={preview.src}
          title={taskTitle || `Task ${taskIndex + 1} video`}
          className="aspect-video w-full"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  if (preview.kind === "direct") {
    return (
      <div className="overflow-hidden rounded-md border">
        <video controls className="aspect-video w-full" src={preview.src} />
      </div>
    );
  }
  return (
    <p className="homework-item-meta">
      Resource:{" "}
      <a href={url} target="_blank" rel="noreferrer">
        Open link
      </a>
    </p>
  );
};

const resolveTaskBlockId = (block = {}) =>
  String(block?.data?.block_id || block?.id || block?.clientId || block?._id || "").trim();

const resolveQuizParentPassageBlockId = (block = {}) =>
  String(block?.data?.parent_passage_block_id || "").trim();

const MATCH_COLOR_TOKENS = ["emerald", "sky", "amber", "fuchsia", "teal", "rose", "indigo", "lime"];

const MATCH_COLOR_CLASSES = {
  emerald: "border-emerald-500 bg-emerald-50 text-emerald-700",
  sky: "border-sky-500 bg-sky-50 text-sky-700",
  amber: "border-amber-500 bg-amber-50 text-amber-700",
  fuchsia: "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700",
  teal: "border-teal-500 bg-teal-50 text-teal-700",
  rose: "border-rose-500 bg-rose-50 text-rose-700",
  indigo: "border-indigo-500 bg-indigo-50 text-indigo-700",
  lime: "border-lime-500 bg-lime-50 text-lime-700",
};

const resolveMatchColorToken = (value, fallbackIndex = 0) => {
  const normalized = String(value || "").trim();
  if (MATCH_COLOR_TOKENS.includes(normalized)) return normalized;
  return MATCH_COLOR_TOKENS[fallbackIndex % MATCH_COLOR_TOKENS.length];
};

const resolveMatchColorClass = (value, fallbackIndex = 0) =>
  MATCH_COLOR_CLASSES[resolveMatchColorToken(value, fallbackIndex)] || MATCH_COLOR_CLASSES.emerald;

const normalizeQuizOption = (option = {}, fallbackIndex = 0) => ({
  id: String(option?.id || "").trim() || `option-${fallbackIndex + 1}`,
  text: String(option?.text || "").trim(),
});

const normalizeQuizQuestion = (question = {}, fallbackIndex = 0) => {
  const normalizedQuestion =
    question && typeof question === "object" && !Array.isArray(question) ? question : {};
  const options = (Array.isArray(normalizedQuestion.options) ? normalizedQuestion.options : [])
    .map((option, optionIndex) => normalizeQuizOption(option, optionIndex))
    .filter((option) => option.id);
  return {
    id: String(normalizedQuestion.id || "").trim() || `question-${fallbackIndex + 1}`,
    question: String(normalizedQuestion.question || normalizedQuestion.text || "").trim(),
    options,
  };
};

const resolveQuizQuestions = (block = {}) => {
  const quizData =
    block?.data && typeof block.data === "object" && !Array.isArray(block.data) ? block.data : {};
  if (Array.isArray(quizData.questions) && quizData.questions.length > 0) {
    return quizData.questions
      .map((question, questionIndex) => normalizeQuizQuestion(question, questionIndex))
      .filter((question) => question.question || question.options.length > 0);
  }

  const hasLegacyQuestion =
    String(quizData.question || quizData.text || "").trim() !== ""
    || (Array.isArray(quizData.options) && quizData.options.length > 0);
  if (!hasLegacyQuestion) return [];

  return [
    normalizeQuizQuestion(
      {
        id: String(quizData.id || "").trim() || "legacy-question",
        question: quizData.question || quizData.text || "",
        options: Array.isArray(quizData.options) ? quizData.options : [],
      },
      0,
    ),
  ].filter((question) => question.question || question.options.length > 0);
};

const normalizeMatchingItem = (item = {}, fallbackIndex = 0, side = "left") => ({
  id: String(item?.id || "").trim() || `${side}-${fallbackIndex + 1}`,
  text: String(item?.text || "").trim(),
});

const resolveMatchingData = (block = {}) => {
  const matchingData =
    block?.data && typeof block.data === "object" && !Array.isArray(block.data) ? block.data : {};
  const normalizedLeftItems = (Array.isArray(matchingData.left_items) ? matchingData.left_items : [])
    .map((item, itemIndex) => normalizeMatchingItem(item, itemIndex, "left"))
    .filter((item) => item.id);
  const normalizedRightItems = (Array.isArray(matchingData.right_items) ? matchingData.right_items : [])
    .map((item, itemIndex) => normalizeMatchingItem(item, itemIndex, "right"))
    .filter((item) => item.id);
  const normalizedRowCount = Math.max(normalizedLeftItems.length, normalizedRightItems.length);
  const leftItems = Array.from({ length: normalizedRowCount }, (_, itemIndex) =>
    normalizeMatchingItem(normalizedLeftItems[itemIndex] || {}, itemIndex, "left"),
  );
  const rightItems = Array.from({ length: normalizedRowCount }, (_, itemIndex) =>
    normalizeMatchingItem(normalizedRightItems[itemIndex] || {}, itemIndex, "right"),
  );

  const leftIdSet = new Set(leftItems.map((item) => item.id));
  const rightIdSet = new Set(rightItems.map((item) => item.id));
  const pairs = (Array.isArray(matchingData.matches) ? matchingData.matches : [])
    .map((pair, pairIndex) => ({
      left_id: String(pair?.left_id || "").trim(),
      right_id: String(pair?.right_id || "").trim(),
      color_key: resolveMatchColorToken(pair?.color_key, pairIndex),
      __pairIndex: pairIndex,
    }))
    .filter((pair) => leftIdSet.has(pair.left_id) && rightIdSet.has(pair.right_id));

  return {
    prompt: String(matchingData.prompt || "").trim(),
    leftItems,
    rightItems,
    pairs,
  };
};

const renderQuizContent = ({ block, titlePrefix = "Quiz" }) => {
  const questions = resolveQuizQuestions(block);
  if (!questions.length) return null;

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="homework-item-title">{titlePrefix}</p>
      <div className="space-y-3">
        {questions.map((questionItem, questionIndex) => (
          <div key={questionItem.id || `${resolveTaskBlockId(block)}-question-${questionIndex}`} className="space-y-2">
            {questions.length > 1 ? (
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Question {questionIndex + 1}
              </p>
            ) : null}
            {questionItem.question ? <p className="homework-task-sub">{questionItem.question}</p> : null}
            {questionItem.options.length ? (
              <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {questionItem.options.map((option, optionIndex) => (
                  <li key={String(option?.id || `${questionItem.id}-option-${optionIndex}`)}>
                    <span className="font-medium">{String.fromCharCode(65 + optionIndex)}.</span>{" "}
                    {String(option?.text || "").trim() || `Option ${optionIndex + 1}`}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

const renderMatchingContent = ({ block }) => {
  const matchingData = resolveMatchingData(block);
  if (matchingData.leftItems.length === 0 && matchingData.rightItems.length === 0) return null;

  const pairByLeftId = new Map(matchingData.pairs.map((pair) => [pair.left_id, pair]));
  const pairByRightId = new Map(matchingData.pairs.map((pair) => [pair.right_id, pair]));

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="homework-item-title">Table Matching</p>
      {matchingData.prompt ? <p className="homework-task-sub">{matchingData.prompt}</p> : null}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-2">
          {matchingData.leftItems.map((item, itemIndex) => {
            const pair = pairByLeftId.get(item.id);
            const colorClass = pair ? resolveMatchColorClass(pair.color_key, pair.__pairIndex || 0) : "";
            return (
              <div
                key={item.id || `left-${itemIndex}`}
                className={`rounded-md border px-3 py-2 text-sm ${colorClass}`}
              >
                {item.text || `Left item ${itemIndex + 1}`}
              </div>
            );
          })}
        </div>
        <div className="space-y-2">
          {matchingData.rightItems.map((item, itemIndex) => {
            const pair = pairByRightId.get(item.id);
            const colorClass = pair ? resolveMatchColorClass(pair.color_key, pair.__pairIndex || 0) : "";
            return (
              <div
                key={item.id || `right-${itemIndex}`}
                className={`rounded-md border px-3 py-2 text-sm ${colorClass}`}
              >
                {item.text || `Right item ${itemIndex + 1}`}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const renderGapfillTemplateParts = ({ parsedTemplate, lineKey }) => {
  return parsedTemplate.parts.map((part, partIndex) => {
    if (part.kind === "text") {
      return (
        <span key={`${lineKey}-text-${partIndex}`} className="whitespace-pre-wrap">
          {part.text}
        </span>
      );
    }

    if (part.type === "choice") {
      return (
        <select
          key={`${lineKey}-blank-${partIndex}`}
          className="mx-1 inline-flex h-8 min-w-28 rounded-md border bg-background px-2 text-xs"
          defaultValue=""
        >
          <option value="">Choose</option>
          {(Array.isArray(part.options) ? part.options : []).map((option, optionIndex) => (
            <option key={`${lineKey}-option-${partIndex}-${optionIndex}`} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        key={`${lineKey}-blank-${partIndex}`}
        type="text"
        className="mx-1 inline-flex h-8 min-w-24 rounded-md border bg-background px-2 text-xs"
        placeholder={`Blank ${(part.blankIndex || 0) + 1}`}
      />
    );
  });
};

const renderGapfillContent = ({ block }) => {
  const gapfillData = normalizeGapfillBlockData(block?.data || {});
  const prompt = String(gapfillData?.prompt || "").trim();
  const templates = gapfillData.mode === GAPFILL_MODE_PARAGRAPH
    ? [String(gapfillData?.paragraph_text || "")]
    : Array.isArray(gapfillData?.numbered_items)
      ? gapfillData.numbered_items
      : [];
  const hasContent = templates.some((template) => String(template || "").trim() !== "");
  if (!hasContent) return null;

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="homework-item-title">Gap Filling</p>
      {prompt ? <p className="homework-task-sub">{prompt}</p> : null}
      <div className="mt-3 space-y-3">
        {templates.map((template, templateIndex) => {
          const parsedTemplate = parseGapfillTemplate(template);
          const lineKey = `${resolveTaskBlockId(block)}-${templateIndex}`;
          if (gapfillData.mode === GAPFILL_MODE_NUMBERED) {
            return (
              <div key={lineKey} className="flex items-start gap-2">
                <span className="pt-1 text-xs font-medium text-muted-foreground">{templateIndex + 1}.</span>
                <p className="text-sm leading-7">{renderGapfillTemplateParts({ parsedTemplate, lineKey })}</p>
              </div>
            );
          }
          return (
            <p key={lineKey} className="text-sm leading-7">
              {renderGapfillTemplateParts({ parsedTemplate, lineKey })}
            </p>
          );
        })}
      </div>
    </div>
  );
};

const renderFindMistakeTemplateParts = ({ parsedTemplate, lineKey }) => {
  return parsedTemplate.parts.map((part, partIndex) => {
    if (part.kind === "text") {
      return (
        <span key={`${lineKey}-text-${partIndex}`} className="whitespace-pre-wrap">
          {part.text}
        </span>
      );
    }

    if (part.type === "choice") {
      return (
        <span key={`${lineKey}-blank-${partIndex}`} className="mx-1 inline-flex flex-wrap items-center gap-1">
          {part.options.map((option, optionIndex) => {
            const isCorrect = part.correctIndex === optionIndex;
            return (
              <span
                key={`${lineKey}-option-${partIndex}-${optionIndex}`}
                className={`rounded border px-1.5 py-0.5 text-xs font-medium ${
                  isCorrect
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {option}
              </span>
            );
          })}
        </span>
      );
    }

    const isMarkedCorrect = String(part.raw || "").trim().startsWith("*");
    return (
      <span
        key={`${lineKey}-plain-${partIndex}`}
        className={`mx-1 inline-flex rounded border px-1.5 py-0.5 text-xs font-medium ${
          isMarkedCorrect
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-rose-200 bg-rose-50 text-rose-700"
        }`}
      >
        {part.correctAnswer}
      </span>
    );
  });
};

const renderFindMistakeContent = ({ block }) => {
  const findMistakeData = normalizeFindMistakeBlockData(block?.data || {});
  const prompt = String(findMistakeData?.prompt || "").trim();
  const templates = Array.isArray(findMistakeData?.numbered_items) ? findMistakeData.numbered_items : [];
  const hasContent = templates.some((template) => String(template || "").trim() !== "");
  if (!hasContent) return null;

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="homework-item-title">Find Mistake</p>
      {prompt ? <p className="homework-task-sub">{prompt}</p> : null}
      <div className="mt-3 space-y-3">
        {templates.map((template, templateIndex) => {
          const parsedTemplate = parseGapfillTemplate(template);
          const lineKey = `${resolveTaskBlockId(block)}-find-${templateIndex}`;
          return (
            <div key={lineKey} className="flex items-start gap-2">
              <span className="pt-1 text-xs font-medium text-muted-foreground">{templateIndex + 1}.</span>
              <p className="text-sm leading-7">{renderFindMistakeTemplateParts({ parsedTemplate, lineKey })}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TASK_BLOCK_RENDERERS = {
  title: ({ block }) => {
    const text = String(block?.data?.text || "").trim();
    if (!text) return null;
    return <h4 className="homework-item-title">{text}</h4>;
  },
  instruction: ({ block }) => {
    const text = String(block?.data?.text || "").trim();
    if (!text) return null;
    return <p className="homework-task-sub">{text}</p>;
  },
  video: ({ block, task, taskIndex }) => {
    const url = String(block?.data?.url || task?.resource_url || "").trim();
    if (!url) return null;
    return renderVideoBlock({ taskTitle: task?.title, taskIndex, url });
  },
  internal: ({ block, task }) => {
    const resourceRefType = String(block?.data?.resource_ref_type || task?.resource_ref_type || "").trim();
    const resourceRefId = String(block?.data?.resource_ref_id || task?.resource_ref_id || "").trim();
    return (
      <p className="homework-item-meta">
        Internal {resourceRefType || "content"}: {resourceRefId || "--"}
      </p>
    );
  },
  passage: ({ block, nestedQuizBlocks = [] }) => {
    const passageText = String(block?.data?.text || "").trim();
    return (
      <div className="space-y-3">
        {passageText ? (
          <p className="homework-task-sub whitespace-pre-wrap">{passageText}</p>
        ) : (
          <p className="homework-item-meta">Passage is empty.</p>
        )}
        {nestedQuizBlocks.map((quizBlock, quizIndex) => {
          const quizContent = renderQuizContent({
            block: quizBlock,
            titlePrefix: `Reading Question ${quizIndex + 1}`,
          });
          if (!quizContent) return null;
          return (
            <div
              key={resolveTaskBlockId(quizBlock) || `passage-quiz-${quizIndex}`}
              data-testid="task-content-block"
              data-block-type="quiz"
            >
              {quizContent}
            </div>
          );
        })}
      </div>
    );
  },
  quiz: ({ block }) => renderQuizContent({ block }),
  matching: ({ block }) => renderMatchingContent({ block }),
  gapfill: ({ block }) => renderGapfillContent({ block }),
  find_mistake: ({ block }) => renderFindMistakeContent({ block }),
};

export default function MyHomeworkLessonPage() {
  const { assignmentId, lessonId } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const {
    isPreviewMode,
    canAccessPage,
    loading,
    error,
    assignment,
    tasks,
    submissionsByTaskId,
    reloadAssignment,
  } = useHomeworkAssignmentDetail(assignmentId);

  const [drafts, setDrafts] = useState({});
  const recordersRef = useRef(new Map());
  const streamsRef = useRef(new Map());
  const chunksRef = useRef(new Map());
  const previewUrlsRef = useRef(new Set());

  const lessonListPath = `/student-ielts/homework/${assignmentId}${isPreviewMode ? "?preview=1" : ""}`;
  const monthPath = "/student-ielts/homework";

  const selectedTask = useMemo(
    () => tasks.find((task) => String(task?._id || "") === String(lessonId || "")),
    [tasks, lessonId],
  );

  const selectedTaskId = String(selectedTask?._id || "");
  const selectedTaskIndex = useMemo(
    () => tasks.findIndex((task) => String(task?._id || "") === selectedTaskId),
    [tasks, selectedTaskId],
  );
  const submission = submissionsByTaskId.get(selectedTaskId);
  const draft = drafts[selectedTaskId] || createDraft(submission);

  const isDeadlinePassed = useMemo(() => {
    const due = assignment?.due_date ? new Date(assignment.due_date) : null;
    if (!due || Number.isNaN(due.getTime())) return false;
    return Date.now() > due.getTime();
  }, [assignment?.due_date]);

  const updateDraft = (taskId, patch) =>
    setDrafts((prev) => ({
      ...prev,
      [taskId]: { ...(prev[taskId] || createDraft()), ...patch },
    }));

  useEffect(() => {
    const nextDrafts = {};
    (assignment?.submissions || []).forEach((taskSubmission) => {
      nextDrafts[String(taskSubmission.task_id || "")] = createDraft(taskSubmission);
    });
    setDrafts(nextDrafts);
  }, [assignment]);

  const revokePreviewUrl = (url) => {
    const normalized = String(url || "");
    if (!normalized.startsWith("blob:")) return;
    try {
      URL.revokeObjectURL(normalized);
    } catch {
      // ignore URL revocation errors
    }
    previewUrlsRef.current.delete(normalized);
  };

  const clearDraftAudio = (taskId) => {
    setDrafts((prev) => {
      const nextDraft = { ...(prev[taskId] || createDraft()) };
      if (nextDraft.audio_preview_url) {
        revokePreviewUrl(nextDraft.audio_preview_url);
      }
      nextDraft.audio_file = null;
      nextDraft.audio_preview_url = "";
      nextDraft.audio_error = "";
      return {
        ...prev,
        [taskId]: nextDraft,
      };
    });
  };

  const finalizeRecorderForTask = (taskId, { forceDiscard = false, skipDraftUpdate = false } = {}) => {
    const stream = streamsRef.current.get(taskId);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamsRef.current.delete(taskId);
    }
    const recordedChunks = chunksRef.current.get(taskId) || [];
    chunksRef.current.delete(taskId);
    recordersRef.current.delete(taskId);

    if (forceDiscard || !recordedChunks.length) {
      if (skipDraftUpdate) return;
      updateDraft(taskId, { is_recording: false });
      return;
    }

    const blob = new Blob(recordedChunks, { type: recordedChunks[0]?.type || "audio/webm" });
    const mimeType = blob.type || "audio/webm";
    const extension = mimeType.includes("mp4")
      ? "mp4"
      : mimeType.includes("ogg")
        ? "ogg"
        : mimeType.includes("mpeg") || mimeType.includes("mp3")
          ? "mp3"
          : "webm";
    const file = new File([blob], `homework-recording-${Date.now()}.${extension}`, { type: mimeType });
    const previewUrl = URL.createObjectURL(blob);
    previewUrlsRef.current.add(previewUrl);

    if (skipDraftUpdate) return;

    setDrafts((prev) => {
      const nextDraft = { ...(prev[taskId] || createDraft()) };
      if (nextDraft.audio_preview_url) {
        revokePreviewUrl(nextDraft.audio_preview_url);
      }
      nextDraft.audio_file = file;
      nextDraft.audio_preview_url = previewUrl;
      nextDraft.audio_error = "";
      nextDraft.is_recording = false;
      return {
        ...prev,
        [taskId]: nextDraft,
      };
    });
  };

  const stopAudioRecording = (taskId, options = {}) => {
    const recorder = recordersRef.current.get(taskId);
    if (!recorder) return;

    if (options.forceDiscard) {
      try {
        recorder.onstop = null;
        recorder.onerror = null;
        recorder.ondataavailable = null;
        if (recorder.state !== "inactive") recorder.stop();
      } catch {
        // ignore recorder shutdown errors
      }
      finalizeRecorderForTask(taskId, { forceDiscard: true, skipDraftUpdate: Boolean(options.skipDraftUpdate) });
      return;
    }

    try {
      if (recorder.state !== "inactive") recorder.stop();
      else finalizeRecorderForTask(taskId, { skipDraftUpdate: Boolean(options.skipDraftUpdate) });
    } catch {
      finalizeRecorderForTask(taskId, { forceDiscard: true, skipDraftUpdate: Boolean(options.skipDraftUpdate) });
    }
  };

  const stopAllRecordings = ({ forceDiscard = false, skipDraftUpdate = false } = {}) => {
    Array.from(recordersRef.current.keys()).forEach((taskId) => {
      stopAudioRecording(taskId, { forceDiscard, skipDraftUpdate });
    });
  };

  const startAudioRecording = async (taskId) => {
    if (isPreviewMode) return;

    if (!navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      showNotification("Browser does not support microphone recording", "error");
      return;
    }

    stopAllRecordings({ forceDiscard: true });
    clearDraftAudio(taskId);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      const selectedMimeType = preferredMimeTypes.find(
        (mimeType) => typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(mimeType),
      );
      const recorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);

      streamsRef.current.set(taskId, stream);
      recordersRef.current.set(taskId, recorder);
      chunksRef.current.set(taskId, []);

      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size <= 0) return;
        const currentChunks = chunksRef.current.get(taskId) || [];
        chunksRef.current.set(taskId, [...currentChunks, event.data]);
      };
      recorder.onstop = () => finalizeRecorderForTask(taskId);
      recorder.onerror = () => {
        finalizeRecorderForTask(taskId, { forceDiscard: true });
        updateDraft(taskId, { audio_error: "Failed to record audio." });
      };

      recorder.start(250);
      updateDraft(taskId, { is_recording: true, audio_error: "" });
    } catch {
      updateDraft(taskId, { is_recording: false, audio_error: "Cannot access microphone." });
      showNotification("Cannot access microphone", "error");
    }
  };

  useEffect(() => () => {
    stopAllRecordings({ forceDiscard: true, skipDraftUpdate: true });
    Array.from(previewUrlsRef.current).forEach((url) => revokePreviewUrl(url));
  }, []);

  useEffect(() => {
    stopAllRecordings({ forceDiscard: true, skipDraftUpdate: true });
  }, [lessonId]);

  const handleSubmitTask = async () => {
    if (isPreviewMode || !selectedTaskId) return;

    const currentDraft = drafts[selectedTaskId] || createDraft(submission);
    if (currentDraft.is_recording) {
      showNotification("Please stop recording before submitting", "error");
      return;
    }

    updateDraft(selectedTaskId, { submitting: true });

    try {
      const formData = new FormData();
      if (currentDraft.text_answer !== undefined) {
        formData.append("text_answer", currentDraft.text_answer || "");
      }
      (currentDraft.image_files || []).forEach((file) => {
        formData.append("images", file);
      });
      if (currentDraft.audio_file) {
        formData.append("audio", currentDraft.audio_file);
      }

      await api.homeworkSubmitTask(assignmentId, selectedTaskId, formData);
      showNotification("Task submitted", "success");
      if (currentDraft.audio_preview_url) {
        revokePreviewUrl(currentDraft.audio_preview_url);
      }
      await reloadAssignment();
      updateDraft(selectedTaskId, {
        image_files: [],
        audio_file: null,
        audio_preview_url: "",
        audio_error: "",
      });
    } catch (submitError) {
      showNotification(submitError?.message || "Failed to submit task", "error");
    } finally {
      updateDraft(selectedTaskId, { submitting: false });
    }
  };

  if (!canAccessPage) {
    return (
      <div className="homework-page">
        <div className="homework-shell">
          <div className="homework-card">
            {isPreviewMode
              ? "Preview mode is only available for teacher/admin accounts."
              : "This page is only available for student accounts."}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="homework-page">
        <div className="homework-shell">
          <div className="homework-card">Loading lesson...</div>
        </div>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="homework-page">
        <div className="homework-shell">
          <div className="homework-card">
            <p className="homework-danger">{error || "Assignment not found"}</p>
            <button
              type="button"
              className="homework-btn"
              onClick={() => navigate(isPreviewMode ? `/homework/assignments/${assignmentId}` : monthPath)}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const inputType = resolveTaskInputType(selectedTask);
  const hasTextInput = inputType === "text";
  const hasImageInput = inputType === "image";
  const hasAudioInput = inputType === "audio";
  const canSubmit = !isDeadlinePassed && !isPreviewMode;
  const canInteract = !draft.submitting && (!isDeadlinePassed || isPreviewMode);
  const taskBlocks = selectedTask ? getRenderableTaskBlocks(selectedTask) : [];
  const passageBlockIdSet = new Set(
    taskBlocks
      .filter((block) => String(block?.type || "").trim().toLowerCase() === "passage")
      .map((block) => resolveTaskBlockId(block))
      .filter(Boolean),
  );
  const nestedQuizBlocksByPassageId = taskBlocks.reduce((grouped, block) => {
    const blockType = String(block?.type || "").trim().toLowerCase();
    if (blockType !== "quiz") return grouped;
    const parentPassageBlockId = resolveQuizParentPassageBlockId(block);
    if (!parentPassageBlockId) return grouped;
    if (!passageBlockIdSet.has(parentPassageBlockId)) return grouped;
    const current = grouped.get(parentPassageBlockId) || [];
    grouped.set(parentPassageBlockId, [...current, block]);
    return grouped;
  }, new Map());

  return (
    <div className="homework-page">
      <div className="homework-shell">
        <section className="homework-header">
          <div className="homework-title-wrap">
            <h1>{assignment.title || "Assignment"}</h1>
            <p>
              Week {assignment.week || "--"} - Due {formatDate(assignment.due_date)} - {assignment.month || "--"}
            </p>
          </div>
          <div className="homework-actions">
            <button type="button" className="homework-btn ghost" onClick={() => navigate("/")}>
              Home
            </button>
            <button type="button" className="homework-btn" onClick={() => navigate(lessonListPath)}>
              Month
            </button>
          </div>
        </section>

        <section className="homework-stacked">
            <div className="homework-card">
              <nav className="homework-breadcrumb" aria-label="Breadcrumb">
                <Link to={lessonListPath}>Month</Link>
                <span>/</span>
                <span>{selectedTask?.title || "Lesson"}</span>
              </nav>
            </div>

            {!selectedTask ? (
              <article className="homework-card">
                <p className="homework-danger">Lesson not found.</p>
                <button type="button" className="homework-btn" onClick={() => navigate(lessonListPath)}>
                  Back to Month
                </button>
              </article>
            ) : (
              <>
                {isPreviewMode ? (
                  <section className="homework-card">
                    <p className="homework-item-meta">
                      Preview mode: this page simulates student UI. Submit actions are disabled.
                    </p>
                  </section>
                ) : null}

                {isDeadlinePassed ? (
                  <section className="homework-card">
                    <p className="homework-danger">
                      Deadline has passed. You can still review your submissions.
                    </p>
                  </section>
                ) : null}

                <article className="homework-task-card">
                  <div className="homework-task-head">
                    <h3>{selectedTask.title || "Lesson"}</h3>
                    <span className="homework-chip">
                      {submission ? statusLabel(submission.status) : "Not submitted"}
                    </span>
                  </div>

                  <div className="homework-task-blocks">
                    {taskBlocks.map((block, blockIndex) => {
                      const blockType = String(block?.type || "").trim().toLowerCase();
                      const parentPassageBlockId = resolveQuizParentPassageBlockId(block);
                      if (
                        blockType === "quiz"
                        && parentPassageBlockId
                        && passageBlockIdSet.has(parentPassageBlockId)
                      ) {
                        return null;
                      }
                      const renderBlock = TASK_BLOCK_RENDERERS[blockType];
                      if (!renderBlock) return null;
                      const currentBlockId = resolveTaskBlockId(block);
                      const content = renderBlock({
                        block,
                        task: selectedTask,
                        taskIndex: selectedTaskIndex >= 0 ? selectedTaskIndex : 0,
                        nestedQuizBlocks:
                          blockType === "passage" ? nestedQuizBlocksByPassageId.get(currentBlockId) || [] : [],
                      });
                      if (!content) return null;
                      return (
                        <div
                          key={getTaskBlockKey({ taskId: selectedTaskId, block, fallbackIndex: blockIndex })}
                          data-testid="task-content-block"
                          data-task-id={selectedTaskId}
                          data-block-type={blockType}
                        >
                          {content}
                        </div>
                      );
                    })}
                  </div>

                  <div className="homework-grid">
                    {hasTextInput ? (
                      <div className="homework-field homework-span-12">
                        <label>Text Answer</label>
                        <textarea
                          value={draft.text_answer || ""}
                          onChange={(event) => updateDraft(selectedTaskId, { text_answer: event.target.value })}
                          disabled={!canInteract}
                          placeholder={
                            selectedTask?.min_words || selectedTask?.max_words
                              ? `Type your answer here (${selectedTask.min_words || 0}-${selectedTask.max_words || "inf"} words)...`
                              : "Type your answer here..."
                          }
                        />
                      </div>
                    ) : null}

                    {hasImageInput ? (
                      <div className="homework-field homework-span-12">
                        <label>Images (max 5)</label>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(event) =>
                            updateDraft(selectedTaskId, { image_files: Array.from(event.target.files || []) })
                          }
                          disabled={!canInteract}
                        />
                        {submission?.image_items?.length ? (
                          <p className="homework-item-meta">Current: {submission.image_items.length} image(s)</p>
                        ) : null}
                      </div>
                    ) : null}

                    {hasAudioInput ? (
                      <div className="homework-field homework-span-12">
                        <label>Audio Recording</label>
                        <div className="homework-audio-recorder">
                          <div className="homework-inline">
                            <button
                              type="button"
                              className={`homework-btn ${draft.is_recording ? "ghost" : "primary"}`}
                              onClick={() =>
                                draft.is_recording
                                  ? stopAudioRecording(selectedTaskId)
                                  : void startAudioRecording(selectedTaskId)
                              }
                              disabled={!canInteract || isPreviewMode}
                            >
                              {draft.is_recording ? "Stop recording" : "Start recording"}
                            </button>
                            <button
                              type="button"
                              className="homework-btn ghost"
                              onClick={() => clearDraftAudio(selectedTaskId)}
                              disabled={!canInteract || (!draft.audio_file && !draft.audio_preview_url)}
                            >
                              Clear
                            </button>
                          </div>
                          <p className="homework-item-meta">
                            Record directly in the browser. No audio file upload is required.
                          </p>
                          {draft.audio_error ? <p className="homework-danger">{draft.audio_error}</p> : null}
                          {draft.audio_preview_url ? (
                            <audio controls src={draft.audio_preview_url} style={{ width: "100%", marginTop: "0.4rem" }} />
                          ) : submission?.audio_item?.url ? (
                            <audio controls src={submission.audio_item.url} style={{ width: "100%", marginTop: "0.4rem" }} />
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="homework-task-actions">
                    <button
                      type="button"
                      className="homework-btn primary"
                      onClick={() => void handleSubmitTask()}
                      disabled={!canSubmit || draft.submitting}
                    >
                      {isPreviewMode ? "Preview only" : draft.submitting ? "Submitting..." : "Submit Task"}
                    </button>
                    {submission?.status === "graded" ? (
                      <span className="homework-chip">
                        Score: {submission?.score ?? "--"} / 10
                      </span>
                    ) : null}
                  </div>

                  {submission?.teacher_feedback ? (
                    <div className="homework-card">
                      <h4 className="homework-item-title" style={{ fontSize: "0.95rem" }}>Teacher Feedback</h4>
                      <p className="homework-task-sub">{submission.teacher_feedback}</p>
                    </div>
                  ) : null}
                </article>
              </>
            )}
        </section>
      </div>
    </div>
  );
}

