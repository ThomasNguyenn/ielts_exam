import { normalizeTaskBlockType } from './myHomeworkStudentUtils';

const MEDIA_KEY_BLOCKLIST = new Set([
  'url',
  'audio_url',
  'image_url',
  'video_url',
  'mime',
  'storage_key',
  'thumbnail_url',
  'poster_url',
  'src',
]);

const HTML_TAG_PATTERN = /<[^>]*>/g;

const toPlainText = (value = '') =>
  String(value || '')
    .replace(HTML_TAG_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isSerializablePrimitive = (value) =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

const extractTextFragments = (value, context = { parentKey: '' }) => {
  if (value === null || value === undefined) return [];

  if (isSerializablePrimitive(value)) {
    const normalized = toPlainText(value);
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractTextFragments(item, context));
  }

  if (typeof value !== 'object') return [];

  const entries = Object.entries(value);
  const output = [];

  entries.forEach(([key, nested]) => {
    const normalizedKey = String(key || '').trim().toLowerCase();
    if (MEDIA_KEY_BLOCKLIST.has(normalizedKey)) return;
    output.push(...extractTextFragments(nested, { parentKey: normalizedKey }));
  });

  return output;
};

const dedupeLines = (items = []) => {
  const set = new Set();
  const output = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    const normalized = toPlainText(item);
    if (!normalized || set.has(normalized)) return;
    set.add(normalized);
    output.push(normalized);
  });
  return output;
};

const blockToText = (block = {}) => {
  const type = normalizeTaskBlockType(block?.type);
  const data = block && typeof block.data === 'object' && !Array.isArray(block.data) ? block.data : {};

  if (type === 'video' || type === 'image') {
    return '';
  }

  const fragments = dedupeLines(extractTextFragments(data));
  if (fragments.length === 0) return '';
  return fragments.join('\n');
};

const buildBlockText = (blocks = []) =>
  dedupeLines((Array.isArray(blocks) ? blocks : []).map((block) => blockToText(block)).filter(Boolean)).join('\n\n');

const normalizeQuizQuestions = (block = {}) => {
  const data = block && typeof block.data === 'object' && !Array.isArray(block.data) ? block.data : {};
  const rawQuestions = Array.isArray(data.questions) && data.questions.length > 0
    ? data.questions
    : [{
      id: data.id || 'legacy-question',
      question: data.question || data.text || data.question_html || data.prompt || '',
      options: Array.isArray(data.options) ? data.options : [],
    }];

  return rawQuestions.map((question, questionIndex) => {
    const questionId = String(question?.id || '').trim() || `question-${questionIndex + 1}`;
    const questionText = toPlainText(question?.question || question?.text || question?.question_html || question?.prompt || '');
    const options = (Array.isArray(question?.options) ? question.options : []).map((option, optionIndex) => ({
      id: String(option?.id || '').trim() || `option-${optionIndex + 1}`,
      text: toPlainText(option?.text || option?.label || option),
    }));

    return {
      id: questionId,
      text: questionText,
      options,
    };
  });
};

