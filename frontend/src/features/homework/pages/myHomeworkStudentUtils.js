export const createDraft = (submission = {}) => ({
  text_answer: submission?.text_answer || "",
  existing_image_items: Array.isArray(submission?.image_items) ? submission.image_items : [],
  image_files: [],
  audio_file: null,
  audio_preview_url: "",
  audio_error: "",
  is_recording: false,
  submitting: false,
});

const normalizeTaskBlockType = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!normalized) return "";
  if (normalized === "quizz" || normalized === "quizs" || normalized === "quizzes") return "quiz";
  if (normalized === "gapfilling" || normalized === "gap_fill" || normalized === "gap_filling") return "gapfill";
  if (normalized === "findmistake" || normalized === "find_mistakes") return "find_mistake";
  return normalized;
};

const resolveInputTypeFromBlockData = (data = {}) => {
  const explicitType = String(data?.input_type || "").trim().toLowerCase();
  if (["text", "image", "audio"].includes(explicitType)) return explicitType;
  if (Boolean(data?.requires_audio)) return "audio";
  if (Boolean(data?.requires_image)) return "image";
  if (Boolean(data?.requires_text)) return "text";
  return null;
};

export const resolveTaskInputType = (task = {}) => {
  const blocks = Array.isArray(task?.content_blocks) ? task.content_blocks : [];
  const sortedInputBlocks = blocks
    .filter((block) => String(block?.type || "") === "input")
    .slice()
    .sort((a, b) => Number(a?.order || 0) - Number(b?.order || 0));
  const latestInputBlock = sortedInputBlocks[sortedInputBlocks.length - 1];
  const inputData =
    latestInputBlock?.data && typeof latestInputBlock.data === "object" ? latestInputBlock.data : {};
  const typeFromBlock = resolveInputTypeFromBlockData(inputData);
  if (typeFromBlock) return typeFromBlock;
  const hasDictationBlock = blocks.some((block) => String(block?.type || "").trim().toLowerCase() === "dictation");
  if (hasDictationBlock) return "text";
  if (Boolean(task?.requires_audio)) return "audio";
  if (Boolean(task?.requires_image)) return "image";
  if (Boolean(task?.requires_text)) return "text";
  return null;
};

const normalizeTaskBlocks = (blocks = []) =>
  (Array.isArray(blocks) ? blocks : [])
    .map((block, index) => ({
      ...block,
      type: normalizeTaskBlockType(block?.type),
      __sourceIndex: index,
      __order: Number.isFinite(Number(block?.order)) ? Number(block.order) : index,
    }))
    .filter((block) => block.type)
    .sort((a, b) => (a.__order === b.__order ? a.__sourceIndex - b.__sourceIndex : a.__order - b.__order));

const buildLegacyBlocksFromTask = (task = {}) => {
  const legacyBlocks = [];

  const instructionText = String(task?.instruction || "").trim();
  if (instructionText) {
    legacyBlocks.push({
      type: "instruction",
      order: legacyBlocks.length,
      data: { text: instructionText },
    });
  }

  const inputType = resolveTaskInputType(task);
  if (inputType) {
    legacyBlocks.push({
      type: "input",
      order: legacyBlocks.length,
      data: { input_type: inputType },
    });
  }

  if (task?.resource_mode === "internal") {
    legacyBlocks.push({
      type: "internal",
      order: legacyBlocks.length,
      data: {
        resource_ref_type: task?.resource_ref_type || "",
        resource_ref_id: task?.resource_ref_id || "",
      },
    });
  }

  if ((task?.resource_mode === "external_url" || task?.resource_mode === "uploaded") && task?.resource_url) {
    legacyBlocks.push({
      type: "video",
      order: legacyBlocks.length,
      data: { url: String(task.resource_url || "").trim() },
    });
  }

  return legacyBlocks;
};

