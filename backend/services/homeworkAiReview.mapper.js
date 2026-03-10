const MEDIA_KEY_BLOCKLIST = new Set([
  "url",
  "audio_url",
  "image_url",
  "video_url",
  "mime",
  "storage_key",
  "thumbnail_url",
  "poster_url",
  "src",
  "public_id",
]);

const OBJECTIVE_BLOCK_TYPES = new Set(["quiz", "gapfill", "find_mistake", "matching"]);
const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i;

const normalizeText = (value = "") => String(value ?? "").trim();

const toPlainObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const stripHtml = (value = "") =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const dedupeLines = (items = []) => {
  const seen = new Set();
  const output = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    const normalized = stripHtml(item);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    output.push(normalized);
  });
  return output;
};

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

const normalizeBlockType = (value = "") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!normalized) return "";
  if (normalized === "quizz" || normalized === "quizs" || normalized === "quizzes") return "quiz";
  if (normalized === "gap_fill" || normalized === "gap_filling") return "gapfill";
  if (normalized === "findmistake" || normalized === "find_mistakes") return "find_mistake";
  return normalized;
};

const sortBlocksByOrder = (blocks = []) =>
  (Array.isArray(blocks) ? blocks : [])
    .map((block, index) => ({
      ...block,
      __source_index: index,
      __order: Number.isFinite(Number(block?.order)) ? Number(block.order) : index,
    }))
    .sort((left, right) =>
      left.__order === right.__order
        ? left.__source_index - right.__source_index
        : left.__order - right.__order)
    .map(({ __source_index, __order, ...block }) => block);

const resolveInputTypeFromTask = (task = {}) => {
  if (task?.requires_audio) return "audio";
  if (task?.requires_image) return "image";
  if (task?.requires_text) return "text";
  return null;
};

const buildLegacyBlocksFromTask = (task = {}) => {
  const blocks = [];
  const instructionText = normalizeText(task?.instruction);
  if (instructionText) {
    blocks.push({
      type: "instruction",
      order: blocks.length,
      data: { text: instructionText },
    });
  }

  const inputType = resolveInputTypeFromTask(task);
  if (inputType) {
    blocks.push({
      type: "input",
      order: blocks.length,
      data: { input_type: inputType },
    });
  }

  if (normalizeText(task?.resource_mode).toLowerCase() === "internal") {
    blocks.push({
      type: "internal",
      order: blocks.length,
      data: {
        resource_ref_type: normalizeText(task?.resource_ref_type),
        resource_ref_id: normalizeText(task?.resource_ref_id),
      },
    });
  }

  const resourceMode = normalizeText(task?.resource_mode).toLowerCase();
  if ((resourceMode === "external_url" || resourceMode === "uploaded") && normalizeText(task?.resource_url)) {
    blocks.push({
      type: "video",
      order: blocks.length,
      data: { url: normalizeText(task?.resource_url) },
    });
  }

  return blocks;
};

const getRenderableTaskBlocks = (task = {}) => {
  const taskBlocks = sortBlocksByOrder(Array.isArray(task?.content_blocks) ? task.content_blocks : []);
  if (taskBlocks.length > 0) return taskBlocks;
  return sortBlocksByOrder(buildLegacyBlocksFromTask(task));
};

const lessonToTask = (lesson = {}, fallbackOrder = 0) => ({
  _id: lesson?._id || null,
  title: normalizeText(lesson?.name || lesson?.title || `Task ${fallbackOrder + 1}`),
  instruction: normalizeText(lesson?.instruction),
  order: Number.isFinite(Number(lesson?.order)) ? Number(lesson.order) : fallbackOrder,
  resource_mode: normalizeText(lesson?.resource_mode || "internal"),
  resource_ref_type: normalizeText(lesson?.resource_ref_type),
  resource_ref_id: normalizeText(lesson?.resource_ref_id),
  resource_url: normalizeText(lesson?.resource_url),
  requires_text: Boolean(lesson?.requires_text),
  requires_image: Boolean(lesson?.requires_image),
  requires_audio: Boolean(lesson?.requires_audio),
  content_blocks: Array.isArray(lesson?.content_blocks) ? lesson.content_blocks : [],
});

