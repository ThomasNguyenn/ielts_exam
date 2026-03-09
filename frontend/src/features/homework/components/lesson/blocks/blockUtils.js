export const cx = (...values) => values.filter(Boolean).join(" ");

const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*>/i;

export const isHtmlLike = (value) => HTML_TAG_PATTERN.test(String(value || ""));

export const countWords = (value = "") => {
  const matches = String(value || "").trim().match(/\S+/g);
  return matches ? matches.length : 0;
};

export const resolveTaskBlockId = (block = {}) =>
  String(block?.data?.block_id || block?.id || block?.clientId || block?._id || "").trim();

export const normalizeBlockId = (value) => String(value || "").trim();

export const resolveInternalBlockData = (block = {}) =>
  block?.data && typeof block.data === "object" && !Array.isArray(block.data) ? block.data : {};

export const resolveInternalSlotKeyFromBlock = (block = {}, fallbackIndex = 0) => {
  const data = resolveInternalBlockData(block);
  const configured = String(data?.resource_slot_key || "").trim();
  if (configured) return configured;
  const blockId = resolveTaskBlockId(block);
  if (blockId) return `block:${blockId}`;
  return `block:internal-${fallbackIndex + 1}`;
};

export const resolveQuizParentPassageBlockId = (block = {}) =>
  String(block?.data?.parent_passage_block_id || "").trim();

export const resolveQuizLayout = (block = {}) => {
  const normalized = String(block?.data?.layout || "").trim().toLowerCase();
  return normalized === "list" ? "list" : "grid";
};

export const MATCH_COLOR_TOKENS = ["emerald", "sky", "amber", "fuchsia", "teal", "rose", "indigo", "lime"];

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

export const resolveMatchColorToken = (value, fallbackIndex = 0) => {
  const normalized = String(value || "").trim();
  if (MATCH_COLOR_TOKENS.includes(normalized)) return normalized;
  return MATCH_COLOR_TOKENS[fallbackIndex % MATCH_COLOR_TOKENS.length];
};

export const resolveMatchColorClass = (value, fallbackIndex = 0) =>
  MATCH_COLOR_CLASSES[resolveMatchColorToken(value, fallbackIndex)] || MATCH_COLOR_CLASSES.emerald;

const resolveFirstNonEmptyString = (...values) => {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
};

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
    question: resolveFirstNonEmptyString(
      normalizedQuestion.question,
      normalizedQuestion.text,
      normalizedQuestion.question_html,
      normalizedQuestion.prompt,
    ),
    options,
  };
};

export const buildQuizQuestionKey = ({ blockId, questionId, questionIndex = 0 }) => {
  const normalizedBlockId = String(blockId || "quiz").trim() || "quiz";
  const normalizedQuestionId = String(questionId || "").trim() || `question-${questionIndex + 1}`;
  return `${normalizedBlockId}:${normalizedQuestionId}`;
};

export const resolveQuizQuestions = (block = {}) => {
  const quizData =
    block?.data && typeof block.data === "object" && !Array.isArray(block.data) ? block.data : {};
  if (Array.isArray(quizData.questions) && quizData.questions.length > 0) {
    return quizData.questions
      .map((question, questionIndex) => normalizeQuizQuestion(question, questionIndex))
      .filter((question) => question.question || question.options.length > 0);
  }

  const hasLegacyQuestion = Boolean(
    resolveFirstNonEmptyString(quizData.question, quizData.text, quizData.question_html, quizData.prompt),
  ) || (Array.isArray(quizData.options) && quizData.options.length > 0);
  if (!hasLegacyQuestion) return [];

  return [
    normalizeQuizQuestion(
      {
        id: String(quizData.id || "").trim() || "legacy-question",
        question: resolveFirstNonEmptyString(
          quizData.question,
          quizData.text,
          quizData.question_html,
          quizData.prompt,
        ),
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

export const normalizeMatchingPairData = (pair = {}, fallbackIndex = 0) => ({
  left_id: normalizeBlockId(pair?.left_id),
  right_id: normalizeBlockId(pair?.right_id),
  color_key: resolveMatchColorToken(pair?.color_key, fallbackIndex),
});

export const resolveMatchingData = (block = {}) => {
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

export const normalizeDictationBlockData = (data = {}) => {
  const normalizedData =
    data && typeof data === "object" && !Array.isArray(data) ? data : {};
  return {
    prompt: String(normalizedData.prompt || "").trim(),
    audio_url: String(normalizedData.audio_url || normalizedData.url || "").trim(),
  };
};


