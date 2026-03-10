import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LISTENING_RESUME_NOTICE_MS } from '../constants/examConstants';
import { getListeningAudioQueue } from '../utils/examSelectors';

export default function useListeningController({
  exam,
  steps,
  currentStep,
  isSingleMode,
  onStepChange,
}) {
  const [listeningAudioIndex, setListeningAudioIndex] = useState(0);
  const [listeningAudioInitialTimeSec, setListeningAudioInitialTimeSec] = useState(0);
  const [listeningResumeNotice, setListeningResumeNotice] = useState('');
  const listeningAudioProgressRef = useRef({ index: 0, timeSec: 0 });

  const listeningAudioQueue = useMemo(
    () => getListeningAudioQueue({ exam, isSingleMode }),
    [exam, isSingleMode],
  );

  const listeningStepIndices = useMemo(
    () => (steps || [])
      .map((stepItem, stepIndex) => (stepItem?.type === 'listening' ? stepIndex : -1))
      .filter((stepIndex) => stepIndex >= 0),
    [steps],
  );

  const step = steps?.[currentStep];

  useEffect(() => {
    if (!listeningResumeNotice) return undefined;
    const timeoutId = window.setTimeout(() => {
      setListeningResumeNotice('');
    }, LISTENING_RESUME_NOTICE_MS);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [listeningResumeNotice]);

  useEffect(() => {
    if (listeningAudioQueue.length === 0) return;
    if (listeningAudioIndex < listeningAudioQueue.length) return;
    const safeIndex = Math.max(0, listeningAudioQueue.length - 1);
    setListeningAudioIndex(safeIndex);
    setListeningAudioInitialTimeSec(0);
    listeningAudioProgressRef.current = { index: safeIndex, timeSec: 0 };
  }, [listeningAudioQueue.length, listeningAudioIndex]);

  useEffect(() => {
    if (!exam || exam.type !== 'listening' || isSingleMode) return;

    if (exam.full_audio) {
      if (listeningAudioIndex !== 0) {
        setListeningAudioIndex(0);
        setListeningAudioInitialTimeSec(0);
        listeningAudioProgressRef.current = { index: 0, timeSec: 0 };
      }
      return;
    }

    const listeningUnitIndex = listeningStepIndices.indexOf(currentStep);
    if (listeningUnitIndex < 0) return;
    if (listeningAudioIndex === listeningUnitIndex) return;

    setListeningAudioIndex(listeningUnitIndex);
    setListeningAudioInitialTimeSec(0);
    listeningAudioProgressRef.current = { index: listeningUnitIndex, timeSec: 0 };
  }, [exam, isSingleMode, currentStep, listeningStepIndices, listeningAudioIndex]);

  const handleAudioEnded = useCallback(() => {
    setListeningAudioIndex((prev) => {
      if (prev + 1 < listeningAudioQueue.length) {
        const nextIndex = prev + 1;
        setListeningAudioInitialTimeSec(0);
        listeningAudioProgressRef.current = { index: nextIndex, timeSec: 0 };

        if (!exam?.full_audio && typeof onStepChange === 'function') {
          const nextStepIndex = listeningStepIndices[nextIndex];
          if (Number.isFinite(nextStepIndex)) {
            onStepChange(nextStepIndex);
          }
        }

        return nextIndex;
      }

      listeningAudioProgressRef.current = { index: prev, timeSec: 0 };
      return prev;
    });
  }, [listeningAudioQueue.length, exam?.full_audio, onStepChange, listeningStepIndices]);

  const handleAudioTimeUpdate = useCallback((timeSec) => {
    listeningAudioProgressRef.current = {
      index: listeningAudioIndex,
      timeSec: Math.max(0, Number(timeSec) || 0),
    };
  }, [listeningAudioIndex]);

  const restoreFromDraft = useCallback(({ audioIndex, audioPositionSec, resumeNotice }) => {
    const safeIndex = Math.max(0, Number(audioIndex) || 0);
    const safeTime = Math.max(0, Number(audioPositionSec) || 0);
    setListeningAudioIndex(safeIndex);
    setListeningAudioInitialTimeSec(safeTime);
    listeningAudioProgressRef.current = { index: safeIndex, timeSec: safeTime };
    if (resumeNotice) {
      setListeningResumeNotice(String(resumeNotice));
    }
  }, []);

  const reset = useCallback(() => {
    setListeningAudioIndex(0);
    setListeningAudioInitialTimeSec(0);
    setListeningResumeNotice('');
    listeningAudioProgressRef.current = { index: 0, timeSec: 0 };
  }, []);

  const listeningAudioUrl = useMemo(() => {
    if (isSingleMode && step?.type === 'listening') {
      return step?.item?.audio_url || exam?.full_audio || null;
    }
    return listeningAudioQueue[listeningAudioIndex] || null;
  }, [isSingleMode, step, exam, listeningAudioQueue, listeningAudioIndex]);

  return {
    listeningAudioQueue,
    listeningAudioIndex,
    listeningAudioInitialTimeSec,
    listeningAudioUrl,
    listeningResumeNotice,
    listeningAudioProgressRef,
    setListeningAudioIndex,
    setListeningAudioInitialTimeSec,
    setListeningResumeNotice,
    handleAudioEnded,
    handleAudioTimeUpdate,
    restoreFromDraft,
    reset,
  };
}