export const getRenderableTaskBlocks = (task = {}) => {
  const normalizedBlocks = normalizeTaskBlocks(task?.content_blocks);
  if (normalizedBlocks.length > 0) return normalizedBlocks;
  return normalizeTaskBlocks(buildLegacyBlocksFromTask(task));
};

const hashString = (value = "") => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

export const getTaskBlockKey = ({ taskId, block, fallbackIndex }) => {
  const explicitId = String(block?.id || block?.clientId || block?._id || block?.data?.block_id || "").trim();
  if (explicitId) return `${taskId || "task"}-${explicitId}`;

  let serializedData = "";
  try {
    serializedData = JSON.stringify(block?.data || {});
  } catch {
    serializedData = "";
  }

  const typePart = String(block?.type || "unknown");
  const orderPart = Number.isFinite(Number(block?.order)) ? Number(block.order) : fallbackIndex;
  return `${taskId || "task"}-${typePart}-${orderPart}-${hashString(serializedData)}`;
};

const mapLessonToTask = (lesson = {}, fallbackOrder = 0, fallbackId = "") => ({
  _id: lesson?._id || fallbackId,
  type: lesson?.type || "custom_task",
  title: lesson?.name || `Task ${fallbackOrder + 1}`,
  instruction: lesson?.instruction || "",
  order: Number.isFinite(Number(lesson?.order)) ? Number(lesson.order) : fallbackOrder,
  resource_mode: lesson?.resource_mode || "internal",
  resource_ref_type: lesson?.resource_ref_type || null,
  resource_ref_id: lesson?.resource_ref_id || null,
  resource_url: lesson?.resource_url || null,
  resource_storage_key: lesson?.resource_storage_key || null,
  requires_text: Boolean(lesson?.requires_text),
  requires_image: Boolean(lesson?.requires_image),
  requires_audio: Boolean(lesson?.requires_audio),
  min_words: lesson?.min_words ?? null,
  max_words: lesson?.max_words ?? null,
  due_date: lesson?.due_date || null,
  content_blocks: Array.isArray(lesson?.content_blocks)
    ? lesson.content_blocks.map((block, blockIndex) => ({
        ...block,
        type: normalizeTaskBlockType(block?.type),
        order: Number.isFinite(Number(block?.order)) ? Number(block.order) : blockIndex,
        data: block?.data && typeof block.data === "object" ? { ...block.data } : {},
      }))
    : [],
});

export const buildPreviewAssignmentFromManageData = (assignment = {}) => {
  const sections = Array.isArray(assignment?.sections) ? assignment.sections : [];
  const publishedSections = sections
    .filter((section) => Boolean(section?.is_published))
    .map((section) => ({
      ...section,
      lessons: (Array.isArray(section?.lessons) ? section.lessons : []).filter((lesson) =>
        Boolean(lesson?.is_published),
      ),
    }))
    .filter((section) => (section.lessons || []).length > 0);

  const tasks = [];
  publishedSections.forEach((section, sectionIndex) => {
    (section.lessons || []).forEach((lesson, lessonIndex) => {
      const fallbackId = `${sectionIndex}-${lessonIndex}`;
      tasks.push(mapLessonToTask(lesson, tasks.length, fallbackId));
    });
  });

  return {
    ...assignment,
    sections: publishedSections,
    tasks,
    submissions: [],
    progress: {
      submitted_tasks: 0,
      total_tasks: tasks.length,
      graded_tasks: 0,
      pending_tasks: tasks.length,
    },
  };
};

export const sortTasksByOrder = (tasks = []) =>
  (Array.isArray(tasks) ? tasks : [])
    .map((task, index) => ({
      ...task,
      __sourceIndex: index,
      __order: Number.isFinite(Number(task?.order)) ? Number(task.order) : index,
    }))
    .sort((a, b) => (a.__order === b.__order ? a.__sourceIndex - b.__sourceIndex : a.__order - b.__order))
    .map(({ __sourceIndex, __order, ...task }) => task);

export { normalizeTaskBlockType };
