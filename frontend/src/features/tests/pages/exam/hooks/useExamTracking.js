import { useCallback, useEffect, useRef } from 'react';
import { api } from '@/shared/api/client';
import {
  TRACKING_ANSWER_DEBOUNCE_MS,
  TRACKING_HEARTBEAT_MS,
} from '../constants/examConstants';
import {
  buildTrackingPayload,
  createTrackingEventId,
  getTrackingTabSessionId,
} from '../utils/examTracking';

export default function useExamTracking({
  enabled,
  examId,
  exam,
  loading,
  submitted,
  hwctx,
  resourceRefType,
  resourceRefId,
}) {
  const trackingOpenSentRef = useRef(false);
  const trackingStartedSentRef = useRef(false);
  const trackingSaveSeqRef = useRef(0);
  const trackingTabSessionIdRef = useRef('');
  const trackingTabSessionScopeRef = useRef('');
  const trackingAnswerQueueRef = useRef(new Map());
  const trackingAnswerTimerRef = useRef(null);
  const trackingHeartbeatTimerRef = useRef(null);
  const trackingFlushInFlightRef = useRef(false);

  const trackingEnabled = Boolean(enabled && examId && exam && !submitted);

  const makePayload = useCallback((extra = {}) => buildTrackingPayload({
    examId,
    hwctx,
    resourceRefType,
    resourceRefId,
    tabSessionIdRef: trackingTabSessionIdRef,
    tabSessionScopeRef: trackingTabSessionScopeRef,
    extra,
  }), [examId, hwctx, resourceRefType, resourceRefId]);

  const flushAnswers = useCallback(function flushAnswersImpl() {
    if (!trackingEnabled) return;

    if (trackingAnswerTimerRef.current) {
      window.clearTimeout(trackingAnswerTimerRef.current);
      trackingAnswerTimerRef.current = null;
    }

    const queue = trackingAnswerQueueRef.current;
    if (!(queue instanceof Map) || queue.size === 0) return;

    if (trackingFlushInFlightRef.current) {
      trackingAnswerTimerRef.current = window.setTimeout(() => {
        flushAnswersImpl();
      }, TRACKING_ANSWER_DEBOUNCE_MS);
      return;
    }

    const snapshotEntries = Array.from(queue.entries());
    const updates = snapshotEntries.map(([questionKey, answerValue]) => ({
      question_key: questionKey,
      answer_value: answerValue,
    }));
    if (updates.length === 0) return;

    trackingFlushInFlightRef.current = true;
    const currentSaveSeq = trackingSaveSeqRef.current + 1;
    trackingSaveSeqRef.current = currentSaveSeq;

    api.trackTestActivityAnswer(
      examId,
      makePayload({
        source: 'tests_exam_answer',
        save_seq: currentSaveSeq,
        updates,
      }),
    ).then(() => {
      snapshotEntries.forEach(([questionKey, answerValue]) => {
        if (queue.get(questionKey) === answerValue) {
          queue.delete(questionKey);
        }
      });
    }).catch(() => {
      // Keep queue for retry on next debounce/submit cycle.
    }).finally(() => {
      trackingFlushInFlightRef.current = false;
      if (queue.size > 0) {
        if (trackingAnswerTimerRef.current) {
          window.clearTimeout(trackingAnswerTimerRef.current);
        }
        trackingAnswerTimerRef.current = window.setTimeout(() => {
          flushAnswersImpl();
        }, TRACKING_ANSWER_DEBOUNCE_MS);
      }
    });
  }, [trackingEnabled, examId, makePayload]);

  const trackStart = useCallback(() => {
    if (!trackingEnabled) return;
    if (trackingStartedSentRef.current) return;
    trackingStartedSentRef.current = true;

    api.trackTestActivityStart(
      examId,
      makePayload({
        source: 'tests_exam_start',
      }),
    ).catch(() => {
      // Ignore tracking failures to keep exam flow uninterrupted.
    });
  }, [trackingEnabled, examId, makePayload]);

  const queueAnswer = useCallback((questionKey, answerValue) => {
    if (!trackingEnabled) return;
    const normalizedKey = String(questionKey || '').trim();
    if (!normalizedKey) return;

    trackStart();
    trackingAnswerQueueRef.current.set(normalizedKey, answerValue ?? '');

    if (trackingAnswerTimerRef.current) {
      window.clearTimeout(trackingAnswerTimerRef.current);
    }
    trackingAnswerTimerRef.current = window.setTimeout(() => {
      flushAnswers();
    }, TRACKING_ANSWER_DEBOUNCE_MS);
  }, [trackingEnabled, trackStart, flushAnswers]);

  const trackSubmit = useCallback(() => {
    flushAnswers();
  }, [flushAnswers]);

  const getTabSessionId = useCallback(() => getTrackingTabSessionId({
    examId,
    tabSessionIdRef: trackingTabSessionIdRef,
    tabSessionScopeRef: trackingTabSessionScopeRef,
  }), [examId]);

  useEffect(() => {
    trackingOpenSentRef.current = false;
    trackingStartedSentRef.current = false;
    trackingSaveSeqRef.current = 0;
    trackingTabSessionIdRef.current = '';
    trackingTabSessionScopeRef.current = '';
    trackingAnswerQueueRef.current.clear();

    if (trackingAnswerTimerRef.current) {
      window.clearTimeout(trackingAnswerTimerRef.current);
      trackingAnswerTimerRef.current = null;
    }
    if (trackingHeartbeatTimerRef.current) {
      window.clearInterval(trackingHeartbeatTimerRef.current);
      trackingHeartbeatTimerRef.current = null;
    }
    trackingFlushInFlightRef.current = false;
  }, [examId]);

  useEffect(() => {
    if (!trackingEnabled || loading) return undefined;

    if (!trackingOpenSentRef.current) {
      trackingOpenSentRef.current = true;
      api.trackTestActivityOpen(
        examId,
        makePayload({
          source: 'tests_exam_open',
          visibility: typeof document !== 'undefined' ? document.visibilityState : '',
          focused: typeof document !== 'undefined' && typeof document.hasFocus === 'function'
            ? document.hasFocus()
            : null,
        }),
      ).catch(() => {
        // Ignore tracking failures to keep exam flow uninterrupted.
      });
    }

    const sendHeartbeat = (visibilityEvent = '') => {
      api.trackTestActivityHeartbeat(
        examId,
        makePayload({
          source: 'tests_exam_heartbeat',
          interacted: trackingStartedSentRef.current,
          visibility: typeof document !== 'undefined' ? document.visibilityState : '',
          visibility_event: visibilityEvent || undefined,
          focused: typeof document !== 'undefined' && typeof document.hasFocus === 'function'
            ? document.hasFocus()
            : null,
        }),
      ).catch(() => {
        // Ignore tracking failures to keep exam flow uninterrupted.
      });
    };

    sendHeartbeat();

    trackingHeartbeatTimerRef.current = window.setInterval(() => {
      sendHeartbeat();
    }, TRACKING_HEARTBEAT_MS);

    const handleVisibilityChange = () => {
      const nextVisibility = typeof document !== 'undefined' ? document.visibilityState : '';
      sendHeartbeat(nextVisibility === 'hidden' ? 'hidden' : 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (trackingHeartbeatTimerRef.current) {
        window.clearInterval(trackingHeartbeatTimerRef.current);
        trackingHeartbeatTimerRef.current = null;
      }
    };
  }, [trackingEnabled, loading, examId, makePayload]);

  useEffect(() => {
    if (!trackingEnabled || loading) return undefined;

    const handleTrackingBeforeUnload = () => {
      api.trackTestActivityHeartbeat(
        examId,
        makePayload({
          source: 'tests_exam_unload',
          refresh: true,
          interacted: trackingStartedSentRef.current,
          visibility: typeof document !== 'undefined' ? document.visibilityState : '',
          focused: typeof document !== 'undefined' && typeof document.hasFocus === 'function'
            ? document.hasFocus()
            : null,
        }),
        {
          keepalive: true,
          skipAuthRefresh: true,
        },
      ).catch(() => {
        // Ignore tracking failures to keep exam flow uninterrupted.
      });
    };

    window.addEventListener('beforeunload', handleTrackingBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleTrackingBeforeUnload);
    };
  }, [trackingEnabled, loading, examId, makePayload]);

  useEffect(() => () => {
    if (trackingAnswerTimerRef.current) {
      window.clearTimeout(trackingAnswerTimerRef.current);
      trackingAnswerTimerRef.current = null;
    }
    if (trackingHeartbeatTimerRef.current) {
      window.clearInterval(trackingHeartbeatTimerRef.current);
      trackingHeartbeatTimerRef.current = null;
    }
  }, []);

  return {
    enabled: trackingEnabled,
    trackStart,
    queueAnswer,
    flushAnswers,
    trackSubmit,
    createEventId: createTrackingEventId,
    getTabSessionId,
  };
}
