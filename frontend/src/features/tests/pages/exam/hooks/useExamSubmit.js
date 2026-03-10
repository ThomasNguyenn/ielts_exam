import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/shared/api/client';
import {
  extractStudentHighlights,
  normalizeSubmitResultForSingleMode,
  resolveDurationSec,
} from '../utils/examMappers';
import { clearExamStrikeThrough } from '../utils/examStorage';

export default function useExamSubmit({
  examId,
  exam,
  steps,
  currentStep,
  isSingleMode,
  hwctx,
  trackedResourceRefType,
  trackedResourceRefId,
  answersRef,
  writingAnswersRef,
  passageStates,
  timeRemaining,
  startTime,
  submitted,
  tracking,
  clearDraft,
  stopTimer,
  closeSubmitConfirm,
  closeScoreChoice,
  onSubmitted,
  navigate,
}) {
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const submitInFlightRef = useRef(false);
  const autoSubmitTriggeredRef = useRef(false);

  useEffect(() => {
    submitInFlightRef.current = false;
    autoSubmitTriggeredRef.current = false;
    setSubmitLoading(false);
    setSubmitError(null);
  }, [examId]);

  const performSubmit = useCallback((returnOnly = false) => {
    if (submitLoading || submitted || submitInFlightRef.current) return Promise.resolve(null);

    submitInFlightRef.current = true;
    autoSubmitTriggeredRef.current = true;
    stopTimer();

    setSubmitLoading(true);
    setSubmitError(null);
    closeSubmitConfirm();
    closeScoreChoice();

    const currentSingleStep = steps[currentStep];
    const now = Date.now();
    const durationSec = resolveDurationSec({
      exam,
      isSingleMode,
      currentStep: currentSingleStep,
    });

    const timeRemainingSec = typeof timeRemaining === 'number' && Number.isFinite(timeRemaining)
      ? Math.max(0, Math.min(durationSec, Math.floor(timeRemaining)))
      : null;
    const elapsedMsFromTimer = timeRemainingSec === null
      ? null
      : Math.max(0, (durationSec - timeRemainingSec) * 1000);
    const fallbackTimeTaken = startTime ? Math.max(0, now - startTime) : durationSec * 1000;
    const timeTaken = elapsedMsFromTimer ?? fallbackTimeTaken;

    clearExamStrikeThrough(examId);

    const studentHighlights = extractStudentHighlights(passageStates);
    tracking.trackSubmit();

    return api
      .submitExam(examId, {
        answers: answersRef.current,
        writing: writingAnswersRef.current,
        timeTaken,
        student_highlights: studentHighlights,
        isPractice: isSingleMode,
        singleModeMeta: isSingleMode && steps[currentStep]
          ? {
            stepIndex: currentStep,
            startSlotIndex: Number(steps[currentStep].startSlotIndex),
            endSlotIndex: Number(steps[currentStep].endSlotIndex),
          }
          : null,
        hwctx: hwctx || undefined,
        resource_ref_type: trackedResourceRefType,
        resource_ref_id: trackedResourceRefId,
        event_id: tracking.createEventId(),
        tab_session_id: tracking.getTabSessionId(),
        client_ts: new Date().toISOString(),
      })
      .then((res) => {
        const payload = res?.data ?? res;
        const resultData = normalizeSubmitResultForSingleMode({
          payload,
          isSingleMode,
          currentSingleStep,
        });

        clearDraft();

        if (!returnOnly) {
          onSubmitted(resultData);
        }

        return resultData;
      })
      .catch((err) => {
        const message = err?.message || 'Failed to submit. Please try again.';
        setSubmitError(message);
        return null;
      })
      .finally(() => {
        submitInFlightRef.current = false;
        setSubmitLoading(false);
      });
  }, [
    submitLoading,
    submitted,
    stopTimer,
    closeSubmitConfirm,
    closeScoreChoice,
    steps,
    currentStep,
    exam,
    isSingleMode,
    timeRemaining,
    startTime,
    examId,
    passageStates,
    tracking,
    answersRef,
    writingAnswersRef,
    hwctx,
    trackedResourceRefType,
    trackedResourceRefId,
    clearDraft,
    onSubmitted,
  ]);

  const autoSubmit = useCallback(() => {
    if (autoSubmitTriggeredRef.current) return Promise.resolve(null);
    autoSubmitTriggeredRef.current = true;
    return performSubmit(false);
  }, [performSubmit]);

  const retrySubmit = useCallback(() => performSubmit(false), [performSubmit]);

  const submit = useCallback(() => performSubmit(false), [performSubmit]);

  const chooseScoreMode = useCallback((mode) => {
    if (mode === 'standard') {
      performSubmit(false);
      return;
    }

    performSubmit(true).then((data) => {
      if (data && data.writingSubmissionId) {
        try {
          sessionStorage.setItem(`writing-ai-start:${data.writingSubmissionId}`, String(Date.now()));
        } catch {
          // Ignore storage errors and continue navigation.
        }
        navigate(`/student-ielts/tests/writing/result-ai/${data.writingSubmissionId}`);
      } else if (data) {
        onSubmitted(data);
      }
    });
  }, [performSubmit, navigate, onSubmitted]);

  return {
    submitLoading,
    submitError,
    setSubmitError,
    submit,
    autoSubmit,
    retrySubmit,
    chooseScoreMode,
  };
}
