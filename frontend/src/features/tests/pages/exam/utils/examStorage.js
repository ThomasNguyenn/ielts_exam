import {
  EXAM_DRAFT_TTL_MS,
  EXAM_DRAFT_VERSION,
  LISTENING_AUDIO_REWIND_SECONDS,
  LISTENING_TIMER_REWIND_SECONDS,
} from '../constants/examConstants';

export const loadExamDraft = ({
  draftKey,
  isSingleMode,
  answerCount,
  writingCount,
  maxStep,
  defaultTimeRemaining,
  examType,
  listeningQueueLength,
}) => {
  if (typeof window === 'undefined') return { restored: false };

  const rawDraft = window.localStorage.getItem(draftKey);
  if (!rawDraft) return { restored: false };

  try {
    const draft = JSON.parse(rawDraft);
    const isFresh = (Date.now() - Number(draft?.updatedAt || 0)) <= EXAM_DRAFT_TTL_MS;
    const sameMode = Boolean(draft?.isSingleMode) === Boolean(isSingleMode);

    if (!isFresh || !sameMode || Number(draft?.version) !== EXAM_DRAFT_VERSION) {
      window.localStorage.removeItem(draftKey);
      return { restored: false };
    }

    const sessionPatch = {};
    if (Array.isArray(draft.answers) && draft.answers.length === answerCount) {
      sessionPatch.answers = draft.answers;
    }

    if (Array.isArray(draft.writingAnswers) && draft.writingAnswers.length === writingCount) {
      sessionPatch.writingAnswers = draft.writingAnswers;
    }

    if (draft.passageStates && typeof draft.passageStates === 'object') {
      sessionPatch.passageStates = draft.passageStates;
    }

    if (typeof draft.currentStep === 'number' && Number.isFinite(draft.currentStep) && maxStep >= 0) {
      sessionPatch.currentStep = Math.max(0, Math.min(maxStep, Math.floor(draft.currentStep)));
    }

    if (typeof draft.startTime === 'number' && Number.isFinite(draft.startTime)) {
      sessionPatch.startTime = draft.startTime;
    }

    let timeRemaining = defaultTimeRemaining;
    if (typeof draft.timeRemaining === 'number' && Number.isFinite(draft.timeRemaining) && draft.timeRemaining > 0) {
      let restoredTimeRemaining = Math.min(defaultTimeRemaining, Math.floor(draft.timeRemaining));
      if (examType === 'listening') {
        restoredTimeRemaining = Math.min(defaultTimeRemaining, restoredTimeRemaining + LISTENING_TIMER_REWIND_SECONDS);
      }
      timeRemaining = restoredTimeRemaining;
    }

    let listening = null;
    if (examType === 'listening' && listeningQueueLength > 0) {
      const maxAudioIndex = Math.max(0, listeningQueueLength - 1);
      const restoredAudioIndex = typeof draft.listeningAudioIndex === 'number' && Number.isFinite(draft.listeningAudioIndex)
        ? Math.max(0, Math.min(maxAudioIndex, Math.floor(draft.listeningAudioIndex)))
        : 0;
      const savedAudioPosition = typeof draft.listeningAudioPositionSec === 'number' && Number.isFinite(draft.listeningAudioPositionSec)
        ? Math.max(0, draft.listeningAudioPositionSec)
        : 0;
      const rewoundAudioPosition = Math.max(0, savedAudioPosition - LISTENING_AUDIO_REWIND_SECONDS);

      listening = {
        audioIndex: restoredAudioIndex,
        audioPositionSec: rewoundAudioPosition,
        resumeNotice: 'Ðã ti?p t?c bài nghe: audio lùi 5 giây, d?ng h? lùi 10 giây.',
      };
    }

    return {
      restored: true,
      sessionPatch,
      timeRemaining,
      listening,
      updatedAt: Number(draft?.updatedAt || 0) || null,
    };
  } catch {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // Ignore storage errors.
    }
    return { restored: false };
  }
};

export const saveExamDraft = ({ draftKey, payload }) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(draftKey, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors to avoid interrupting exam flow.
  }
};

export const clearExamDraft = (draftKey) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(draftKey);
  } catch {
    // Ignore storage errors.
  }
};

export const clearExamStrikeThrough = (examId) => {
  if (typeof window === 'undefined') return;
  const prefix = `strikethrough_${String(examId || '').trim() || 'unknown'}_`;
  try {
    Object.keys(window.localStorage).forEach((key) => {
      if (key.startsWith(prefix)) {
        window.localStorage.removeItem(key);
      }
    });
  } catch {
    // Ignore storage errors.
  }
};
