import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import LiteYouTubeEmbed from "react-lite-youtube-embed";
import "react-lite-youtube-embed/dist/LiteYouTubeEmbed.css";
import {
  USER_ROLE_STUDENT_ACA,
  normalizeUserRole,
  studentAcaPath,
  studentIeltsPath,
} from "@/app/roleRouting";
import { api } from "@/shared/api/client";
import { useNotification } from "@/shared/context/NotificationContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ArrowLeft, BookOpen, CheckCircle2 } from "lucide-react";
import { IconCloud } from "@tabler/icons-react";
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
import DictationAudioPlayer from "./DictationAudioPlayer";
import { useHomeworkAssignmentDetail } from "./useHomeworkAssignmentDetail";
import { toSanitizedInnerHtml } from "@/shared/utils/safeHtml";
import "./Homework.css";

const resolveVideoSourceLabel = (preview = {}) => {
  if (preview.kind === "youtube") return "YouTube";
  if (preview.kind === "vimeo") return "Vimeo";
  if (preview.kind === "direct") return "Direct";
  return "External";
};

const renderVideoPlayer = ({ preview, taskTitle, taskIndex, url }) => {
  if (preview.kind === "youtube" && preview.youtubeId) {
    return (
      <div className="homework-video-lite">
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
      <iframe
        src={preview.src}
        title={taskTitle || `Task ${taskIndex + 1} video`}
        className="aspect-video w-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }
  if (preview.kind === "direct") {
    return <video controls className="aspect-video w-full" src={preview.src} />;
  }
  return (
    <p className="homework-video-fallback">
      Resource:{" "}
      <a href={url} target="_blank" rel="noreferrer">
        Open link
      </a>
    </p>
  );
};

const renderVideoBlock = ({ taskTitle, taskIndex, url, submissionStatus = "" }) => {
  const preview = resolveVideoPreview(url || "");

  return (
    <div className="homework-video-card">
      <div className="homework-video-frame">
        {renderVideoPlayer({ preview, taskTitle, taskIndex, url })}
      </div>
    </div>
  );
};

const resolveTaskBlockId = (block = {}) =>
  String(block?.data?.block_id || block?.id || block?.clientId || block?._id || "").trim();

const resolveQuizParentPassageBlockId = (block = {}) =>
  String(block?.data?.parent_passage_block_id || "").trim();

const resolveQuizLayout = (block = {}) => {
  const normalized = String(block?.data?.layout || "").trim().toLowerCase();
  return normalized === "list" ? "list" : "grid";
};

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

const buildQuizQuestionKey = ({ blockId, questionId, questionIndex = 0 }) => {
  const normalizedBlockId = String(blockId || "quiz").trim() || "quiz";
  const normalizedQuestionId = String(questionId || "").trim() || `question-${questionIndex + 1}`;
  return `${normalizedBlockId}:${normalizedQuestionId}`;
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

const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;
const cx = (...values) => values.filter(Boolean).join(" ");
const isHtmlLike = (value) => HTML_TAG_PATTERN.test(String(value || ""));
const countWords = (value = "") => {
  const matches = String(value || "").trim().match(/\S+/g);
  return matches ? matches.length : 0;
};

const renderRichTextBlock = (value, { className = "homework-task-sub", emptyFallback = null } = {}) => {
  const rawText = String(value || "");
  if (!rawText.trim()) return emptyFallback;
  if (!isHtmlLike(rawText)) return <p className={className}>{rawText}</p>;
  return (
    <div
      className={cx(className, "homework-task-rich")}
      dangerouslySetInnerHTML={toSanitizedInnerHtml(rawText)}
    />
  );
};

const renderInstructionBlock = (value) => {
  const content = renderRichTextBlock(value);
  if (!content) return null;
  return (
    <div className="space-y-3">
      <Separator />
      {content}
      <Separator />
    </div>
  );
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

const normalizeDictationBlockData = (data = {}) => {
  const normalizedData =
    data && typeof data === "object" && !Array.isArray(data) ? data : {};
  return {
    prompt: String(normalizedData.prompt || "").trim(),
    audio_url: String(normalizedData.audio_url || normalizedData.url || "").trim(),
  };
};

const renderQuizContent = ({
  block,
  titlePrefix = "Quiz",
  selectedOptionsByQuestionKey = {},
  onSelectOption,
  disabled = false,
  showQuestionPalette = false,
  variant = "default",
}) => {
  const questions = resolveQuizQuestions(block);
  if (!questions.length) return null;
  const blockId = resolveTaskBlockId(block);
  const quizLayout = resolveQuizLayout(block);
  const answeredCount = questions.reduce((count, questionItem, questionIndex) => {
    const questionKey = buildQuizQuestionKey({
      blockId,
      questionId: questionItem.id,
      questionIndex,
    });
    return selectedOptionsByQuestionKey[questionKey] ? count + 1 : count;
  }, 0);

  const quizPanel = (
    <div className={cx("homework-quiz-card", variant === "passage" && "homework-quiz-card--passage")}>
      <div className="homework-quiz-head">
        <div>
          <p className="homework-item-title">{titlePrefix}</p>
          <p className="homework-item-meta">
            {answeredCount}/{questions.length} question{questions.length > 1 ? "s" : ""} answered
          </p>
        </div>
        <span className="homework-chip neutral">{questions.length} questions</span>
      </div>

      {showQuestionPalette ? (
        <div className="homework-quiz-palette">
          {questions.map((questionItem, questionIndex) => {
            const questionKey = buildQuizQuestionKey({
              blockId,
              questionId: questionItem.id,
              questionIndex,
            });
            const isAnswered = Boolean(selectedOptionsByQuestionKey[questionKey]);
            return (
              <span
                key={`${questionKey}-chip`}
                className={cx("homework-quiz-palette-item", isAnswered && "homework-quiz-palette-item--answered")}
              >
                {questionIndex + 1}
              </span>
            );
          })}
        </div>
      ) : null}

      <div className="homework-quiz-body">
        {questions.map((questionItem, questionIndex) => (
          <div
            key={questionItem.id || `${resolveTaskBlockId(block)}-question-${questionIndex}`}
            className="homework-quiz-question"
          >
            {questions.length > 1 ? (
              <p className="homework-quiz-question-label">
                Question {questionIndex + 1}
              </p>
            ) : null}
            {renderRichTextBlock(questionItem.question, { className: "homework-quiz-question-text" })}
            {questionItem.options.length ? (
              <div className={cx("homework-quiz-options", quizLayout === "grid" && "homework-quiz-options--grid")}>
                {questionItem.options.map((option, optionIndex) => (
                  <button
                    key={String(option?.id || `${questionItem.id}-option-${optionIndex}`)}
                    type="button"
                    className={cx(
                      "homework-quiz-option",
                      selectedOptionsByQuestionKey[buildQuizQuestionKey({
                        blockId,
                        questionId: questionItem.id,
                        questionIndex,
                      })] === String(option?.id || "")
                      && "homework-quiz-option--selected",
                    )}
                    onClick={() => onSelectOption?.({
                      questionKey: buildQuizQuestionKey({
                        blockId,
                        questionId: questionItem.id,
                        questionIndex,
                      }),
                      optionId: String(option?.id || ""),
                    })}
                    disabled={disabled}
                  >
                    <span className="homework-quiz-option-key">{String.fromCharCode(65 + optionIndex)}</span>
                    <span className="homework-quiz-option-text">
                      {String(option?.text || "").trim() || `Option ${optionIndex + 1}`}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <p className="homework-item-meta">Selections are kept locally on this page while you work.</p>
    </div>
  );

  return (
    <div className="homework-quiz-responsive">
      <div className="homework-quiz-desktop">{quizPanel}</div>
      <div className="homework-quiz-mobile">
        <Drawer>
          <DrawerTrigger asChild>
            <button type="button" className="homework-quiz-mobile-trigger" disabled={disabled}>
              Pull up quiz ({answeredCount}/{questions.length})
            </button>
          </DrawerTrigger>
          <DrawerContent className="homework-quiz-drawer-content">
            <DrawerHeader className="homework-quiz-drawer-header">
              <DrawerTitle>{titlePrefix}</DrawerTitle>
            </DrawerHeader>
            <div className="homework-quiz-drawer-scroll">
              {quizPanel}
            </div>
          </DrawerContent>
        </Drawer>
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

const renderFindMistakeTemplateParts = ({
  parsedTemplate,
  lineKey,
  selectedTokenKey,
  onSelectToken,
  disabled = false,
}) => {
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
            const tokenKey = `${partIndex}:${optionIndex}`;
            const isSelected = selectedTokenKey === tokenKey;
            return (
              <button
                key={`${lineKey}-option-${partIndex}-${optionIndex}`}
                type="button"
                disabled={disabled}
                className={cx(
                  "homework-find-mistake-token",
                  isSelected && "homework-find-mistake-token--selected",
                )}
                onClick={() => onSelectToken?.(lineKey, tokenKey)}
              >
                {option}
              </button>
            );
          })}
        </span>
      );
    }

    const tokenKey = `${partIndex}`;
    const isSelected = selectedTokenKey === tokenKey;
    return (
      <button
        key={`${lineKey}-plain-${partIndex}`}
        type="button"
        disabled={disabled}
        className={cx(
          "mx-1 inline-flex",
          "homework-find-mistake-token",
          isSelected && "homework-find-mistake-token--selected",
        )}
        onClick={() => onSelectToken?.(lineKey, tokenKey)}
      >
        {part.correctAnswer}
      </button>
    );
  });
};

const renderFindMistakeContent = ({
  block,
  selectedByLineKey = {},
  onSelectToken,
  disabled = false,
}) => {
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
              <span className="pt-2 text-xs font-medium text-muted-foreground">{templateIndex + 1}.</span>
              <p className="text-sm leading-7">
                {renderFindMistakeTemplateParts({
                  parsedTemplate,
                  lineKey,
                  selectedTokenKey: selectedByLineKey[lineKey] || "",
                  onSelectToken,
                  disabled,
                })}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const renderDictationContent = ({
  block,
  draft,
  onChangeTextAnswer,
  onClearTextAnswer,
  disabled = false,
  showTranscriptInput = false,
  textPlaceholder = "Type what you hear...",
  minWords = null,
  maxWords = null,
  submissionStatus = "",
}) => {
  const dictationData = normalizeDictationBlockData(block?.data || {});
  if (!dictationData.audio_url) return null;
  const transcript = String(draft?.text_answer || "");
  const transcriptWordCount = countWords(transcript);
  const targetLabel = minWords || maxWords
    ? `${minWords || 0}-${maxWords || "inf"} words`
    : "Free-length response";

  return (
    <div className="homework-dictation-card">
      <div className="homework-dictation-intro">
        <p className="homework-item-title">Nghe audio, sau Ä‘Ã³ nháº­p láº¡i Ä‘Ãºng cÃ¢u báº¡n nghe Ä‘Æ°á»£c.</p>
        {dictationData.prompt
          ? renderRichTextBlock(dictationData.prompt, { className: "homework-dictation-description" })
          : (
            <p className="homework-dictation-description">
              Play the audio, then write down as much of the passage as you can remember.
            </p>
          )}
      </div>

      <div className="homework-dictation-player-shell">
        <DictationAudioPlayer
          src={dictationData.audio_url}
          title={dictationData.prompt || "Dictation Audio"}
          className="homework-dictation-player"
        />
      </div>

      {showTranscriptInput ? (
        <div className="homework-dictation-transcript">
          <div className="homework-dictation-transcript-head">
            <div>
              <p className="homework-item-title">Your transcript</p>
              <p className="homework-item-meta">This answer uses the existing homework text submission flow.</p>
            </div>
            <span className="homework-chip neutral">{transcriptWordCount} words</span>
          </div>
          <textarea
            className="homework-dictation-textarea"
            value={transcript}
            onChange={(event) => onChangeTextAnswer?.(event.target.value)}
            disabled={disabled}
            placeholder={textPlaceholder}
          />
          <div className="homework-dictation-transcript-actions">
            <p className="homework-item-meta">
              Use replay and skip controls in the player above if you need to check a phrase again.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onClearTextAnswer?.()}
              disabled={disabled || !transcript}
            >
              Clear transcript
            </Button>
          </div>
        </div>
      ) : null}

    </div>
  );
};

const TASK_BLOCK_RENDERERS = {
  title: ({ block }) => {
    const text = String(block?.data?.text || "").trim();
    if (!text) return null;
    return <h4 className="homework-item-title">{text}</h4>;
  },
  instruction: ({ block }) => renderInstructionBlock(block?.data?.text || ""),
  video: ({ block, task, taskIndex, submissionStatus }) => {
    const url = String(block?.data?.url || task?.resource_url || "").trim();
    if (!url) return null;
    return renderVideoBlock({ taskTitle: task?.title, taskIndex, url, submissionStatus });
  },
  internal: ({ block, task }) => {
    const resourceRefType = String(block?.data?.resource_ref_type || task?.resource_ref_type || "").trim();
    const resourceRefId = String(block?.data?.resource_ref_id || task?.resource_ref_id || "").trim();
    const onLaunchInternal = typeof block?.onLaunchInternal === "function" ? block.onLaunchInternal : null;
    const canLaunchInternal = Boolean(block?.canLaunchInternal);
    const isLaunchingInternal = Boolean(block?.isLaunchingInternal);

    return (
      <div className="homework-internal-launch">
        <p className="homework-item-meta">
          Internal {resourceRefType || "content"}: {resourceRefId || "--"}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="homework-internal-launch-btn"
          onClick={() => onLaunchInternal?.({ block, task })}
          disabled={!onLaunchInternal || !canLaunchInternal || !resourceRefId || isLaunchingInternal}
        >
          {isLaunchingInternal ? "Launching..." : "Launch Resource"}
        </Button>
      </div>
    );
  },
  passage: ({
    block,
    nestedQuizBlocks = [],
    quizSelections,
    onSelectQuizOption,
    isQuizDisabled,
  }) => {
    const passageText = String(block?.data?.text || "");
    const hasPassageText = passageText.trim() !== "";
    return (
      <div className="homework-passage-layout">
        <div className="homework-passage-card">
          <div className="homework-passage-head">
            <div>
              <p className="homework-item-title">Passage</p>
              <p className="homework-item-meta">Read the text first, then answer the quiz below.</p>
            </div>
            <span className="homework-chip neutral">Autosave on</span>
          </div>
          {hasPassageText ? (
            renderRichTextBlock(passageText, { className: "homework-passage-text" })
          ) : (
            <p className="homework-item-meta">Passage is empty.</p>
          )}
        </div>

        {nestedQuizBlocks.length > 0 ? (
          <div className="homework-passage-quiz-stack">
            {nestedQuizBlocks.map((quizBlock, quizIndex) => {
              const quizContent = renderQuizContent({
                block: quizBlock,
                titlePrefix: `Question Set ${quizIndex + 1}`,
                selectedOptionsByQuestionKey: quizSelections,
                onSelectOption: onSelectQuizOption,
                disabled: isQuizDisabled,
                showQuestionPalette: true,
                variant: "passage",
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
        ) : null}
      </div>
    );
  },
  quiz: ({ block, quizSelections, onSelectQuizOption, isQuizDisabled }) =>
    renderQuizContent({
      block,
      selectedOptionsByQuestionKey: quizSelections,
      onSelectOption: onSelectQuizOption,
      disabled: isQuizDisabled,
      showQuestionPalette: true,
    }),
  matching: ({ block }) => renderMatchingContent({ block }),
  gapfill: ({ block }) => renderGapfillContent({ block }),
  find_mistake: ({ block, findMistakeSelections, onSelectFindMistakeToken, isFindMistakeDisabled }) =>
    renderFindMistakeContent({
      block,
      selectedByLineKey: findMistakeSelections,
      onSelectToken: onSelectFindMistakeToken,
      disabled: isFindMistakeDisabled,
    }),
  dictation: ({
    block,
    draft,
    onChangeTextAnswer,
    onClearTextAnswer,
    isDictationDisabled,
    showDictationTranscriptInput,
    dictationTextPlaceholder,
    minWords,
    maxWords,
    submissionStatus,
  }) => renderDictationContent({
    block,
    draft,
    onChangeTextAnswer,
    onClearTextAnswer,
    disabled: isDictationDisabled,
    showTranscriptInput: showDictationTranscriptInput,
    textPlaceholder: dictationTextPlaceholder,
    minWords,
    maxWords,
    submissionStatus,
  }),
};

export default function MyHomeworkLessonPage() {
  const { assignmentId, lessonId } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const user = api.getUser();

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
  const [findMistakeSelections, setFindMistakeSelections] = useState({});
  const [quizSelections, setQuizSelections] = useState({});
  const [launchingTaskId, setLaunchingTaskId] = useState("");
  const recordersRef = useRef(new Map());
  const streamsRef = useRef(new Map());
  const chunksRef = useRef(new Map());
  const previewUrlsRef = useRef(new Set());

  const normalizedRole = normalizeUserRole(user?.role);
  const studentHomeworkBasePath =
    normalizedRole === USER_ROLE_STUDENT_ACA ? studentAcaPath("/homework") : studentIeltsPath("/homework");
  const lessonListPath = `${studentHomeworkBasePath}/${assignmentId}${isPreviewMode ? "?preview=1" : ""}`;
  const monthPath = studentHomeworkBasePath;

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
  const uploadInputId = `homework-upload-input-${String(selectedTaskId || "task").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const selectedImageFiles = Array.isArray(draft?.image_files) ? draft.image_files : [];
  const selectedImageFileNames = selectedImageFiles
    .map((file) => String(file?.name || "").trim())
    .filter(Boolean);

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

  useEffect(() => {
    setFindMistakeSelections({});
    setQuizSelections({});
  }, [selectedTaskId]);

  const handleSelectFindMistakeToken = (lineKey, tokenKey) => {
    if (!lineKey) return;
    setFindMistakeSelections((prev) => {
      const current = String(prev[lineKey] || "");
      const next = { ...prev };
      if (current && current === tokenKey) {
        delete next[lineKey];
        return next;
      }
      next[lineKey] = tokenKey;
      return next;
    });
  };

  const handleSelectQuizOption = ({ questionKey, optionId }) => {
    if (!questionKey || !optionId) return;
    setQuizSelections((prev) => {
      const current = String(prev[questionKey] || "");
      if (current === optionId) {
        const next = { ...prev };
        delete next[questionKey];
        return next;
      }
      return {
        ...prev,
        [questionKey]: optionId,
      };
    });
  };

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

  const getHomeworkTabSessionId = () => {
    if (typeof window === "undefined") return "";
    const storageKey = `homework-tab-session:${assignmentId}`;
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const nextId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    window.sessionStorage.setItem(storageKey, nextId);
    return nextId;
  };

  const createClientEventId = () =>
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const handleLaunchInternalResource = async ({ block, task }) => {
    if (!assignmentId || !selectedTaskId) return;

    const resourceRefType = String(block?.data?.resource_ref_type || task?.resource_ref_type || "").trim();
    const resourceRefId = String(block?.data?.resource_ref_id || task?.resource_ref_id || "").trim();
    if (!resourceRefType || !resourceRefId) {
      showNotification("Internal resource is not configured.", "error");
      return;
    }

    setLaunchingTaskId(selectedTaskId);
    try {
      const result = await api.homeworkLaunchTaskTracking(assignmentId, selectedTaskId, {
        event_id: createClientEventId(),
        tab_session_id: getHomeworkTabSessionId(),
        client_ts: new Date().toISOString(),
      });
      const launchUrl = String(result?.data?.launch_url || "").trim();
      if (!launchUrl) {
        throw new Error("Launch URL is unavailable");
      }
      window.open(launchUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      showNotification(error?.message || "Cannot launch internal resource.", "error");
    } finally {
      setLaunchingTaskId("");
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
  const dictationBlocks = taskBlocks.filter((block) => String(block?.type || "").trim().toLowerCase() === "dictation");
  const hasDictationBlock = dictationBlocks.length > 0;
  const primaryDictationBlockId = hasDictationBlock ? resolveTaskBlockId(dictationBlocks[0]) : "";
  const shouldUseDictationTranscript = hasTextInput && hasDictationBlock;
  const textAnswerPlaceholder =
    selectedTask?.min_words || selectedTask?.max_words
      ? `Type your answer here (${selectedTask.min_words || 0}-${selectedTask.max_words || "inf"} words)...`
      : "Type your answer here...";
  const textAnswerValue = String(draft.text_answer || "");
  const textAnswerWordCount = countWords(textAnswerValue);
  const textAnswerTargetLabel = selectedTask?.min_words || selectedTask?.max_words
    ? `${selectedTask.min_words || 0}-${selectedTask.max_words || "inf"} words`
    : "No strict word limit";
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
        <section className="mb-6 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(lessonListPath)}
            className="flex items-center gap-2 border bg-background shadow-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {assignment?.title || "Assignment"}
          </h2>
        </section>

        <section className="homework-stacked">
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
                  <div className="homework-task-left">
                    <div className="homework-task-logo">
                      <BookOpen className="homework-task-icon" size={22} color="#4285F4" />
                    </div>
                    <div className="homework-task-title-wrap">
                      <h3>{selectedTask.title || "Lesson"}</h3>
                    </div>
                  </div>
                  <div className={`homework-task-status-icon ${submission ? "submitted" : ""}`}>
                    <CheckCircle2 size={24} />
                  </div>
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
                      block: {
                        ...block,
                        onLaunchInternal: handleLaunchInternalResource,
                        canLaunchInternal: !isPreviewMode && canAccessPage,
                        isLaunchingInternal: launchingTaskId === selectedTaskId,
                      },
                      task: selectedTask,
                      taskIndex: selectedTaskIndex >= 0 ? selectedTaskIndex : 0,
                      nestedQuizBlocks:
                        blockType === "passage" ? nestedQuizBlocksByPassageId.get(currentBlockId) || [] : [],
                      findMistakeSelections,
                      onSelectFindMistakeToken: handleSelectFindMistakeToken,
                      isFindMistakeDisabled: !canInteract,
                      quizSelections,
                      onSelectQuizOption: handleSelectQuizOption,
                      isQuizDisabled: !canInteract,
                      draft,
                      onChangeTextAnswer: (value) => updateDraft(selectedTaskId, { text_answer: value }),
                      onClearTextAnswer: () => updateDraft(selectedTaskId, { text_answer: "" }),
                      isDictationDisabled: !canInteract,
                      showDictationTranscriptInput:
                        shouldUseDictationTranscript && currentBlockId === primaryDictationBlockId,
                      dictationTextPlaceholder: textAnswerPlaceholder,
                      minWords: selectedTask?.min_words,
                      maxWords: selectedTask?.max_words,
                      submissionStatus: submission ? statusLabel(submission.status) : "Not submitted",
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
                  {hasTextInput && !shouldUseDictationTranscript ? (
                    <div className="homework-text-answer-card homework-span-12">
                      <div className="homework-text-answer-head">
                        <div>
                          <p className="homework-text-answer-label">Text Answer</p>
                          <p className="homework-item-meta">Write your final response before submitting.</p>
                        </div>
                        <span className="homework-chip neutral">{textAnswerWordCount} words</span>
                      </div>
                      <textarea
                        className="homework-text-answer-textarea"
                        value={draft.text_answer || ""}
                        onChange={(event) => updateDraft(selectedTaskId, { text_answer: event.target.value })}
                        disabled={!canInteract}
                        placeholder={textAnswerPlaceholder}
                      />

                    </div>
                  ) : null}

                  {hasImageInput ? (
                    <Card className="homework-span-12 rounded-3xl border shadow-sm">
                      <input
                        id={uploadInputId}
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="hidden"
                        onChange={(event) =>
                          updateDraft(selectedTaskId, { image_files: Array.from(event.target.files || []) })
                        }
                        disabled={!canInteract}
                      />
                      <CardHeader className="space-y-3 pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant={selectedImageFiles.length ? "default" : "outline"}
                                className="rounded-full px-3 py-1"
                              >
                                {selectedImageFiles.length
                                  ? `${selectedImageFiles.length} file đã chọn`
                                  : "Chưa chọn file"}
                              </Badge>
                            </div>
                            <CardTitle className="text-xl">Nộp ảnh / Video bài làm</CardTitle>

                          </div>
                          {submission?.image_items?.length ? (
                            <Badge variant="outline" className="rounded-full px-3 py-1">
                              Hiện tại: {submission.image_items.length} file
                            </Badge>
                          ) : null}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Card
                          className={`rounded-2xl border-dashed shadow-none transition-colors ${selectedImageFiles.length ? "border-primary/40 bg-primary/[0.04]" : "bg-muted/40"
                            }`}
                        >
                          <CardContent className="space-y-3 p-4">
                            <Button
                              asChild
                              variant="outline"
                              className="h-11 w-full rounded-2xl"
                              disabled={!canInteract}
                            >
                              <label
                                htmlFor={canInteract ? uploadInputId : undefined}
                                className={canInteract ? "cursor-pointer" : "pointer-events-none cursor-not-allowed"}
                              >
                                <IconCloud className="mr-2 h-4 w-4" />
                                {selectedImageFiles.length ? "Chọn lại file" : "Upload"}
                              </label>
                            </Button>
                          </CardContent>
                        </Card>
                        {selectedImageFileNames.length ? (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">File da chon</p>
                            <div className="flex flex-wrap gap-2">
                              {selectedImageFileNames.slice(0, 6).map((fileName, index) => (
                                <Badge
                                  key={`${fileName}-${index}`}
                                  variant="outline"
                                  className="max-w-full truncate rounded-full px-3 py-1"
                                  title={fileName}
                                >
                                  {fileName}
                                </Badge>
                              ))}
                              {selectedImageFileNames.length > 6 ? (
                                <Badge variant="outline" className="rounded-full px-3 py-1">
                                  +{selectedImageFileNames.length - 6} file
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Chưa có file nào được chọn.</p>
                        )}
                      </CardContent>
                    </Card>
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

                <div className="homework-task-actions homework-task-actions--lesson">
                  <div className="homework-submit-meta">
                    <p className="homework-item-meta">
                      {isPreviewMode
                        ? "Preview mode disables submit."
                        : isDeadlinePassed
                          ? "Deadline has passed. You can review only."
                          : "Submitting will update your latest answer for this lesson."}
                    </p>
                    {submission?.status === "graded" ? (
                      <span className="homework-chip">
                        Score: {submission?.score ?? "--"} / 10
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="homework-submit-btn"
                    onClick={() => void handleSubmitTask()}
                    disabled={!canSubmit || draft.submitting}
                  >
                    {isPreviewMode ? "Preview only" : draft.submitting ? "Submitting..." : "Submit Task"}
                  </button>
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


