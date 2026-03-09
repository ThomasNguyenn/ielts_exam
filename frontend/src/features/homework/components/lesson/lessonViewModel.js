import { normalizeTaskBlockType } from "@/features/homework/pages/myHomeworkStudentUtils";

const FALLBACK_CHECKLIST = [
  "Đọc kỹ hướng dẫn và ghi chú các điểm quan trọng.",
  "Hoàn thành toàn bộ nội dung trước khi nộp bài.",
  "Kiểm tra lại đáp án và tệp đính kèm trước khi gửi.",
];

const cleanChecklistLine = (value = "") =>
  String(value || "")
    .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
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
          title: `Đoạn đọc ${passageCounter.value}`,
          subtitle: "Đọc đoạn văn và hoàn thành câu hỏi liên quan.",
          tag: "Bắt buộc",
          actionLabel: "Mở đoạn đọc",
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
          title: isImage ? `Tài liệu ảnh ${videoCounter.value}` : `Video ${videoCounter.value}`,
          subtitle: isImage
            ? "Mở hình ảnh tham khảo trước khi nộp bài."
            : "Xem video hướng dẫn trước khi làm bài.",
          tag: "Tài liệu",
          actionLabel: isImage ? "Mở ảnh" : "Mở video",
        };
      }

      internalCounter.value += 1;
      const refType = String(block?.data?.resource_ref_type || "").trim();
      const refId = String(block?.data?.resource_ref_id || "").trim();
      return {
        key: blockKey,
        block,
        blockType,
        anchorId: buildLessonBlockAnchorId({ taskId, blockKey }),
        title: refType ? `${refType} ${internalCounter.value}` : `Tài nguyên nội bộ ${internalCounter.value}`,
        subtitle: refId ? `ID: ${refId}` : "Mở nội dung nội bộ được gán cho bài học.",
        tag: "Bắt buộc",
        actionLabel: "Open Resource",
      };
    })
    .filter(Boolean);
};

export const resolveLessonStatusLabel = ({ submission, isPreviewMode, isDeadlinePassed }) => {
  if (isPreviewMode) return "Preview";
  if (isDeadlinePassed) return "Quá hạn";
  if (submission?.status === "graded") return "Đã chấm";
  if (submission) return "Đã nộp";
  return "Đang làm";
};

export const resolveSubmissionStatusText = ({ isPreviewMode, isDeadlinePassed }) => {
  if (isPreviewMode) return "Preview mode disables submit.";
  if (isDeadlinePassed) return "Deadline has passed. You can review only.";
  return "Submitting will update your latest answer for this lesson.";
};
