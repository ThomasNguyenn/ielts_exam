export const resolveRequestedStepIndex = (search, steps) => {
  const params = new URLSearchParams(search);
  const partParam = params.get('part');
  if (partParam === null || steps.length === 0) return 0;

  const requestedPartIndex = Number.parseInt(partParam, 10);
  if (!Number.isFinite(requestedPartIndex)) return 0;

  const maxStep = steps.length - 1;
  const normalizedPartIndex =
    requestedPartIndex > maxStep && requestedPartIndex - 1 >= 0 && requestedPartIndex - 1 <= maxStep
      ? requestedPartIndex - 1
      : requestedPartIndex;

  return Math.max(0, Math.min(maxStep, normalizedPartIndex));
};

export const resolveSingleModeDurationMinutes = (step) => {
  const stepType = String(step?.type || '').toLowerCase();
  const stepLabel = String(step?.label || '').toLowerCase();

  if (stepType === 'listening') return 10;
  if (stepType === 'reading') return 20;

  if (stepType === 'writing') {
    if (stepLabel.includes('task 2')) return 40;
    return 20;
  }

  return 60;
};

export const parseExamRouteParams = ({ id, search }) => {
  const searchParams = new URLSearchParams(search || '');
  const hwctx = searchParams.get('hwctx') || '';
  const standaloneTypeFromQuery = searchParams.get('standalone');
  const modeParam = searchParams.get('mode') ?? 'full';
  const partParam = searchParams.get('part');
  const examMode = modeParam === 'single' && partParam !== null ? 'single' : 'full';
  const examPart = partParam ?? 'full';
  const isSingleMode = examMode === 'single';

  const singleModeSearch = (() => {
    if (partParam === null) return '';
    const params = new URLSearchParams();
    params.set('part', partParam);
    return `?${params.toString()}`;
  })();

  const draftKey = `exam-draft:${id}:${examMode}:${examPart}`;

  return {
    hwctx,
    standaloneTypeFromQuery,
    modeParam,
    partParam,
    examMode,
    examPart,
    isSingleMode,
    singleModeSearch,
    draftKey,
  };
};

export const resolveTrackedResourceRefType = (exam) => {
  if (!exam) return 'test';
  if (!exam.is_standalone) return 'test';
  if (exam.type === 'reading') return 'passage';
  if (exam.type === 'listening') return 'section';
  if (exam.type === 'writing') return 'writing';
  return 'test';
};

export const resolveDurationSec = ({ exam, isSingleMode, currentStep }) => {
  const resolvedDurationMinutes = isSingleMode
    ? resolveSingleModeDurationMinutes(currentStep)
    : Number(exam?.duration || 60);
  const safeDurationMinutes = Number.isFinite(resolvedDurationMinutes) && resolvedDurationMinutes > 0
    ? resolvedDurationMinutes
    : 60;
  return Math.max(0, Math.floor(safeDurationMinutes * 60));
};

export const formatTime = (seconds) => {
  const safeSeconds = Math.max(0, Number.isFinite(Number(seconds)) ? Math.floor(Number(seconds)) : 0);
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const formatTimeTaken = (start, end) => {
  const diffMs = Math.max(0, Number(end) - Number(start));
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);

  if (diffMins > 0) {
    return `${diffMins} phút ${diffSecs} giây`;
  }
  return `${diffSecs} giây`;
};

export const getTimeTakenLabel = ({ submitted, startTime }) => {
  if (!submitted) return '';
  if (submitted.timeTaken !== undefined) {
    return formatTimeTaken(0, submitted.timeTaken);
  }
  const now = Date.now();
  return formatTimeTaken(startTime || now, now);
};

export const extractStudentHighlights = (passageStates = {}) => {
  const studentHighlights = [];
  try {
    const tempDiv = document.createElement('div');
    Object.values(passageStates || {}).forEach((html) => {
      if (!html) return;
      tempDiv.innerHTML = html;
      const nodes = tempDiv.querySelectorAll('.ielts-highlight');
      nodes.forEach((node) => {
        const text = String(node.textContent || '').trim();
        if (text && !studentHighlights.includes(text)) {
          studentHighlights.push(text);
        }
      });
    });
  } catch {
    return [];
  }

  return studentHighlights;
};

export const normalizeSubmitResultForSingleMode = ({
  payload,
  isSingleMode,
  currentSingleStep,
}) => {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid submit response');
  }

  let resultData = payload;
  const start = Math.max(0, Number(currentSingleStep?.startSlotIndex));
  const end = Math.max(start, Number(currentSingleStep?.endSlotIndex));

  if (
    isSingleMode
    && currentSingleStep
    && Array.isArray(payload.question_review)
    && Number.isFinite(start)
    && Number.isFinite(end)
    && start < end
    && payload.question_review.length >= end
  ) {
    const partReview = payload.question_review.slice(start, end);

    let partScore = 0;
    let partTotal = 0;

    partReview.forEach((item) => {
      partTotal += 1;
      if (item.is_correct) partScore += 1;
    });

    resultData = {
      ...payload,
      question_review: partReview,
      score: partScore,
      total: partTotal,
      wrong: partTotal - partScore,
      isSingleMode: true,
    };
  }

  return resultData;
};

export const typeToResultLabel = (type) => (
  type === 'mult_choice' ? 'Multiple Choice (One Answer)' :
    type === 'true_false_notgiven' ? 'True - False - Not Given' :
      type === 'yes_no_notgiven' ? 'Yes - No - Not Given' :
        type === 'gap_fill' || type === 'note_completion' ? 'Note/Gap Completion' :
          type === 'matching_headings' ? 'Matching Headings' :
            type === 'matching_features' ? 'Matching Features' :
              type === 'matching_information' ? 'Matching Information' :
                type === 'summary_completion' ? 'Summary Completion' : 'Other'
);

export const normalizeResultStats = ({ submitted }) => {
  const { score, total, wrong, writingCount, isSingleMode } = submitted || {};
  const safeTotal = Number.isFinite(Number(total)) ? Math.max(0, Number(total)) : 0;
  const rawSafeScore = Number.isFinite(Number(score)) ? Math.max(0, Number(score)) : 0;
  const safeScore = safeTotal > 0 ? Math.min(rawSafeScore, safeTotal) : rawSafeScore;
  const rawSafeWrong = Number.isFinite(Number(wrong)) ? Math.max(0, Number(wrong)) : Math.max(0, safeTotal - safeScore);
  const wrongCount = safeTotal > 0 ? Math.min(rawSafeWrong, Math.max(0, safeTotal - safeScore)) : rawSafeWrong;
  const skippedCount = safeTotal > 0 ? Math.max(0, safeTotal - safeScore - wrongCount) : 0;
  const safeWritingCount = Number.isFinite(Number(writingCount)) ? Math.max(0, Number(writingCount)) : 0;

  return {
    safeTotal,
    safeScore,
    wrongCount,
    skippedCount,
    safeWritingCount,
    submittedSingleMode: Boolean(isSingleMode),
    correctPct: safeTotal ? (safeScore / safeTotal) * 100 : 0,
    wrongPct: safeTotal ? (wrongCount / safeTotal) * 100 : 0,
  };
};
