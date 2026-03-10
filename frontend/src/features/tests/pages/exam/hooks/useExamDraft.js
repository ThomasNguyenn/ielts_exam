import { useEffect, useRef, useState } from 'react';
import { EXAM_DRAFT_VERSION } from '../constants/examConstants';
import {
  clearExamDraft,
  loadExamDraft,
  saveExamDraft,
} from '../utils/examStorage';

export default function useExamDraft({
  exam,
  loading,
  submitted,
  draftKey,
  isSingleMode,
  shouldPersistExamDraft,
  slots,
  steps,
  initialStepIndex,
  defaultTimeRemaining,
  sessionState,
  answersRef,
  writingAnswersRef,
  hydrateFromDraft,
  setCurrentStep,
  setStartTime,
  timeRemaining,
  setTimeRemaining,
  listeningAudioQueueLength,
  listeningAudioProgressRef,
  listeningAudioIndex,
  restoreListeningFromDraft,
  resetListening,
}) {
  const [restoredDraftMeta, setRestoredDraftMeta] = useState({ restored: false, updatedAt: null });
  const hydratedDraftKeyRef = useRef('');

  useEffect(() => {
    if (!exam || loading) return;

    if (hydratedDraftKeyRef.current === draftKey) {
      return;
    }
    hydratedDraftKeyRef.current = draftKey;

    if (!shouldPersistExamDraft) {
      clearExamDraft(draftKey);
      setTimeRemaining(defaultTimeRemaining);
      setCurrentStep(initialStepIndex);
      setStartTime(Date.now());
      resetListening();
      setRestoredDraftMeta({ restored: false, updatedAt: null });
      return;
    }

    const loadedDraft = loadExamDraft({
      draftKey,
      isSingleMode,
      answerCount: slots.length,
      writingCount: (exam.writing || []).length,
      maxStep: Math.max(0, steps.length - 1),
      defaultTimeRemaining,
      examType: exam.type,
      listeningQueueLength: listeningAudioQueueLength,
    });

    if (loadedDraft.restored) {
      const patch = {
        ...loadedDraft.sessionPatch,
      };

      if (!Number.isFinite(Number(patch.startTime))) {
        patch.startTime = Date.now();
      }

      if (!Number.isFinite(Number(patch.currentStep))) {
        patch.currentStep = initialStepIndex;
      }

      hydrateFromDraft(patch);
      setTimeRemaining(loadedDraft.timeRemaining);

      if (loadedDraft.listening) {
        restoreListeningFromDraft({
          audioIndex: loadedDraft.listening.audioIndex,
          audioPositionSec: loadedDraft.listening.audioPositionSec,
          resumeNotice: loadedDraft.listening.resumeNotice,
        });
      }

      setRestoredDraftMeta({
        restored: true,
        updatedAt: loadedDraft.updatedAt,
      });
      return;
    }

    setTimeRemaining(defaultTimeRemaining);
    setCurrentStep(initialStepIndex);
    setStartTime(Date.now());
    resetListening();
    setRestoredDraftMeta({ restored: false, updatedAt: null });
  }, [
    exam,
    loading,
    draftKey,
    shouldPersistExamDraft,
    defaultTimeRemaining,
    initialStepIndex,
    setCurrentStep,
    setStartTime,
    setTimeRemaining,
    listeningAudioQueueLength,
    restoreListeningFromDraft,
    resetListening,
    steps.length,
    slots.length,
    hydrateFromDraft,
    isSingleMode,
  ]);

  useEffect(() => {
    if (!exam || loading || submitted || !shouldPersistExamDraft) return;

    const listeningProgress = listeningAudioProgressRef.current;
    const listeningAudioPositionSec =
      listeningProgress && listeningProgress.index === listeningAudioIndex
        ? Math.max(0, listeningProgress.timeSec || 0)
        : 0;

    const draftPayload = {
      version: EXAM_DRAFT_VERSION,
      updatedAt: Date.now(),
      isSingleMode,
      answers: answersRef.current,
      writingAnswers: writingAnswersRef.current,
      currentStep: sessionState.currentStep,
      passageStates: sessionState.passageStates,
      timeRemaining,
      startTime: sessionState.startTime,
      listeningAudioIndex,
      listeningAudioPositionSec,
    };

    saveExamDraft({ draftKey, payload: draftPayload });
  }, [
    exam,
    loading,
    submitted,
    shouldPersistExamDraft,
    isSingleMode,
    answersRef,
    writingAnswersRef,
    sessionState.currentStep,
    sessionState.passageStates,
    sessionState.startTime,
    timeRemaining,
    listeningAudioIndex,
    listeningAudioProgressRef,
    draftKey,
  ]);

  useEffect(() => {
    if (!exam || loading || submitted || !shouldPersistExamDraft) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [exam, loading, submitted, shouldPersistExamDraft]);

  const clearDraft = () => {
    clearExamDraft(draftKey);
  };

  return {
    restoredDraftMeta,
    clearDraft,
  };
}