const getAssignmentTasks = (assignment = {}) => {
  const sections = Array.isArray(assignment?.sections) ? assignment.sections : [];
  if (sections.length > 0) {
    const tasks = [];
    sections.forEach((section) => {
      const lessons = Array.isArray(section?.lessons) ? section.lessons : [];
      lessons.forEach((lesson, lessonIndex) => {
        tasks.push(lessonToTask(lesson, lessonIndex));
      });
    });
    return tasks;
  }

  return (Array.isArray(assignment?.tasks) ? assignment.tasks : []).map((task, index) => ({
    ...task,
    title: normalizeText(task?.title || task?.name || `Task ${index + 1}`),
    instruction: normalizeText(task?.instruction),
    content_blocks: Array.isArray(task?.content_blocks) ? task.content_blocks : [],
  }));
};

const resolveSubmissionTask = ({ assignment, submission }) => {
  const tasks = getAssignmentTasks(assignment);
  const taskId = normalizeText(submission?.task_id);
  if (taskId) {
    const byId = tasks.find((task) => normalizeText(task?._id) === taskId);
    if (byId) return byId;
  }
  if (tasks.length === 1) return tasks[0];
  return null;
};

const resolveTaskBlockId = (block = {}, fallbackIndex = 0, prefix = "block") =>
  normalizeText(block?.data?.block_id || block?.id || block?.clientId || block?._id || "")
  || `${prefix}-${fallbackIndex + 1}`;

const extractTextFragments = (value, { parentKey = "" } = {}) => {
  if (value === undefined || value === null) return [];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const normalized = stripHtml(value);
    return normalized ? [normalized] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => extractTextFragments(item, { parentKey }));
  }
  if (typeof value !== "object") return [];

  const output = [];
  Object.entries(value).forEach(([key, nested]) => {
    const normalizedKey = normalizeText(key).toLowerCase();
    if (MEDIA_KEY_BLOCKLIST.has(normalizedKey)) return;
    output.push(...extractTextFragments(nested, { parentKey: normalizedKey || parentKey }));
  });
  return output;
};

const blockDataToText = (data = {}) => dedupeLines(extractTextFragments(data)).join("\n");

const normalizeQuizOption = (option = {}, optionIndex = 0) => ({
  id: normalizeText(option?.id) || `option-${optionIndex + 1}`,
  text: stripHtml(option?.text || option?.label || option),
});

const normalizeQuizQuestion = (question = {}, questionIndex = 0) => {
  const normalizedQuestion =
    question && typeof question === "object" && !Array.isArray(question) ? question : {};
  const options = (Array.isArray(normalizedQuestion?.options) ? normalizedQuestion.options : [])
    .map((option, optionIndex) => normalizeQuizOption(option, optionIndex))
    .filter((option) => option.id);
  return {
    id: normalizeText(normalizedQuestion?.id) || `question-${questionIndex + 1}`,
    text: stripHtml(
      normalizedQuestion?.question
      || normalizedQuestion?.text
      || normalizedQuestion?.question_html
      || normalizedQuestion?.prompt
      || "",
    ),
    options,
  };
};

const resolveQuizQuestions = (block = {}) => {
  const blockData = toPlainObject(block?.data);
  if (Array.isArray(blockData?.questions) && blockData.questions.length > 0) {
    return blockData.questions
      .map((question, questionIndex) => normalizeQuizQuestion(question, questionIndex))
      .filter((question) => question.text || question.options.length > 0);
  }

  const hasLegacyQuestion =
    normalizeText(blockData?.question || blockData?.text || blockData?.prompt || blockData?.question_html)
    || (Array.isArray(blockData?.options) && blockData.options.length > 0);
  if (!hasLegacyQuestion) return [];

  return [
    normalizeQuizQuestion(
      {
        id: normalizeText(blockData?.id) || "question-1",
        question: blockData?.question || blockData?.text || blockData?.question_html || blockData?.prompt || "",
        options: Array.isArray(blockData?.options) ? blockData.options : [],
      },
      0,
    ),
  ];
};

