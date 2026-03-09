import { lazy, Suspense, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardList, Clock3, Layers, ListChecks } from 'lucide-react';
import { api } from '@/shared/api/client';
import './Exam.css';
import StepContent from '../components/exam/StepContent';
import WritingStepContent from '../components/exam/WritingStepContent';
import ReviewExamLayout from '../components/review-mode/ReviewExamLayout';
import { calculateIELTSBand, buildQuestionSlots, buildSteps } from './examHelpers';

const IELTSSettings = lazy(() => import('@/shared/components/IELTSSettings'));

const EXAM_DRAFT_VERSION = 2;
const EXAM_DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const LISTENING_AUDIO_REWIND_SECONDS = 5;
const LISTENING_TIMER_REWIND_SECONDS = 10;
const LISTENING_RESUME_NOTICE_MS = 3800;
const MOBILE_READING_DRAWER_MAX_WIDTH = 860;
const TRACKING_HEARTBEAT_MS = 30 * 1000;
const TRACKING_ANSWER_DEBOUNCE_MS = 700;

const resolveRequestedStepIndex = (search, steps) => {
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

const resolveSingleModeDurationMinutes = (step) => {
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

export default function Exam() {
  const { id } = useParams();
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [writingAnswers, setWritingAnswers] = useState([]);
  const [submitted, setSubmitted] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [passageStates, setPassageState] = useState({});
  const [listeningAudioIndex, setListeningAudioIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [timeWarning, setTimeWarning] = useState(false);
  const [mode, setMode] = useState('test');
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showScoreChoice, setShowScoreChoice] = useState(false);
  const [fontSize, setFontSize] = useState(100); // 100% = default
  const [startTime, setStartTime] = useState(null); // Track when exam actually started (after loading)
  const [listeningAudioInitialTimeSec, setListeningAudioInitialTimeSec] = useState(0);
  const [listeningResumeNotice, setListeningResumeNotice] = useState('');

  // IELTS Theme & Settings
  const [theme, setTheme] = useState('light');
  const [textSize, setTextSize] = useState('regular');
  const [brightness, setBrightness] = useState(100);
  const [isViewport860, setIsViewport860] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${MOBILE_READING_DRAWER_MAX_WIDTH}px)`).matches;
  });
  const timerRef = useRef(null);
  const isMountedRef = useRef(true);
  const autoSubmitTriggeredRef = useRef(false);
  const submitInFlightRef = useRef(false);
  const answersRef = useRef([]);
  const writingAnswersRef = useRef([]);
  const listeningAudioProgressRef = useRef({ index: 0, timeSec: 0 });
  const trackingOpenSentRef = useRef(false);
  const trackingStartedSentRef = useRef(false);
  const trackingSaveSeqRef = useRef(0);
  const trackingTabSessionIdRef = useRef('');
  const trackingTabSessionScopeRef = useRef('');
  const trackingAnswerQueueRef = useRef(new Map());
  const trackingAnswerTimerRef = useRef(null);
  const trackingHeartbeatTimerRef = useRef(null);
  const trackingFlushInFlightRef = useRef(false);
  const examRequestSeqRef = useRef(0);

  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const hwctx = searchParams.get('hwctx') || '';
  const standaloneTypeFromQuery = searchParams.get('standalone');
  const modeParam = searchParams.get('mode') ?? 'full';
  const partParam = searchParams.get('part');
  const examMode = modeParam === 'single' && partParam !== null ? 'single' : 'full';
  const examPart = partParam ?? 'full';
  // Determine single mode based on params.
  // We strictly require 'part' param to be present for Single Mode to avoid "Full Test bug" where mode=single is always present.
  const isSingleMode = examMode === 'single';
  const singleModeSearch = useMemo(() => {
    if (partParam === null) return '';
    const params = new URLSearchParams();
    params.set('part', partParam);
    return `?${params.toString()}`;
  }, [partParam]);
  const isStandaloneExam =
    Boolean(exam?.is_standalone) ||
    standaloneTypeFromQuery === 'reading' ||
    standaloneTypeFromQuery === 'listening' ||
    standaloneTypeFromQuery === 'writing';
  const exitTestPath = isStandaloneExam ? '/student-ielts/tests' : `/student-ielts/tests/${id}`;
  const draftKey = useMemo(() => `exam-draft:${id}:${examMode}:${examPart}`, [id, examMode, examPart]);
  const shouldPersistExamDraft = Boolean(exam?.is_real_test) && !isSingleMode;
  const shouldTrackHomeworkActivity = Boolean(String(hwctx || '').trim());
  const trackedResourceRefType = useMemo(() => {
    if (!exam) return 'test';
    if (!exam.is_standalone) return 'test';
    if (exam.type === 'reading') return 'passage';
    if (exam.type === 'listening') return 'section';
    if (exam.type === 'writing') return 'writing';
    return 'test';
  }, [exam]);
  const trackedResourceRefId = String(exam?.testId || id || '');

  const createTrackingEventId = useCallback(() => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }, []);

  const getTrackingTabSessionId = useCallback(() => {
    if (typeof window === 'undefined') return '';
    const storageKey = `exam-tab-session:${id}`;
    if (trackingTabSessionScopeRef.current === storageKey && trackingTabSessionIdRef.current) {
      return trackingTabSessionIdRef.current;
    }
    trackingTabSessionScopeRef.current = storageKey;
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) {
      trackingTabSessionIdRef.current = existing;
      return existing;
    }
    const nextId = createTrackingEventId();
    window.sessionStorage.setItem(storageKey, nextId);
    trackingTabSessionIdRef.current = nextId;
    return nextId;
  }, [createTrackingEventId, id]);

  const buildTrackingPayload = useCallback((extra = {}) => ({
    hwctx: hwctx || undefined,
    resource_ref_type: trackedResourceRefType,
    resource_ref_id: trackedResourceRefId,
    event_id: createTrackingEventId(),
    tab_session_id: getTrackingTabSessionId(),
    client_ts: new Date().toISOString(),
    ...extra,
  }), [createTrackingEventId, getTrackingTabSessionId, hwctx, trackedResourceRefId, trackedResourceRefType]);

  useEffect(() => {
    // Reset on mount so StrictMode's dev double-invocation does not leave it false.
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_READING_DRAWER_MAX_WIDTH}px)`);
    const handleChange = (event) => {
      setIsViewport860(Boolean(event.matches));
    };

    setIsViewport860(mediaQuery.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

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
    if (!id) return undefined;
    const requestSeq = ++examRequestSeqRef.current;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let cancelled = false;
    setSubmitted(null);
    setMode('test');
    setSubmitError(null);
    setShowSubmitConfirm(false);
    setShowScoreChoice(false);
    setLoading(true);
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
    api
      .getExam(id, controller ? { signal: controller.signal } : {})
      .then((res) => {
        if (cancelled || requestSeq !== examRequestSeqRef.current) return;
        const examData = res.data;
        setExam(examData);
        setLoadError(null);
        setSubmitError(null);
        setPassageState({});
        const slots = buildQuestionSlots(examData);
        const steps = buildSteps(examData);
        const allowDraftResume = Boolean(examData?.is_real_test) && !isSingleMode;
        const listeningQueue = !isSingleMode && examData?.type === 'listening'
          ? (examData.full_audio
              ? [examData.full_audio]
              : (examData.listening || []).map((section) => section.audio_url).filter(Boolean))
          : [];
        // console.log("Built Steps:", steps); // Debug log
        const initialAnswers = Array(slots.length).fill('');
        setAnswers(initialAnswers);
        answersRef.current = initialAnswers;
        // Initialize writing answers array
        const writingCount = (examData.writing || []).length;
        const initialWritingAnswers = Array(writingCount).fill('');
        setWritingAnswers(initialWritingAnswers);
        writingAnswersRef.current = initialWritingAnswers;
        setListeningAudioIndex(0);
        setListeningAudioInitialTimeSec(0);
        listeningAudioProgressRef.current = { index: 0, timeSec: 0 };
        setListeningResumeNotice('');

        const duration = examData.duration || 60;
        const initialStepIndex = isSingleMode ? resolveRequestedStepIndex(singleModeSearch, steps) : 0;
        const singleModeDuration = isSingleMode
          ? resolveSingleModeDurationMinutes(steps[initialStepIndex])
          : null;
        const defaultTimeRemaining = (singleModeDuration ?? duration) * 60;
        let restoredFromDraft = false;

        try {
          if (!allowDraftResume) {
            localStorage.removeItem(draftKey);
            setTimeRemaining(defaultTimeRemaining);
          } else {
            const rawDraft = localStorage.getItem(draftKey);
            if (rawDraft) {
              const draft = JSON.parse(rawDraft);
              const isFresh = (Date.now() - Number(draft?.updatedAt || 0)) <= EXAM_DRAFT_TTL_MS;
              const sameMode = Boolean(draft?.isSingleMode) === Boolean(isSingleMode);

              if (isFresh && sameMode && Number(draft?.version) === EXAM_DRAFT_VERSION) {
                if (Array.isArray(draft.answers) && draft.answers.length === slots.length) {
                  setAnswers(draft.answers);
                  answersRef.current = draft.answers;
                }

                if (Array.isArray(draft.writingAnswers) && draft.writingAnswers.length === writingCount) {
                  setWritingAnswers(draft.writingAnswers);
                  writingAnswersRef.current = draft.writingAnswers;
                }

                if (draft.passageStates && typeof draft.passageStates === 'object') {
                  setPassageState(draft.passageStates);
                }

                if (typeof draft.timeRemaining === 'number' && Number.isFinite(draft.timeRemaining) && draft.timeRemaining > 0) {
                  let restoredTimeRemaining = Math.min(defaultTimeRemaining, Math.floor(draft.timeRemaining));
                  if (examData.type === 'listening') {
                    restoredTimeRemaining = Math.min(defaultTimeRemaining, restoredTimeRemaining + LISTENING_TIMER_REWIND_SECONDS);
                  }
                  setTimeRemaining(restoredTimeRemaining);
                } else {
                  setTimeRemaining(defaultTimeRemaining);
                }

                if (typeof draft.currentStep === 'number' && Number.isFinite(draft.currentStep) && steps.length > 0) {
                  const maxStep = steps.length - 1;
                  const restoredStep = Math.max(0, Math.min(maxStep, Math.floor(draft.currentStep)));
                  setCurrentStep(restoredStep);
                  restoredFromDraft = true;
                }

                if (typeof draft.startTime === 'number' && Number.isFinite(draft.startTime)) {
                  setStartTime(draft.startTime);
                } else {
                  setStartTime(Date.now());
                }

                if (examData.type === 'listening' && listeningQueue.length > 0) {
                  const maxAudioIndex = listeningQueue.length - 1;
                  const listeningStepIndices = steps
                    .map((stepItem, stepIndex) => (stepItem?.type === 'listening' ? stepIndex : -1))
                    .filter((stepIndex) => stepIndex >= 0);
                  const draftStepIndex =
                    typeof draft.currentStep === 'number' && Number.isFinite(draft.currentStep)
                      ? Math.max(0, Math.min(steps.length - 1, Math.floor(draft.currentStep)))
                      : null;
                  const fallbackAudioIndexFromStep =
                    draftStepIndex !== null ? Math.max(0, listeningStepIndices.indexOf(draftStepIndex)) : 0;
                  const restoredAudioIndex = typeof draft.listeningAudioIndex === 'number' && Number.isFinite(draft.listeningAudioIndex)
                    ? Math.max(0, Math.min(maxAudioIndex, Math.floor(draft.listeningAudioIndex)))
                    : Math.min(maxAudioIndex, fallbackAudioIndexFromStep);
                  const savedAudioPosition = typeof draft.listeningAudioPositionSec === 'number' && Number.isFinite(draft.listeningAudioPositionSec)
                    ? Math.max(0, draft.listeningAudioPositionSec)
                    : 0;
                  const rewoundAudioPosition = Math.max(0, savedAudioPosition - LISTENING_AUDIO_REWIND_SECONDS);

                  setListeningAudioIndex(restoredAudioIndex);
                  setListeningAudioInitialTimeSec(rewoundAudioPosition);
                  listeningAudioProgressRef.current = { index: restoredAudioIndex, timeSec: rewoundAudioPosition };
                  setListeningResumeNotice('\u0110\u00E3 ti\u1EBFp t\u1EE5c b\u00E0i nghe: audio l\u00F9i 5 gi\u00E2y, \u0111\u1ED3ng h\u1ED3 l\u00F9i 10 gi\u00E2y.');
                }
              } else {
                localStorage.removeItem(draftKey);
                setTimeRemaining(defaultTimeRemaining);
              }
            } else {
              setTimeRemaining(defaultTimeRemaining);
            }
          }
        } catch {
          try {
            localStorage.removeItem(draftKey);
          } catch {
            // Ignore storage errors.
          }
          setTimeRemaining(defaultTimeRemaining);
        }

        if (!restoredFromDraft) {
          setCurrentStep(initialStepIndex);
          setStartTime(Date.now());
        }

        setTimeWarning(false);
        autoSubmitTriggeredRef.current = false;
        submitInFlightRef.current = false;
      })
      .catch((err) => {
        if (cancelled || requestSeq !== examRequestSeqRef.current) return;
        if (err?.name === 'AbortError') return;
        setLoadError(err.message);
      })
      .finally(() => {
        if (cancelled || requestSeq !== examRequestSeqRef.current) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (controller) {
        controller.abort();
      }
    };
  }, [id, examMode, examPart, draftKey, singleModeSearch]);

  const ensureTrackingStarted = useCallback(() => {
    if (!shouldTrackHomeworkActivity || !id || !exam || submitted) return;
    if (trackingStartedSentRef.current) return;
    trackingStartedSentRef.current = true;
    api.trackTestActivityStart(
      id,
      buildTrackingPayload({
        source: 'tests_exam_start',
      }),
    ).catch(() => {
      // Ignore tracking failures to keep exam flow uninterrupted.
    });
  }, [shouldTrackHomeworkActivity, id, exam, submitted, buildTrackingPayload]);

  const flushTrackingAnswerQueue = useCallback(function flushTrackingAnswerQueueImpl() {
    if (!shouldTrackHomeworkActivity || !id || !exam || submitted) return;
    if (trackingAnswerTimerRef.current) {
      window.clearTimeout(trackingAnswerTimerRef.current);
      trackingAnswerTimerRef.current = null;
    }

    const queue = trackingAnswerQueueRef.current;
    if (!(queue instanceof Map) || queue.size === 0) return;
    if (trackingFlushInFlightRef.current) {
      trackingAnswerTimerRef.current = window.setTimeout(() => {
        flushTrackingAnswerQueueImpl();
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
      id,
      buildTrackingPayload({
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
          flushTrackingAnswerQueueImpl();
        }, TRACKING_ANSWER_DEBOUNCE_MS);
      }
    });
  }, [shouldTrackHomeworkActivity, id, exam, submitted, buildTrackingPayload]);

  const queueTrackingAnswer = useCallback((questionKey, answerValue) => {
    if (!shouldTrackHomeworkActivity || !id || !exam || submitted) return;
    const normalizedKey = String(questionKey || '').trim();
    if (!normalizedKey) return;
    ensureTrackingStarted();
    trackingAnswerQueueRef.current.set(normalizedKey, answerValue ?? '');

    if (trackingAnswerTimerRef.current) {
      window.clearTimeout(trackingAnswerTimerRef.current);
    }
    trackingAnswerTimerRef.current = window.setTimeout(() => {
      flushTrackingAnswerQueue();
    }, TRACKING_ANSWER_DEBOUNCE_MS);
  }, [shouldTrackHomeworkActivity, id, exam, submitted, ensureTrackingStarted, flushTrackingAnswerQueue]);

  useEffect(() => {
    if (!shouldTrackHomeworkActivity || !id || !exam || loading || submitted) return undefined;

    if (!trackingOpenSentRef.current) {
      trackingOpenSentRef.current = true;
      api.trackTestActivityOpen(
        id,
        buildTrackingPayload({
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
        id,
        buildTrackingPayload({
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
  }, [shouldTrackHomeworkActivity, id, exam, loading, submitted, buildTrackingPayload]);

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

  // Timer countdown effect - Optimized to avoid re-creating interval every second
  useEffect(() => {
    const shouldRun = timeRemaining !== null && timeRemaining > 0 && !submitted;

    if (!shouldRun) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (timerRef.current) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null) return prev;

        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }

          // Time's up - auto submit once
          if (!autoSubmitTriggeredRef.current) {
            autoSubmitTriggeredRef.current = true;
            handleAutoSubmit();
          }
          return 0;
        }

        // Set warning when less than 5 minutes remaining
        if (prev <= 301) {
          setTimeWarning((current) => (current ? current : true));
        }
        return prev - 1;
      });
    }, 1000);
  }, [submitted, timeRemaining]);

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
      currentStep,
      passageStates,
      timeRemaining,
      startTime,
      listeningAudioIndex,
      listeningAudioPositionSec,
    };

    try {
      localStorage.setItem(draftKey, JSON.stringify(draftPayload));
    } catch {
      // Ignore storage quota errors to avoid interrupting exam flow.
    }
  }, [
    exam,
    loading,
    submitted,
    shouldPersistExamDraft,
    isSingleMode,
    currentStep,
    passageStates,
    timeRemaining,
    startTime,
    listeningAudioIndex,
    answers,
    writingAnswers,
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

  useEffect(() => {
    if (!shouldTrackHomeworkActivity || !exam || loading || submitted) return undefined;

    const handleTrackingBeforeUnload = () => {
      api.trackTestActivityHeartbeat(
        id,
        buildTrackingPayload({
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
  }, [shouldTrackHomeworkActivity, exam, loading, submitted, id, buildTrackingPayload]);

  const performSubmit = (returnOnly = false) => {
    if (submitLoading || submitted || submitInFlightRef.current) return Promise.resolve(null);
    submitInFlightRef.current = true;
    autoSubmitTriggeredRef.current = true;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSubmitLoading(true);
    setSubmitError(null);
    setShowSubmitConfirm(false);
    setShowScoreChoice(false);
    const currentSingleStep = steps[currentStep];
    const now = Date.now();
    const resolvedDurationMinutes = isSingleMode
      ? resolveSingleModeDurationMinutes(currentSingleStep)
      : Number(exam?.duration || 60);
    const safeDurationMinutes = Number.isFinite(resolvedDurationMinutes) && resolvedDurationMinutes > 0
      ? resolvedDurationMinutes
      : 60;
    const durationSec = Math.max(0, Math.floor(safeDurationMinutes * 60));
    const timeRemainingSec = typeof timeRemaining === 'number' && Number.isFinite(timeRemaining)
      ? Math.max(0, Math.min(durationSec, Math.floor(timeRemaining)))
      : null;
    const elapsedMsFromTimer = timeRemainingSec === null
      ? null
      : Math.max(0, (durationSec - timeRemainingSec) * 1000);
    const fallbackTimeTaken = startTime ? Math.max(0, now - startTime) : durationSec * 1000;
    const timeTaken = elapsedMsFromTimer ?? fallbackTimeTaken;

    // Clear strikethrough localStorage entries only for this exam.
    if (typeof window !== 'undefined') {
      const strikePrefix = `strikethrough_${String(id || '').trim() || 'unknown'}_`;
      Object.keys(window.localStorage).forEach((key) => {
        if (key.startsWith(strikePrefix)) {
          window.localStorage.removeItem(key);
        }
      });
    }

    // Extract student highlights from passage states
    const studentHighlights = [];
    try {
      const tempDiv = document.createElement('div');
      Object.values(passageStates).forEach(html => {
        if (!html) return;
        tempDiv.innerHTML = html;
        const nodes = tempDiv.querySelectorAll('.ielts-highlight');
        nodes.forEach(node => {
          const text = node.textContent.trim();
          if (text && !studentHighlights.includes(text)) {
            studentHighlights.push(text);
          }
        });
      });
    } catch (e) {
      console.error("Failed to extract highlights", e);
    }
    flushTrackingAnswerQueue();

    return api
      .submitExam(id, {
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
        event_id: createTrackingEventId(),
        tab_session_id: getTrackingTabSessionId(),
        client_ts: new Date().toISOString(),
      })
      .then((res) => {
        const payload = res?.data ?? res;
        if (!payload || typeof payload !== 'object') {
          throw new Error('Invalid submit response');
        }
        let resultData = payload;

        // If single mode, recalculate score based only on current part
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

          partReview.forEach((q) => {
            partTotal++;
            if (q.is_correct) partScore++;
          });

          resultData = {
            ...payload,
            question_review: partReview,
            score: partScore,
            total: partTotal,
            wrong: partTotal - partScore,
            isSingleMode: true
          };
        }

        try {
          localStorage.removeItem(draftKey);
        } catch {
          // Ignore storage errors.
        }

        if (!returnOnly) {
          if (isMountedRef.current) {
            setSubmitted(resultData);
            setMode('test');
          }
        }
        return resultData;
      })
      .catch((err) => {
        if (isMountedRef.current) {
          setSubmitError(err.message || 'Failed to submit. Please try again.');
        }
        return null;
      })
      .finally(() => {
        submitInFlightRef.current = false;
        if (isMountedRef.current) {
          setSubmitLoading(false);
        }
      });
  };

  const handleScoreChoice = (mode) => {
    if (mode === 'standard') {
      performSubmit();
    } else {
      // AI Scoring
      performSubmit(true).then((data) => {
        if (data && data.writingSubmissionId) {
          try {
            sessionStorage.setItem(`writing-ai-start:${data.writingSubmissionId}`, String(Date.now()));
          } catch {
            // Ignore storage errors and continue navigation.
          }
          navigate(`/student-ielts/tests/writing/result-ai/${data.writingSubmissionId}`);
        } else if (data) {
          // Fallback if ID is missing
          console.error("Missing writingSubmissionId");
          setSubmitted(data);
        }
      });
    }
  };

  const handleAutoSubmit = () => {
    performSubmit();
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    setSubmitError(null);
    if (isWriting && isSingleMode && !exam.is_real_test) {
      setShowScoreChoice(true);
    } else {
      setShowSubmitConfirm(true);
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format time taken in Vietnamese format
  const formatTimeTaken = (start, end) => {
    const diffMs = end - start;
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);

    if (diffMins > 0) {
      return `${diffMins} phút ${diffSecs} giây`;
    }
    return `${diffSecs} giây`;
  };

  // Calculate time taken for results display
  const getTimeTaken = () => {
    if (!submitted) return '';
    // Use fixed time from submission if available
    if (submitted.timeTaken !== undefined) {
      return formatTimeTaken(0, submitted.timeTaken);
    }
    const now = Date.now();
    return formatTimeTaken(startTime || now, now);
  };

  const slots = exam ? buildQuestionSlots(exam) : [];
  const steps = exam ? buildSteps(exam) : [];

  const listeningAudioQueue = useMemo(() => {
    if (!exam || exam.type !== 'listening' || isSingleMode) return [];
    if (exam.full_audio) return [exam.full_audio];
    return (exam.listening || [])
      .map((s) => s.audio_url)
      .filter(Boolean);
  }, [exam, isSingleMode]);

  useEffect(() => {
    if (listeningAudioQueue.length === 0) return;
    if (listeningAudioIndex < listeningAudioQueue.length) return;
    const safeIndex = Math.max(0, listeningAudioQueue.length - 1);
    setListeningAudioIndex(safeIndex);
    setListeningAudioInitialTimeSec(0);
    listeningAudioProgressRef.current = { index: safeIndex, timeSec: 0 };
  }, [listeningAudioQueue.length, listeningAudioIndex]);

  const handleListeningAudioEnded = useCallback(() => {
    setListeningAudioIndex((prev) => {
      if (prev + 1 < listeningAudioQueue.length) {
        const nextIndex = prev + 1;
        setListeningAudioInitialTimeSec(0);
        listeningAudioProgressRef.current = { index: nextIndex, timeSec: 0 };
        return nextIndex;
      }
      listeningAudioProgressRef.current = { index: prev, timeSec: 0 };
      return prev;
    });
  }, [listeningAudioQueue.length]);

  const handleListeningAudioTimeUpdate = useCallback((timeSec) => {
    listeningAudioProgressRef.current = {
      index: listeningAudioIndex,
      timeSec: Math.max(0, Number(timeSec) || 0),
    };
  }, [listeningAudioIndex]);

  const step = steps[currentStep];
  const listeningAudioUrl = useMemo(() => {
    if (isSingleMode && step?.type === 'listening') {
      return step?.item?.audio_url || exam?.full_audio || null;
    }
    return listeningAudioQueue[listeningAudioIndex] || null;
  }, [isSingleMode, step, exam, listeningAudioQueue, listeningAudioIndex]);
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const isWriting = step && step.type === 'writing';
  const useMobileReadingDrawer = Boolean(step?.type === 'reading' && isViewport860);

  const setAnswer = (index, value) => {
    queueTrackingAnswer(`q-${Number(index) + 1}`, value);
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      answersRef.current = next;
      return next;
    });
  };

  const setWritingAnswer = (taskIndex, value) => {
    queueTrackingAnswer(`writing-${Number(taskIndex) + 1}`, value);
    setWritingAnswers((prev) => {
      const next = [...prev];
      next[taskIndex] = value;
      writingAnswersRef.current = next;
      return next;
    });
  };

  const writingStepIndices = useMemo(
    () =>
      steps.reduce((indices, stepItem, stepIndex) => {
        if (stepItem?.type === 'writing') {
          indices.push(stepIndex);
        }
        return indices;
      }, []),
    [steps]
  );

  const currentWritingTaskIndex = useMemo(
    () => writingStepIndices.indexOf(currentStep),
    [writingStepIndices, currentStep]
  );

  const stepQuestionIndices = useMemo(() => {
    if (!step || isWriting) return [];
    const safeStart = Math.max(0, Number(step.startSlotIndex) || 0);
    const safeEnd = Math.max(safeStart, Number(step.endSlotIndex) || safeStart);
    return Array.from({ length: safeEnd - safeStart }, (_, offset) => safeStart + offset);
  }, [step, isWriting]);

  const currentStepTotal = isWriting ? 1 : stepQuestionIndices.length;

  const currentStepAnswered = useMemo(() => {
    if (isWriting) {
      if (currentWritingTaskIndex < 0) return 0;
      return String(writingAnswers[currentWritingTaskIndex] || '').trim() ? 1 : 0;
    }

    return stepQuestionIndices.reduce(
      (count, questionIndex) => count + (String(answers[questionIndex] || '').trim() ? 1 : 0),
      0
    );
  }, [isWriting, currentWritingTaskIndex, writingAnswers, stepQuestionIndices, answers]);

  const currentStepCompletion = currentStepTotal > 0 ? Math.round((currentStepAnswered / currentStepTotal) * 100) : 0;
  const questionRangeLabel = useMemo(() => {
    if (!step) return 'No range';

    if (isWriting) {
      if (currentWritingTaskIndex >= 0) {
        return `Task ${currentWritingTaskIndex + 1} / ${Math.max(1, writingStepIndices.length)}`;
      }
      return step.label || 'Writing task';
    }

    if (!stepQuestionIndices.length) return 'No questions';
    const firstIndex = stepQuestionIndices[0];
    const lastIndex = stepQuestionIndices[stepQuestionIndices.length - 1];
    const firstQuestion = slots[firstIndex]?.q_number ?? firstIndex + 1;
    const lastQuestion = slots[lastIndex]?.q_number ?? lastIndex + 1;
    return `Questions ${firstQuestion} - ${lastQuestion}`;
  }, [step, isWriting, currentWritingTaskIndex, writingStepIndices.length, stepQuestionIndices, slots]);

  const footerNavigationItems = useMemo(() => {
    if (!step) return [];

    if (isWriting) {
      return writingStepIndices.map((stepIndex, index) => ({
        key: `task-${index}`,
        label: index + 1,
        answered: String(writingAnswers[index] || '').trim().length > 0,
        active: stepIndex === currentStep,
        stepIndex,
        ariaLabel: `Task ${index + 1}`,
      }));
    }

    return stepQuestionIndices.map((questionIndex) => ({
      key: `question-${questionIndex}`,
      label: slots[questionIndex]?.q_number ?? questionIndex + 1,
      answered: String(answers[questionIndex] || '').trim().length > 0,
      active: false,
      questionIndex,
      ariaLabel: `Question ${slots[questionIndex]?.q_number ?? questionIndex + 1}`,
    }));
  }, [
    step,
    isWriting,
    writingStepIndices,
    writingAnswers,
    currentStep,
    stepQuestionIndices,
    slots,
    answers,
  ]);

  const jumpToQuestion = useCallback((questionIndex) => {
    if (!Number.isFinite(questionIndex)) return false;

    const index = Number(questionIndex);
    const target =
      document.querySelector(`[data-question-index="${index}"]`) ||
      document.getElementById(`q-${index}`);

    if (!target) return false;

    const scrollContainer = target.closest(
      '.questions-scrollable, .listening-content-area-top-padded, .passage-scrollable'
    );

    if (scrollContainer) {
      const targetRect = target.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      const nextTop =
        targetRect.top - containerRect.top + scrollContainer.scrollTop - 14;
      scrollContainer.scrollTo({
        top: Math.max(0, nextTop),
        behavior: 'smooth',
      });
    } else {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (typeof target.focus === 'function') {
      target.focus({ preventScroll: true });
    }

    return true;
  }, []);


  if (loading) return <div className="page"><p className="muted">Loading exam…</p></div>;
  if (loadError) return <div className="page"><p className="error">{loadError}</p><Link to="/student-ielts/tests">Back to tests</Link></div>;
  if (!exam) return <div className="page"><p className="muted">Exam not found.</p></div>;

  if (submitted) {
    const { score, total, wrong, writingCount, isSingleMode: submittedSingleMode } = submitted;
    const safeTotal = Number.isFinite(Number(total)) ? Math.max(0, Number(total)) : 0;
    const rawSafeScore = Number.isFinite(Number(score)) ? Math.max(0, Number(score)) : 0;
    const safeScore = safeTotal > 0 ? Math.min(rawSafeScore, safeTotal) : rawSafeScore;
    const rawSafeWrong = Number.isFinite(Number(wrong)) ? Math.max(0, Number(wrong)) : Math.max(0, safeTotal - safeScore);
    const wrongCount = safeTotal > 0 ? Math.min(rawSafeWrong, Math.max(0, safeTotal - safeScore)) : rawSafeWrong;
    const skippedCount = safeTotal > 0 ? Math.max(0, safeTotal - safeScore - wrongCount) : 0;
    const safeWritingCount = Number.isFinite(Number(writingCount)) ? Math.max(0, Number(writingCount)) : 0;
    const correctPct = safeTotal ? (safeScore / safeTotal) * 100 : 0;

    const examType = exam.type || 'reading';
    const showBandScore = !submittedSingleMode && examType !== 'writing';
    const bandScore = showBandScore ? calculateIELTSBand(safeScore, examType) : null;
    const timeTaken = getTimeTaken();

    const typeToLabel = (type) => (
      type === 'mult_choice' ? 'Multiple Choice (One Answer)' :
        type === 'true_false_notgiven' ? 'True - False - Not Given' :
          type === 'yes_no_notgiven' ? 'Yes - No - Not Given' :
            type === 'gap_fill' || type === 'note_completion' ? 'Note/Gap Completion' :
              type === 'matching_headings' ? 'Matching Headings' :
                type === 'matching_features' ? 'Matching Features' :
                  type === 'matching_information' ? 'Matching Information' :
                    type === 'summary_completion' ? 'Summary Completion' : 'Other'
    );

    const resultsByType = {};
    const questionReview = (submitted.question_review || []).map((q) => {
      const typeLabel = typeToLabel(q.type);

      if (!resultsByType[typeLabel]) {
        resultsByType[typeLabel] = { total: 0, correct: 0, wrong: 0, skipped: 0 };
      }
      resultsByType[typeLabel].total++;
      if (q.is_correct) resultsByType[typeLabel].correct++;
      else if (!q.your_answer) resultsByType[typeLabel].skipped++;
      else resultsByType[typeLabel].wrong++;

      return { ...q, typeLabel };
    });

    const wrongPct = safeTotal ? (wrongCount / safeTotal) * 100 : 0;
    if (mode === 'review') {
      return (
        <ReviewExamLayout
          examTitle={exam.title}
          step={step}
          steps={steps}
          slots={slots}
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          questionReview={questionReview}
          passageStates={passageStates}
          setPassageState={setPassageState}
          listeningAudioUrl={listeningAudioUrl}
          onListeningAudioEnded={handleListeningAudioEnded}
          isSingleMode={isSingleMode}
          strikethroughNamespace={id}
          onBackToResult={() => setMode('test')}
        />
      );
    }

    return (
      <div className="page exam-result-new">
        <div className="result-top-grid">
          <div className="result-left-col">
            <div className="result-test-info-card">
              <h1 className="result-test-name">{exam.title}</h1>
            </div>
            {showBandScore && (
              <div className="band-score-card">
                <div className="band-score-label">Band Score:</div>
                <div className="band-score-value">{bandScore}</div>
              </div>
            )}
            {!showBandScore && safeWritingCount > 0 && (
              <div className="band-score-card" style={{ background: '#4e6a97' }}>
                <div className="band-score-label">Practice Mode</div>
                <div className="band-score-value" style={{ fontSize: '2rem' }}>Writing Tasks</div>
              </div>
            )}
          </div>

          <div className="result-summary-card">
            <div className="result-card-header">
              <h2>{'K\u1EBFt qu\u1EA3 l\u00E0m b\u00E0i'}</h2>
              <div className="time-taken-small">
                <span>{'Th\u1EDDi gian l\u00E0m b\u00E0i'}</span>
                <strong>{timeTaken}</strong>
              </div>
            </div>

            <div className="result-card-content">
              <div className="doughnut-container">
                <div
                  className="doughnut-chart"
                  style={{
                    '--correct-pct': `${correctPct}%`,
                    '--wrong-pct': `${wrongPct}%`
                  }}
                >
                  <div className="doughnut-inner">
                    <span className="doughnut-score">{safeScore}/{safeTotal}</span>
                    <span className="doughnut-subtext">{'c\u00E2u \u0111\u00FAng'}</span>
                  </div>
                </div>
              </div>

              <div className="stats-legend">
                <div className="legend-item">
                  <span className="dot dot-correct"></span>
                  <span className="label">{'\u0110\u00FAng:'}</span>
                  <span className="value">{safeScore} {'\u0063\u00E2u'}</span>
                </div>
                <div className="legend-item">
                  <span className="dot dot-wrong"></span>
                  <span className="label">Sai:</span>
                  <span className="value">{wrongCount} {'\u0063\u00E2u'}</span>
                </div>
                <div className="legend-item">
                  <span className="dot dot-skipped"></span>
                  <span className="label">{'B\u1ECF qua:'}</span>
                  <span className="value">{skippedCount} {'\u0063\u00E2u'}</span>
                </div>
              </div>
            </div>

            <div className="result-card-footer">
              {!exam.is_real_test ? (
                <button className="btn-orange-round" onClick={() => { if (!isSingleMode) setCurrentStep(0); setMode('review'); }}>
                  {'Xem gi\u1EA3i th\u00EDch chi ti\u1EBFt'}
                </button>
              ) : (
                <div className="real-test-notice" style={{ color: '#6366F1', fontWeight: 'bold', padding: '0.5rem 1rem', background: '#fff5f5', borderRadius: '8px', border: '1px solid #feb2b2' }}>
                  {'\u0110\u00E2y l\u00E0 b\u00E0i thi th\u1EADt - B\u1EA1n kh\u00F4ng th\u1EC3 xem chi ti\u1EBFt \u0111\u00E1p \u00E1n.'}
                </div>
              )}
              <Link to="/student-ielts/tests" className="btn-exit-result">
                {'Tho\u00E1t k\u1EBFt qu\u1EA3'}
              </Link>
            </div>
          </div>
        </div>

        <div className="feedback-dashed-container">
          {!showBandScore && safeWritingCount > 0 && (
            <p style={{ padding: '1rem', margin: 0, textAlign: 'center', color: '#059669', fontWeight: 'bold' }}>
              Your writing tasks have been submitted successfully.
            </p>
          )}
        </div>

        <div className="detailed-stats-section">
          <h3>{'B\u1EA3ng d\u1EEF li\u1EC7u chi ti\u1EBFt'}</h3>
          <table className="stats-table">
            <thead>
              <tr>
                <th>{'Lo\u1EA1i c\u00E2u h\u1ECFi'}</th>
                <th>{'S\u1ED1 c\u00E2u h\u1ECFi'}</th>
                <th className="th-correct">{'\u0110\u00FAng'}</th>
                <th>Sai</th>
                <th>{'B\u1ECF qua'}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(resultsByType).map(([label, stats]) => (
                <tr key={`result-${label}`}>
                  <td>{label}</td>
                  <td>{stats.total}</td>
                  <td className="td-correct">{stats.correct}</td>
                  <td className="td-wrong">{stats.wrong}</td>
                  <td className="td-skipped">{stats.skipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const hasSteps = steps.length > 0;

  if (!hasSteps) {
    return (
      <div className="page">
        <p className="muted">This test has no content.</p>
        <Link to="/student-ielts/tests">Back to tests</Link>
      </div>
    );
  }

  // Determine timer flash class
  const getTimerClass = () => {
    if (timeRemaining === null) return 'exam-timer';
    if (timeRemaining <= 300) return 'exam-timer exam-timer--flash-5'; // 5 min
    if (timeRemaining <= 600) return 'exam-timer exam-timer--flash-10'; // 10 min
    return 'exam-timer';
  };

  return (
    <div
      className={`page exam-page exam-page--stepper exam-page--profile-tone text-size-${textSize}`}
      data-theme={theme}
      style={{
        '--exam-font-size': `${fontSize}%`,
        filter: `brightness(${brightness}%)`,
        fontFamily: 'Lexend, sans-serif'
      }}
    >
      {listeningResumeNotice && (
        <div className="listening-resume-toast" role="status" aria-live="polite">
          {listeningResumeNotice}
        </div>
      )}
      <header className="exam-header">
        <div className="exam-header-main">
          <div className="exam-header-left">
            <div className="exam-title-group">
              <div className="exam-part-main">
                <span className="exam-part-label">{step.label}</span>
                <span className="exam-part-title-text">{step.item.title || "Read the text and answer questions"}</span>
              </div>
            </div>
          </div>

          <div className="exam-header-right">
            <Link to={exitTestPath} className="btn-exit-test">
              Exit Test
            </Link>
            <div className="exam-timer-wrapper" role="status" aria-live="polite">
              {timeRemaining !== null && (
                <div className={getTimerClass()}>
                  <Clock3 className="exam-timer-icon" size={15} />
                  <span className="exam-timer-text">{formatTime(timeRemaining)} remaining</span>
                </div>
              )}
            </div>

            <Suspense fallback={null}>
              <IELTSSettings
              brightness={brightness}
              setBrightness={setBrightness}
              textSize={textSize}
              setTextSize={setTextSize}
              theme={theme}
              setTheme={setTheme}
            />
          </Suspense>

          <button
            type="button"
            className="btn-finish-test"
            onClick={handleSubmit}
            disabled={submitLoading}
          >
            {submitLoading ? 'Submitting...' : 'Finish Test'}
          </button>
        </div>
        </div>
      </header>

      {submitError && (
        <div className="exam-submit-error">
          <strong>Submit failed:</strong> {submitError}
          <button
            type="button"
            className="exam-submit-error__retry"
            onClick={() => performSubmit(false)}
            disabled={submitLoading}
          >
            {submitLoading ? 'Retrying...' : 'Retry submit'}
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="exam-form" onKeyDown={(e) => {
        // Prevent Enter key from submitting the form unexpectedly
        if (e.key === 'Enter') {
          const target = e.target;
          // Allow Enter in textareas for new lines
          if (target.tagName === 'TEXTAREA') {
            return;
          }
          // Prevent submission for standard inputs or the form itself
          if (target.tagName === 'INPUT' || target === e.currentTarget) {
            e.preventDefault();
          }
        }
      }}>
        {isWriting ? (
          <WritingStepContent
            step={step}
            writingAnswers={writingAnswers}
            setWritingAnswer={setWritingAnswer}
          />
        ) : (
          <StepContent
            step={step}
            slots={slots}
            answers={answers}
            setAnswer={setAnswer}
            showResult={submitted}
            passageStates={passageStates}
            setPassageState={setPassageState}
            listeningAudioUrl={listeningAudioUrl}
            onListeningAudioEnded={handleListeningAudioEnded}
            listeningAudioInitialTimeSec={listeningAudioInitialTimeSec}
            onListeningAudioTimeUpdate={handleListeningAudioTimeUpdate}
            useMobileReadingDrawer={useMobileReadingDrawer}
            isMobileViewport={isViewport860}
            strikethroughNamespace={id}
          />
        )}
      </form>

      {showSubmitConfirm && (
        <div className="note-modal-overlay" onClick={() => setShowSubmitConfirm(false)}>
          <div className="note-modal" onClick={e => e.stopPropagation()}>
            <div className="note-modal-header">
              <h3>Finish Test?</h3>
              <button type="button" onClick={() => setShowSubmitConfirm(false)}>✕</button>
            </div>
            <div style={{ padding: '10px 0', color: '#475569' }}>
              Are you sure you want to finish the test? You won't be able to change your answers after submitting.
            </div>
            <div className="note-modal-actions">
              <button type="button" className="btn-save" onClick={() => performSubmit(false)} disabled={submitLoading}>
                {submitLoading ? 'Submitting...' : 'Yes, Finish'}
              </button>
              <button type="button" className="btn-cancel" onClick={() => setShowSubmitConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showScoreChoice && (
        <div className="note-modal-overlay" onClick={() => setShowScoreChoice(false)}>
          <div className="note-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="note-modal-header">
              <h3>Choose Scoring Method</h3>
              <button type="button" onClick={() => setShowScoreChoice(false)}>✕</button>
            </div>
            <div style={{ padding: '15px 0', color: '#475569', textAlign: 'center' }}>
              <p>How would you like to grade your writing?</p>
            </div>
            <div className="note-modal-actions" style={{ flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => handleScoreChoice('ai')}
                disabled={submitLoading}
                style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
              >
                {submitLoading ? 'Submitting...' : '✨ AI Detailed Scoring (Instant)'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => handleScoreChoice('standard')}
                disabled={submitLoading}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Standard Submit (Teacher Grading)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Bottom Footer */}
      <footer className={`exam-footer ${useMobileReadingDrawer ? 'exam-footer--mobile-reading' : ''}`}>
        {!useMobileReadingDrawer ? (
          <div className="exam-footer-center">
            {footerNavigationItems.length > 0 ? (
              <div className="footer-question-nav">
                {footerNavigationItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`footer-q-btn ${item.answered ? 'answered' : ''} ${item.active ? 'active' : ''}`}
                    onClick={() => {
                      if (typeof item.stepIndex === 'number') {
                        setCurrentStep(item.stepIndex);
                        return;
                      }

                      if (typeof item.questionIndex === 'number') {
                        const didJump = jumpToQuestion(item.questionIndex);
                        if (!didJump) {
                          window.requestAnimationFrame(() => {
                            jumpToQuestion(item.questionIndex);
                          });
                        }
                      }
                    }}
                    aria-label={item.ariaLabel}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="exam-footer-empty">No question palette for this part.</span>
            )}
          </div>
        ) : null}

        <div className="exam-footer-right">
          {!isSingleMode && hasSteps && (
            <div className="footer-step-nav">
              {steps.map((s, i) => {
                const stepKey = `${s.type}-${s.startSlotIndex}-${s.endSlotIndex}-${s.label}`;
                return (
                <button
                  key={stepKey || `step-${i}`}
                  type="button"
                  className={`footer-step-btn ${i === currentStep ? 'active' : ''}`}
                  onClick={() => setCurrentStep(i)}
                >
                  {s.label.replace('Passage ', 'Part ')}
                </button>
                );
              })}
            </div>
          )}

          {!isSingleMode && (
            <>
              <button
                type="button"
                className="footer-nav-arrow"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={isFirst}
                title="Previous Part"
              >
                <ChevronLeft size={15} />
              </button>
              <button
                type="button"
                className="footer-nav-arrow"
                onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
                disabled={isLast}
                title="Next Part"
              >
                <ChevronRight size={15} />
              </button>
            </>
          )}
        </div>
      </footer>
    </div >
  );
}