const buildObjectiveText = ({ objectiveBlocks, objectiveAnswerMaps }) => {
  const lines = [];
  const quizByQuestionKey = objectiveAnswerMaps?.quizByQuestionKey || {};
  const gapfillByBlankKey = objectiveAnswerMaps?.gapfillByBlankKey || {};
  const findMistakeByLineKey = objectiveAnswerMaps?.findMistakeByLineKey || {};
  const matchingByBlockKey = objectiveAnswerMaps?.matchingByBlockKey || {};

  const quizOptionMap = new Map();
  const quizQuestionLabelMap = new Map();
  const matchingLeftMap = new Map();
  const matchingRightMap = new Map();

  (Array.isArray(objectiveBlocks) ? objectiveBlocks : []).forEach((block, blockIndex) => {
    const blockType = normalizeTaskBlockType(block?.type);
    const blockData = block && typeof block.data === 'object' && !Array.isArray(block.data) ? block.data : {};
    const blockId = String(blockData?.block_id || block?.id || `objective-${blockIndex + 1}`).trim() || `objective-${blockIndex + 1}`;

    if (blockType === 'quiz') {
      const questions = normalizeQuizQuestions(block);
      questions.forEach((question, questionIndex) => {
        const questionKey = `${blockId}:${question.id || `question-${questionIndex + 1}`}`;
        quizQuestionLabelMap.set(questionKey, question.text || `Question ${questionIndex + 1}`);
        question.options.forEach((option) => {
          quizOptionMap.set(`${questionKey}:${option.id}`, option.text || option.id);
        });
      });
    }

    if (blockType === 'matching') {
      const leftItems = Array.isArray(blockData?.left_items) ? blockData.left_items : [];
      const rightItems = Array.isArray(blockData?.right_items) ? blockData.right_items : [];

      leftItems.forEach((item) => {
        const id = String(item?.id || '').trim();
        if (!id) return;
        matchingLeftMap.set(`${blockId}:${id}`, toPlainText(item?.text || id) || id);
      });

      rightItems.forEach((item) => {
        const id = String(item?.id || '').trim();
        if (!id) return;
        matchingRightMap.set(`${blockId}:${id}`, toPlainText(item?.text || id) || id);
      });
    }
  });

  Object.entries(quizByQuestionKey).forEach(([questionKey, optionId]) => {
    const normalizedQuestionKey = String(questionKey || '').trim();
    const normalizedOptionId = String(optionId || '').trim();
    if (!normalizedQuestionKey || !normalizedOptionId) return;

    const questionLabel = quizQuestionLabelMap.get(normalizedQuestionKey) || normalizedQuestionKey;
    const optionLabel = quizOptionMap.get(`${normalizedQuestionKey}:${normalizedOptionId}`) || normalizedOptionId;
    lines.push(`Quiz - ${questionLabel}: ${optionLabel}`);
  });

  Object.entries(gapfillByBlankKey).forEach(([blankKey, value]) => {
    const normalizedBlankKey = String(blankKey || '').trim();
    const normalizedValue = toPlainText(value);
    if (!normalizedBlankKey || !normalizedValue) return;
    lines.push(`Gapfill - ${normalizedBlankKey}: ${normalizedValue}`);
  });

  Object.entries(findMistakeByLineKey).forEach(([lineKey, tokenKey]) => {
    const normalizedLineKey = String(lineKey || '').trim();
    const normalizedTokenKey = toPlainText(tokenKey);
    if (!normalizedLineKey || !normalizedTokenKey) return;
    lines.push(`Find Mistake - ${normalizedLineKey}: ${normalizedTokenKey}`);
  });

  Object.entries(matchingByBlockKey).forEach(([blockKey, matches]) => {
    const normalizedBlockKey = String(blockKey || '').trim();
    const pairs = Array.isArray(matches) ? matches : [];
    pairs.forEach((pair, pairIndex) => {
      const leftId = String(pair?.left_id || pair?.leftId || '').trim();
      const rightId = String(pair?.right_id || pair?.rightId || '').trim();
      if (!leftId || !rightId) return;
      const leftLabel = matchingLeftMap.get(`${normalizedBlockKey}:${leftId}`) || leftId;
      const rightLabel = matchingRightMap.get(`${normalizedBlockKey}:${rightId}`) || rightId;
      lines.push(`Matching - ${normalizedBlockKey} - Pair ${pairIndex + 1}: ${leftLabel} -> ${rightLabel}`);
    });
  });

  return dedupeLines(lines).join('\n');
};

const resolveAudioUrl = (submission = {}) => {
  const audioItem = submission?.audio_item && typeof submission.audio_item === 'object'
    ? submission.audio_item
    : null;
  const rawUrl = String(audioItem?.url || '').trim();
  if (!rawUrl) return '';

  const mime = String(audioItem?.mime || '').trim().toLowerCase();
  if (mime && !mime.startsWith('audio/')) {
    return '';
  }

  return rawUrl;
};