const normalizeObjectiveAnswerEntries = (entries = [], keyField, valueField) => {
  const entryMap = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const key = normalizeText(entry?.[keyField]);
    const value = normalizeText(entry?.[valueField]);
    if (!key || !value) return;
    entryMap.set(key, { [keyField]: key, [valueField]: value });
  });
  return Array.from(entryMap.values());
};

const normalizeMatchingObjectiveAnswerEntries = (entries = []) => {
  const blockMap = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const blockKey = normalizeText(
      entry?.block_key
      || entry?.blockKey
      || entry?.block_id
      || entry?.blockId
      || entry?.key,
    );
    if (!blockKey) return;

    const rawPairs = Array.isArray(entry?.matches)
      ? entry.matches
      : Array.isArray(entry?.pairs)
        ? entry.pairs
        : [];
    const candidatePairs = rawPairs.length > 0 ? rawPairs : [entry];
    const pairMap = new Map();

    candidatePairs.forEach((pair) => {
      const leftId = normalizeText(pair?.left_id || pair?.leftId || pair?.from);
      const rightId = normalizeText(pair?.right_id || pair?.rightId || pair?.to);
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

export const normalizeObjectiveAnswersFromMeta = (meta = {}) => {
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
    : Array.isArray(objectiveAnswers.table_matching)
      ? objectiveAnswers.table_matching
      : Array.isArray(normalizedMeta.matching_answers)
        ? normalizedMeta.matching_answers
        : [];

  return {
    quiz: normalizeObjectiveAnswerEntries(
      rawQuiz.map((entry) => ({
        question_key: normalizeText(entry?.question_key || entry?.questionKey || entry?.key),
        selected_option_id: normalizeText(
          entry?.selected_option_id
          || entry?.selectedOptionId
          || entry?.option_id
          || entry?.value,
        ),
      })),
      "question_key",
      "selected_option_id",
    ),
    gapfill: normalizeObjectiveAnswerEntries(
      rawGapfill.map((entry) => ({
        blank_key: normalizeText(entry?.blank_key || entry?.blankKey || entry?.key),
        value: normalizeText(entry?.value || entry?.answer || entry?.text),
      })),
      "blank_key",
      "value",
    ),
    find_mistake: normalizeObjectiveAnswerEntries(
      rawFindMistake.map((entry) => ({
        line_key: normalizeText(entry?.line_key || entry?.lineKey || entry?.key),
        token_key: normalizeText(entry?.token_key || entry?.tokenKey || entry?.value),
      })),
      "line_key",
      "token_key",
    ),
    matching: normalizeMatchingObjectiveAnswerEntries(rawMatching),
  };
};

const buildObjectiveAnswerText = ({ objectiveAnswers, promptBlocks }) => {
  const lines = [];
  const quizQuestionLabelMap = new Map();
  const quizOptionLabelMap = new Map();
  const matchingLeftLabelMap = new Map();
  const matchingRightLabelMap = new Map();

  (Array.isArray(promptBlocks) ? promptBlocks : []).forEach((block, blockIndex) => {
    const blockType = normalizeBlockType(block?.type);
    const blockId = resolveTaskBlockId(block, blockIndex, "objective");
    const blockData = toPlainObject(block?.data);

    if (blockType === "quiz") {
      const questions = resolveQuizQuestions(block);
      questions.forEach((question, questionIndex) => {
        const questionId = normalizeText(question?.id) || `question-${questionIndex + 1}`;
        const questionKey = `${blockId}:${questionId}`;
        const questionLabel = normalizeText(question?.text) || `Question ${questionIndex + 1}`;
        quizQuestionLabelMap.set(questionKey, questionLabel);

        (Array.isArray(question?.options) ? question.options : []).forEach((option, optionIndex) => {
          const optionId = normalizeText(option?.id) || `option-${optionIndex + 1}`;
          const optionLabel = normalizeText(option?.text) || optionId;
          quizOptionLabelMap.set(`${questionKey}:${optionId}`, optionLabel);
        });
      });
    }

    if (blockType === "matching") {
      const leftItems = Array.isArray(blockData?.left_items) ? blockData.left_items : [];
      const rightItems = Array.isArray(blockData?.right_items) ? blockData.right_items : [];

      leftItems.forEach((item, itemIndex) => {
        const itemId = normalizeText(item?.id) || `left-${itemIndex + 1}`;
        const itemText = stripHtml(item?.text || itemId) || itemId;
        matchingLeftLabelMap.set(`${blockId}:${itemId}`, itemText);
      });

      rightItems.forEach((item, itemIndex) => {
        const itemId = normalizeText(item?.id) || `right-${itemIndex + 1}`;
        const itemText = stripHtml(item?.text || itemId) || itemId;
        matchingRightLabelMap.set(`${blockId}:${itemId}`, itemText);
      });
    }
  });

  (Array.isArray(objectiveAnswers?.quiz) ? objectiveAnswers.quiz : []).forEach((entry) => {
    const questionKey = normalizeText(entry?.question_key);
    const optionId = normalizeText(entry?.selected_option_id);
    if (!questionKey || !optionId) return;
    const questionLabel = quizQuestionLabelMap.get(questionKey) || questionKey;
    const optionLabel = quizOptionLabelMap.get(`${questionKey}:${optionId}`) || optionId;
    lines.push(`Quiz - ${questionLabel}: ${optionLabel}`);
  });

  (Array.isArray(objectiveAnswers?.gapfill) ? objectiveAnswers.gapfill : []).forEach((entry) => {
    const blankKey = normalizeText(entry?.blank_key);
    const value = stripHtml(entry?.value);
    if (!blankKey || !value) return;
    lines.push(`Gapfill - ${blankKey}: ${value}`);
  });

  (Array.isArray(objectiveAnswers?.find_mistake) ? objectiveAnswers.find_mistake : []).forEach((entry) => {
    const lineKey = normalizeText(entry?.line_key);
    const tokenKey = normalizeText(entry?.token_key);
    if (!lineKey || !tokenKey) return;
    lines.push(`Find Mistake - ${lineKey}: ${tokenKey}`);
  });

  (Array.isArray(objectiveAnswers?.matching) ? objectiveAnswers.matching : []).forEach((entry) => {
    const blockKey = normalizeText(entry?.block_key);
    const matches = Array.isArray(entry?.matches) ? entry.matches : [];
    matches.forEach((pair, pairIndex) => {
      const leftId = normalizeText(pair?.left_id);
      const rightId = normalizeText(pair?.right_id);
      if (!leftId || !rightId) return;
      const leftText = matchingLeftLabelMap.get(`${blockKey}:${leftId}`) || leftId;
      const rightText = matchingRightLabelMap.get(`${blockKey}:${rightId}`) || rightId;
      lines.push(`Matching - ${blockKey} - Pair ${pairIndex + 1}: ${leftText} -> ${rightText}`);
    });
  });

  return dedupeLines(lines).join("\n");
};

const serializePromptBlocks = (promptBlocks = []) => {
  const lines = [];
  (Array.isArray(promptBlocks) ? promptBlocks : []).forEach((block, blockIndex) => {
    const blockType = normalizeBlockType(block?.type);
    const blockData = toPlainObject(block?.data);
    const blockLabel = normalizeText(blockType || block?.type) || `block-${blockIndex + 1}`;
    const blockText = blockDataToText(blockData);

    if (blockType === "internal") {
      const resourceRefType = normalizeText(blockData?.resource_ref_type);
      const resourceRefId = normalizeText(blockData?.resource_ref_id);
      if (resourceRefType && resourceRefId) {
        lines.push(`Internal resource: ${resourceRefType} - ${resourceRefId}`);
      } else if (blockText) {
        lines.push(blockText);
      }
      return;
    }

    if (blockType === "quiz") {
      const questions = resolveQuizQuestions(block);
      if (questions.length > 0) {
        lines.push("Quiz:");
        questions.forEach((question, questionIndex) => {
          const questionText = normalizeText(question?.text) || `Question ${questionIndex + 1}`;
          lines.push(`- Q${questionIndex + 1}: ${questionText}`);
          const options = Array.isArray(question?.options) ? question.options : [];
          if (options.length > 0) {
            const optionText = options
              .map((option, optionIndex) => {
                const optionLabel = String.fromCharCode(65 + optionIndex);
                return `${optionLabel}. ${normalizeText(option?.text || option?.id || "")}`;
              })
              .filter(Boolean)
              .join(" | ");
            if (optionText) lines.push(`Options: ${optionText}`);
          }
        });
      }
      return;
    }

    if (blockType === "matching") {
      const leftItems = Array.isArray(blockData?.left_items) ? blockData.left_items : [];
      const rightItems = Array.isArray(blockData?.right_items) ? blockData.right_items : [];
      const prompt = normalizeText(blockData?.prompt);
      if (prompt) lines.push(`Table Matching prompt: ${prompt}`);

      const rowCount = Math.max(leftItems.length, rightItems.length);
      for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
        const leftText = stripHtml(leftItems[rowIndex]?.text || "");
        const rightText = stripHtml(rightItems[rowIndex]?.text || "");
        if (!leftText && !rightText) continue;
        lines.push(`Row ${rowIndex + 1}: ${leftText || "--"} | ${rightText || "--"}`);
      }
      return;
    }

    if (!blockText) return;
    if (["title", "instruction", "passage", "gapfill", "find_mistake", "dictation", "input"].includes(blockType)) {
      lines.push(blockText);
      return;
    }
    lines.push(`${blockLabel}: ${blockText}`);
  });

  return dedupeLines(lines).join("\n");
};

const serializeReferenceAnswerBlocks = (answerBlocks = []) => {
  const lines = [];
  (Array.isArray(answerBlocks) ? answerBlocks : []).forEach((block) => {
    const blockData = toPlainObject(block?.data);
    const text = normalizeText(blockData?.text) || blockDataToText(blockData);
    if (!text) return;
    lines.push(text);
  });
  return dedupeLines(lines).join("\n\n");
};

const resolveEligibleAudioItem = (audioItem = null) => {
  const candidate = audioItem && typeof audioItem === "object" ? audioItem : null;
  const url = normalizeText(candidate?.url);
  const mime = normalizeText(candidate?.mime).toLowerCase();
  if (!url || !mime || !mime.startsWith("audio/")) return null;
  return {
    url,
    mime,
    size: Number.isFinite(Number(candidate?.size)) ? Number(candidate.size) : null,
  };
};

const resolveEligibleImageItem = (imageItem = null) => {
  const candidate = imageItem && typeof imageItem === "object" ? imageItem : null;
  const url = normalizeText(candidate?.url);
  if (!url) return null;

  const mime = normalizeText(candidate?.mime).toLowerCase();
  const isImageMime = mime.startsWith("image/");
  const isImageByExtension = IMAGE_EXTENSION_PATTERN.test(url);
  if (!isImageMime && !isImageByExtension) return null;

  return {
    url,
    mime: isImageMime ? mime : "",
    size: Number.isFinite(Number(candidate?.size)) ? Number(candidate.size) : null,
  };
};

const resolveEligibleImageItems = (imageItems = []) => {
  const seen = new Set();
  const output = [];

  (Array.isArray(imageItems) ? imageItems : []).forEach((item) => {
    const normalized = resolveEligibleImageItem(item);
    if (!normalized?.url || seen.has(normalized.url)) return;
    seen.add(normalized.url);
    output.push(normalized);
  });

  return output;
};

const createHttpError = (message, { statusCode = 400, code = "BAD_REQUEST" } = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

const countObjectiveAnswers = (objectiveAnswers = {}) =>
  Number(Array.isArray(objectiveAnswers?.quiz) ? objectiveAnswers.quiz.length : 0)
  + Number(Array.isArray(objectiveAnswers?.gapfill) ? objectiveAnswers.gapfill.length : 0)
  + Number(Array.isArray(objectiveAnswers?.find_mistake) ? objectiveAnswers.find_mistake.length : 0)
  + Number(
    (Array.isArray(objectiveAnswers?.matching) ? objectiveAnswers.matching : []).reduce(
      (sum, entry) => sum + Number(Array.isArray(entry?.matches) ? entry.matches.length : 0),
      0,
    ),
  );

export const buildHomeworkAiReviewPayload = ({ submission, assignment, student } = {}) => {
  const normalizedSubmission = toPlainObject(submission);
  const normalizedAssignment = toPlainObject(assignment);
  const normalizedStudent = toPlainObject(student);

  const task = resolveSubmissionTask({
    assignment: normalizedAssignment,
    submission: normalizedSubmission,
  });
  if (!task) {
    throw createHttpError("Task not found for this submission", {
      statusCode: 404,
      code: "NOT_FOUND",
    });
  }

  const taskBlocks = getRenderableTaskBlocks(task);
  const answerBlocks = taskBlocks.filter((block) => normalizeBlockType(block?.type) === "answer");
  const promptBlocks = taskBlocks.filter((block) => normalizeBlockType(block?.type) !== "answer");

  const assignmentTitle = normalizeText(normalizedAssignment?.title);
  const taskTitle = normalizeText(task?.title || task?.name);
  const taskInstruction = normalizeText(task?.instruction);
  const promptFromBlocks = serializePromptBlocks(promptBlocks);
  const promptText = dedupeLines([
    assignmentTitle ? `Assignment: ${assignmentTitle}` : "",
    taskTitle ? `Task: ${taskTitle}` : "",
    taskInstruction,
    promptFromBlocks,
  ]).join("\n\n");

  const referenceAnswerText = serializeReferenceAnswerBlocks(answerBlocks);
  const studentTextAnswer = stripHtml(normalizedSubmission?.text_answer || "");
  const objectiveAnswers = normalizeObjectiveAnswersFromMeta(normalizedSubmission?.meta);
  const objectiveAnswerText = buildObjectiveAnswerText({
    objectiveAnswers,
    promptBlocks: promptBlocks.filter((block) => OBJECTIVE_BLOCK_TYPES.has(normalizeBlockType(block?.type))),
  });
  const audioItem = resolveEligibleAudioItem(normalizedSubmission?.audio_item);
  const imageItems = resolveEligibleImageItems(normalizedSubmission?.image_items);

  const studentAnswerSegments = [];
  if (studentTextAnswer) {
    studentAnswerSegments.push(`Student text answer:\n${studentTextAnswer}`);
  }
  if (objectiveAnswerText) {
    studentAnswerSegments.push(`Objective answers:\n${objectiveAnswerText}`);
  }
  if (audioItem?.url) {
    studentAnswerSegments.push(`Audio submission URL:\n${audioItem.url}`);
  }
  if (imageItems.length > 0) {
    studentAnswerSegments.push(
      `Image submission URLs:\n${imageItems.map((item, index) => `${index + 1}. ${item.url}`).join("\n")}`,
    );
  }
  const studentAnswerText = studentAnswerSegments.join("\n\n").trim();

  const hasEligibleStudentContent = Boolean(
    studentTextAnswer
    || objectiveAnswerText
    || audioItem?.url
    || imageItems.length > 0,
  );
  if (!hasEligibleStudentContent) {
    throw createHttpError("Submission has no AI-review-eligible content", {
      statusCode: 400,
      code: "BAD_REQUEST",
    });
  }

  return {
    submissionId: normalizeText(normalizedSubmission?._id),
    assignmentId: normalizeText(normalizedSubmission?.assignment_id || normalizedAssignment?._id),
    taskId: normalizeText(normalizedSubmission?.task_id || task?._id),
    studentId: normalizeText(normalizedSubmission?.student_id || normalizedStudent?._id),
    assignmentTitle,
    taskTitle,
    studentName: normalizeText(normalizedStudent?.name),
    promptText,
    referenceAnswerText,
    studentAnswerText,
    studentTextAnswer,
    objectiveAnswerText,
    objectiveAnswers,
    audioItem,
    imageItems,
    meta: {
      has_student_text_answer: Boolean(studentTextAnswer),
      has_objective_answers: Boolean(objectiveAnswerText),
      has_audio_submission: Boolean(audioItem?.url),
      has_image_submission: imageItems.length > 0,
      image_submission_count: imageItems.length,
      objective_answer_count: countObjectiveAnswers(objectiveAnswers),
      prompt_block_count: promptBlocks.length,
      answer_block_count: answerBlocks.length,
    },
  };
};
