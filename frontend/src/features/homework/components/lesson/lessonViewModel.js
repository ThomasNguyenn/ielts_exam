import { normalizeTaskBlockType } from "@/features/homework/pages/myHomeworkStudentUtils";
import { resolveInternalBlockData, resolveInternalSlotKeyFromBlock } from "./blocks/blockUtils";

const FALLBACK_CHECKLIST = [
  "Äá»c ká»¹ hÆ°á»›ng dáº«n vÃ  ghi chÃº cÃ¡c Ä‘iá»ƒm quan trá»ng.",
  "HoÃ n thÃ nh toÃ n bá»™ ná»™i dung trÆ°á»›c khi ná»™p bÃ i.",
  "Kiá»ƒm tra láº¡i Ä‘Ã¡p Ã¡n vÃ  tá»‡p Ä‘Ã­nh kÃ¨m trÆ°á»›c khi gá»­i.",
];

const cleanChecklistLine = (value = "") =>
  String(value || "")
    .replace(/^\s*(?:[-*â€¢]|\d+[.)])\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

const extractChecklistFromInstruction = (instruction = "") => {
  return String(instruction || "")
    .split(/\r?\n+/)
    .map(cleanChecklistLine)
    .filter(Boolean);
};

const extractPromptLinesFromBlocks = (taskBlocks = []) =>
  (Array.isArray(taskBlocks) ? taskBlocks : [])
    .map((block) => String(block?.data?.prompt || "").trim())
    .filter(Boolean)
    .map(cleanChecklistLine)
    .filter(Boolean);

const dedupeKeepOrder = (items = []) => {
  const seen = new Set();
  const result = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    const normalized = String(item || "").trim();
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(normalized);
  });
  return result;
};

export const buildChecklistItems = ({ task, taskBlocks }) => {
  const fromInstruction = extractChecklistFromInstruction(task?.instruction || "");
  const fromPrompts = extractPromptLinesFromBlocks(taskBlocks);
  const merged = dedupeKeepOrder([...fromInstruction, ...fromPrompts]).slice(0, 3);
  if (merged.length > 0) return merged;
  return FALLBACK_CHECKLIST;
};

export const buildLessonBlockAnchorId = ({ taskId, blockKey }) => {
  const normalizedTaskId = String(taskId || "task").trim() || "task";
  const normalizedBlockKey = String(blockKey || "block").replace(/[^a-zA-Z0-9_-]/g, "-");
  return `lesson-block-${normalizedTaskId}-${normalizedBlockKey}`;
};

export const buildMissionResources = ({ taskBlocks, taskId, getBlockKey }) => {
  const passageCounter = { value: 0 };
  const videoCounter = { value: 0 };
  const internalCounter = { value: 0 };

  return (Array.isArray(taskBlocks) ? taskBlocks : [])
    .map((block, blockIndex) => {
      const blockType = normalizeTaskBlockType(block?.type);
      if (!["internal", "video", "passage"].includes(blockType)) return null;

      const blockKey = typeof getBlockKey === "function"
        ? getBlockKey(block, blockIndex)
        : `${blockType}-${blockIndex + 1}`;

      if (blockType === "passage") {
        passageCounter.value += 1;
        return {
          key: blockKey,
          block,
          blockType,
          anchorId: buildLessonBlockAnchorId({ taskId, blockKey }),
          title: `Äoáº¡n Ä‘á»c ${passageCounter.value}`,
          subtitle: "Äá»c Ä‘oáº¡n vÄƒn vÃ  hoÃ n thÃ nh cÃ¢u há»i liÃªn quan.",
          tag: "Báº¯t buá»™c",
          actionLabel: "Má»Ÿ Ä‘oáº¡n Ä‘á»c",
        };
      }

      if (blockType === "video") {
        videoCounter.value += 1;
        const mediaType = String(block?.data?.media_type || "video").trim().toLowerCase();
        const isImage = mediaType === "image";
        return {
          key: blockKey,
          block,
          blockType,
          anchorId: buildLessonBlockAnchorId({ taskId, blockKey }),
          title: isImage ? `TÃ i liá»‡u áº£nh ${videoCounter.value}` : `Video ${videoCounter.value}`,
          subtitle: isImage
            ? "Má»Ÿ hÃ¬nh áº£nh tham kháº£o trÆ°á»›c khi ná»™p bÃ i."
            : "Xem video hÆ°á»›ng dáº«n trÆ°á»›c khi lÃ m bÃ i.",
          tag: "TÃ i liá»‡u",
          actionLabel: isImage ? "Má»Ÿ áº£nh" : "Má»Ÿ video",
        };
      }

      internalCounter.value += 1;
      const internalData = resolveInternalBlockData(block);
      const refType = String(internalData?.resource_ref_type || "").trim();
      const refId = String(internalData?.resource_ref_id || "").trim();
      const resourceSlotKey = resolveInternalSlotKeyFromBlock(block, blockIndex);
      return {
        key: blockKey,
        block,
        blockType,
        anchorId: buildLessonBlockAnchorId({ taskId, blockKey }),
        title: refType ? `${refType} ${internalCounter.value}` : `TÃ i nguyÃªn ná»™i bá»™ ${internalCounter.value}`,
        subtitle: refId ? `ID: ${refId}` : "Má»Ÿ ná»™i dung ná»™i bá»™ Ä‘Æ°á»£c gÃ¡n cho bÃ i há»c.",
        tag: "Báº¯t buá»™c",
        actionLabel: "Launch Resource",
        resourceRefType: refType,
        resourceRefId: refId,
        resourceSlotKey,
      };
    })
    .filter(Boolean);
};

export const resolveLessonStatusLabel = ({
  submission,
  isPreviewMode,
  isDeadlinePassed,
  isLateSubmission,
}) => {
  if (isPreviewMode) return "Preview";
  if (submission?.status === "graded") return "Graded";
  if (submission && isLateSubmission) return "Late submission";
  if (submission) return "Submitted";
  if (isDeadlinePassed) return "Overdue";
  return "In progress";
};

export const resolveSubmissionStatusText = ({ isPreviewMode, isDeadlinePassed, isLateSubmission }) => {
  if (isPreviewMode) return "Preview mode disables submit.";
  if (isLateSubmission) return "Submitted after deadline (late). You can update your answer if needed.";
  if (isDeadlinePassed) return "Deadline has passed. You can still submit, but it will be marked as late.";
  return "Submitting will update your latest answer for this lesson.";
};