export const buildAiReviewPayload = ({
  assignment,
  payload,
  promptBlocks,
  answerBlocks,
  submission,
  objectiveBlocks,
  objectiveAnswerMaps,
}) => {
  const promptText = buildBlockText(promptBlocks);
  const referenceAnswerText = buildBlockText(answerBlocks);
  const studentText = toPlainText(submission?.text_answer || '');
  const objectiveText = buildObjectiveText({ objectiveBlocks, objectiveAnswerMaps });
  const audioUrl = resolveAudioUrl(submission);

  const hasPrompt = Boolean(promptText);
  const hasStudentText = Boolean(studentText);
  const hasAudio = Boolean(audioUrl);
  const hasObjective = Boolean(objectiveText);
  const hasStudentData = Boolean(hasStudentText || hasAudio || hasObjective);

  const requestPayload = {
    assignmentTitle: String(assignment?.title || '').trim(),
    testTitle: String(payload?.test_title || '').trim(),
    promptText,
    referenceAnswerText,
    studentAnswer: {
      text: studentText,
      audioUrl,
      objectiveText,
    },
  };

  let disabledReason = '';
  if (!hasStudentData && !hasPrompt) {
    disabledReason = 'No prompt and no eligible student answer (text/audio/objective).';
  } else if (!hasStudentData) {
    disabledReason = 'Student submission has no eligible text/audio/objective data for AI review.';
  }

  return {
    payload: requestPayload,
    canSubmit: hasStudentData,
    disabledReason,
    meta: {
      hasPrompt,
      hasStudentText,
      hasAudio,
      hasObjective,
      hasStudentData,
    },
  };
};

export const normalizeAiReviewOutput = (result) => {
  if (result === null || result === undefined) return '';
  if (typeof result === 'string') return result.trim();

  if (typeof result === 'object') {
    const lines = [];
    const summary = toPlainText(result?.summary || result?.overview || '');
    const strengths = dedupeLines(Array.isArray(result?.strengths) ? result.strengths : []);
    const issues = dedupeLines(Array.isArray(result?.issues) ? result.issues : []);
    const suggestions = dedupeLines(
      Array.isArray(result?.actionable_suggestions)
        ? result.actionable_suggestions
        : (Array.isArray(result?.suggestions) ? result.suggestions : []),
    );
    const feedback = dedupeLines(Array.isArray(result?.feedback) ? result.feedback : []);
    const reviewText = toPlainText(result?.review || result?.general_feedback || '');

    const scoreSource = result?.score_estimate && typeof result.score_estimate === 'object'
      ? result.score_estimate
      : (result?.scores && typeof result.scores === 'object' ? result.scores : {});
    const overall = Number(scoreSource?.overall);
    const taskCompletion = Number(scoreSource?.task_completion ?? scoreSource?.taskResponse ?? scoreSource?.task_response);
    const accuracy = Number(scoreSource?.accuracy);
    const language = Number(scoreSource?.language ?? scoreSource?.language_use);

    const scoreParts = [];
    if (Number.isFinite(overall)) scoreParts.push(`Overall ${overall}`);
    if (Number.isFinite(taskCompletion)) scoreParts.push(`Task ${taskCompletion}`);
    if (Number.isFinite(accuracy)) scoreParts.push(`Accuracy ${accuracy}`);
    if (Number.isFinite(language)) scoreParts.push(`Language ${language}`);
    if (scoreParts.length > 0) {
      lines.push(`Score Estimate: ${scoreParts.join(' | ')}`);
    }

    if (summary) {
      lines.push(`Tóm tắt: ${summary}`);
    }

    if (strengths.length > 0) {
      lines.push('Điểm mạnh:');
      strengths.forEach((item) => lines.push(`- ${item}`));
    }

    if (issues.length > 0) {
      lines.push('Lỗi cần cải thiện:');
      issues.forEach((item) => lines.push(`- ${item}`));
    }

    if (suggestions.length > 0) {
      lines.push('Gợi ý hành động:');
      suggestions.forEach((item) => lines.push(`- ${item}`));
    }

    if (feedback.length > 0) {
      lines.push('Nhận xét:');
      feedback.forEach((item) => lines.push(`- ${item}`));
    }

    if (reviewText) {
      lines.push(`Tổng kết: ${reviewText}`);
    }

    const merged = lines.join('\n').trim();
    if (merged) return merged;
    return JSON.stringify(result, null, 2);
  }

  return String(result || '').trim();
};
