import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import StepContent from '../../components/exam/StepContent';
import WritingStepContent from '../../components/exam/WritingStepContent';
import useExamLoader from './hooks/useExamLoader';
import useExamSession from './hooks/useExamSession';
import useExamTimer from './hooks/useExamTimer';
import useExamTracking from './hooks/useExamTracking';
import useExamDraft from './hooks/useExamDraft';
import useExamSubmit from './hooks/useExamSubmit';
import useListeningController from './hooks/useListeningController';
import ExamHeader from './components/ExamHeader';
import ExamFooter from './components/ExamFooter';
import ExamSubmitModals from './components/ExamSubmitModals';
import ExamErrorBanner from './components/ExamErrorBanner';
import ExamResultView from './components/ExamResultView';
import { MOBILE_READING_DRAWER_MAX_WIDTH } from './constants/examConstants';
import {
  formatTime,
  parseExamRouteParams,
  resolveRequestedStepIndex,
  resolveTrackedResourceRefType,
  resolveDurationSec,
} from './utils/examMappers';
import {
  getCurrentStepAnswered,
  getCurrentStepTotal,
  getCurrentWritingTaskIndex,
  getFooterNavigationItems,
  getQuestionRangeLabel,
  getStepQuestionIndices,
  getWritingStepIndices,
} from './utils/examSelectors';
import { buildQuestionSlots, buildSteps } from '../examHelpers';
import '../Exam.css';

const IELTSSettings = lazy(() => import('@/shared/components/IELTSSettings'));

export default function ExamPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const route = useMemo(
    () => parseExamRouteParams({ id, search: location.search }),
    [id, location.search],
  );

  const loader = useExamLoader(id);
  const exam = loader.exam;
  const slots = useMemo(() => (exam ? buildQuestionSlots(exam) : []), [exam]);
  const steps = useMemo(() => (exam ? buildSteps(exam) : []), [exam]);

  const session = useExamSession();
  const {
    state,
    answersRef,
    writingAnswersRef,
    resetAttempt,
    hydrateFromDraft,
    setAnswer: setSessionAnswer,
    setWritingAnswer: setSessionWritingAnswer,
    setCurrentStep,
    setPassageState,
    openSubmitConfirm,
    closeSubmitConfirm,
    openScoreChoice,
    closeScoreChoice,
    setSubmitted,
    enterReviewMode,
    exitReviewMode,
    setStartTime,
  } = session;

  const initialStepIndex = useMemo(() => (
    route.isSingleMode
      ? resolveRequestedStepIndex(route.singleModeSearch, steps)
      : 0
  ), [route.isSingleMode, route.singleModeSearch, steps]);

  useEffect(() => {
    if (!exam || loader.loading) return;

    resetAttempt({
      answerCount: slots.length,
      writingCount: (exam.writing || []).length,
      currentStep: initialStepIndex,
      startTime: Date.now(),
    });
  }, [
    exam,
    loader.loading,
    route.examMode,
    route.examPart,
    slots.length,
    initialStepIndex,
    resetAttempt,
  ]);

  const listening = useListeningController({
    exam,
    steps,
    currentStep: state.currentStep,
    isSingleMode: route.isSingleMode,
    onStepChange: setCurrentStep,
  });

  const step = steps[state.currentStep];
  const durationSec = useMemo(() => resolveDurationSec({
    exam,
    isSingleMode: route.isSingleMode,
    currentStep: steps[initialStepIndex],
  }), [exam, route.isSingleMode, steps, initialStepIndex]);

  const submitRef = useRef({ autoSubmit: () => {} });
  const timer = useExamTimer({
    durationSec,
    enabled: Boolean(exam && !state.submitted),
    onExpire: () => {
      submitRef.current?.autoSubmit?.();
    },
  });

  const [theme, setTheme] = useState('light');
  const [textSize, setTextSize] = useState('regular');
  const [brightness, setBrightness] = useState(100);
  const [fontSize] = useState(100);
  const [isViewport860, setIsViewport860] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${MOBILE_READING_DRAWER_MAX_WIDTH}px)`).matches;
  });

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

  const shouldPersistExamDraft = Boolean(exam?.is_real_test) && !route.isSingleMode;
  const shouldTrackHomeworkActivity = Boolean(String(route.hwctx || '').trim());

  const trackedResourceRefType = useMemo(
    () => resolveTrackedResourceRefType(exam),
    [exam],
  );
  const trackedResourceRefId = String(exam?.testId || id || '');

  const tracking = useExamTracking({
    enabled: shouldTrackHomeworkActivity,
    examId: id,
    exam,
    loading: loader.loading,
    submitted: state.submitted,
    hwctx: route.hwctx,
    resourceRefType: trackedResourceRefType,
    resourceRefId: trackedResourceRefId,
  });

  const setAnswer = useCallback((index, value) => {
    tracking.queueAnswer(`q-${Number(index) + 1}`, value);
    setSessionAnswer(index, value);
  }, [tracking, setSessionAnswer]);

  const setWritingAnswer = useCallback((taskIndex, value) => {
    tracking.queueAnswer(`writing-${Number(taskIndex) + 1}`, value);
    setSessionWritingAnswer(taskIndex, value);
  }, [tracking, setSessionWritingAnswer]);

  const defaultTimeRemaining = durationSec;

  const draft = useExamDraft({
    exam,
    loading: loader.loading,
    submitted: state.submitted,
    draftKey: route.draftKey,
    isSingleMode: route.isSingleMode,
    shouldPersistExamDraft,
    slots,
    steps,
    initialStepIndex,
    defaultTimeRemaining,
    sessionState: state,
    answersRef,
    writingAnswersRef,
    hydrateFromDraft,
    setCurrentStep,
    setStartTime,
    timeRemaining: timer.timeRemaining,
    setTimeRemaining: timer.setTimeRemaining,
    listeningAudioQueueLength: listening.listeningAudioQueue.length,
    listeningAudioProgressRef: listening.listeningAudioProgressRef,
    listeningAudioIndex: listening.listeningAudioIndex,
    restoreListeningFromDraft: listening.restoreFromDraft,
    resetListening: listening.reset,
  });

  const handleSubmitted = useCallback((resultData) => {
    setSubmitted(resultData);
    exitReviewMode();
  }, [setSubmitted, exitReviewMode]);

  const submit = useExamSubmit({
    examId: id,
    exam,
    steps,
    currentStep: state.currentStep,
    isSingleMode: route.isSingleMode,
    hwctx: route.hwctx,
    trackedResourceRefType,
    trackedResourceRefId,
    answersRef,
    writingAnswersRef,
    passageStates: state.passageStates,
    timeRemaining: timer.timeRemaining,
    startTime: state.startTime,
    submitted: state.submitted,
    tracking,
    clearDraft: draft.clearDraft,
    stopTimer: timer.pauseTimer,
    closeSubmitConfirm,
    closeScoreChoice,
    onSubmitted: handleSubmitted,
    navigate,
  });

  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  const isStandaloneExam =
    Boolean(exam?.is_standalone) ||
    route.standaloneTypeFromQuery === 'reading' ||
    route.standaloneTypeFromQuery === 'listening' ||
    route.standaloneTypeFromQuery === 'writing';

  const exitTestPath = isStandaloneExam ? '/student-ielts/tests' : `/student-ielts/tests/${id}`;

  const isFirst = state.currentStep === 0;
  const isLast = state.currentStep === steps.length - 1;
  const isWriting = Boolean(step && step.type === 'writing');
  const useMobileReadingDrawer = Boolean(step?.type === 'reading' && isViewport860);

  const writingStepIndices = useMemo(
    () => getWritingStepIndices(steps),
    [steps],
  );

  const currentWritingTaskIndex = useMemo(() => getCurrentWritingTaskIndex({
    writingStepIndices,
    currentStep: state.currentStep,
  }), [writingStepIndices, state.currentStep]);

  const stepQuestionIndices = useMemo(() => getStepQuestionIndices({
    step,
    isWriting,
  }), [step, isWriting]);

  const currentStepTotal = getCurrentStepTotal({ isWriting, stepQuestionIndices });
  const currentStepAnswered = useMemo(() => getCurrentStepAnswered({
    isWriting,
    currentWritingTaskIndex,
    writingAnswers: state.writingAnswers,
    stepQuestionIndices,
    answers: state.answers,
  }), [
    isWriting,
    currentWritingTaskIndex,
    state.writingAnswers,
    stepQuestionIndices,
    state.answers,
  ]);
  const currentStepCompletion = currentStepTotal > 0 ? Math.round((currentStepAnswered / currentStepTotal) * 100) : 0;

  const questionRangeLabel = useMemo(() => getQuestionRangeLabel({
    step,
    isWriting,
    currentWritingTaskIndex,
    writingStepCount: writingStepIndices.length,
    stepQuestionIndices,
    slots,
  }), [step, isWriting, currentWritingTaskIndex, writingStepIndices.length, stepQuestionIndices, slots]);

  const footerNavigationItems = useMemo(() => getFooterNavigationItems({
    step,
    isWriting,
    writingStepIndices,
    writingAnswers: state.writingAnswers,
    currentStep: state.currentStep,
    stepQuestionIndices,
    slots,
    answers: state.answers,
  }), [
    step,
    isWriting,
    writingStepIndices,
    state.writingAnswers,
    state.currentStep,
    stepQuestionIndices,
    slots,
    state.answers,
  ]);

  const jumpToQuestion = useCallback((questionIndex) => {
    if (!Number.isFinite(questionIndex)) return false;

    const index = Number(questionIndex);
    const target =
      document.querySelector(`[data-question-index="${index}"]`) ||
      document.getElementById(`q-${index}`);

    if (!target) return false;

    const scrollContainer = target.closest(
      '.questions-scrollable, .listening-content-area-top-padded, .passage-scrollable',
    );

    if (scrollContainer) {
      const targetRect = target.getBoundingClientRect();
      const containerRect = scrollContainer.getBoundingClientRect();
      const nextTop = targetRect.top - containerRect.top + scrollContainer.scrollTop - 14;
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

  const handleSubmitIntent = useCallback((event) => {
    if (event) event.preventDefault();

    submit.setSubmitError(null);
    if (isWriting && route.isSingleMode && !exam?.is_real_test) {
      openScoreChoice();
    } else {
      openSubmitConfirm();
    }
  }, [submit, isWriting, route.isSingleMode, exam?.is_real_test, openScoreChoice, openSubmitConfirm]);

  const handleFooterSelect = useCallback((item) => {
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
  }, [setCurrentStep, jumpToQuestion]);

  if (loader.loading) {
    return <div className="page"><p className="muted">Loading exam...</p></div>;
  }

  if (loader.error) {
    return (
      <div className="page">
        <p className="error">{loader.error}</p>
        <Link to="/student-ielts/tests">Back to tests</Link>
      </div>
    );
  }

  if (!exam) {
    return <div className="page"><p className="muted">Exam not found.</p></div>;
  }

  if (state.submitted) {
    return (
      <ExamResultView
        submitted={state.submitted}
        exam={exam}
        mode={state.mode}
        currentStep={state.currentStep}
        setCurrentStep={setCurrentStep}
        steps={steps}
        slots={slots}
        passageStates={state.passageStates}
        setPassageState={setPassageState}
        listeningAudioUrl={listening.listeningAudioUrl}
        onListeningAudioEnded={listening.handleAudioEnded}
        isSingleMode={route.isSingleMode}
        strikethroughNamespace={id}
        onEnterReview={() => {
          if (!route.isSingleMode) setCurrentStep(0);
          enterReviewMode();
        }}
        onBackToResult={exitReviewMode}
        startTime={state.startTime}
      />
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

  return (
    <div
      className={`page exam-page exam-page--stepper exam-page--profile-tone text-size-${textSize}`}
      data-theme={theme}
      style={{
        '--exam-font-size': `${fontSize}%`,
        filter: `brightness(${brightness}%)`,
        fontFamily: 'Lexend, sans-serif',
      }}
    >
      <ExamHeader
        step={step}
        exitTestPath={exitTestPath}
        timeLabel={formatTime(timer.timeRemaining)}
        timeRemaining={timer.timeRemaining}
        warningLevel={timer.warningLevel}
        listeningResumeNotice={listening.listeningResumeNotice}
        SettingsComponent={IELTSSettings}
        brightness={brightness}
        setBrightness={setBrightness}
        textSize={textSize}
        setTextSize={setTextSize}
        theme={theme}
        setTheme={setTheme}
        onSubmit={handleSubmitIntent}
        submitLoading={submit.submitLoading}
      />

      <ExamErrorBanner
        submitError={submit.submitError}
        submitLoading={submit.submitLoading}
        onRetry={submit.retrySubmit}
      />

      <form
        onSubmit={handleSubmitIntent}
        className="exam-form"
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            const target = event.target;
            if (target.tagName === 'TEXTAREA') {
              return;
            }
            if (target.tagName === 'INPUT' || target === event.currentTarget) {
              event.preventDefault();
            }
          }
        }}
      >
        {isWriting ? (
          <WritingStepContent
            step={step}
            writingAnswers={state.writingAnswers}
            setWritingAnswer={setWritingAnswer}
          />
        ) : (
          <StepContent
            step={step}
            slots={slots}
            answers={state.answers}
            setAnswer={setAnswer}
            showResult={state.submitted}
            passageStates={state.passageStates}
            setPassageState={setPassageState}
            listeningAudioUrl={listening.listeningAudioUrl}
            onListeningAudioEnded={listening.handleAudioEnded}
            listeningAudioInitialTimeSec={listening.listeningAudioInitialTimeSec}
            onListeningAudioTimeUpdate={listening.handleAudioTimeUpdate}
            useMobileReadingDrawer={useMobileReadingDrawer}
            isMobileViewport={isViewport860}
            strikethroughNamespace={id}
          />
        )}
      </form>

      <ExamSubmitModals
        showSubmitConfirm={state.showSubmitConfirm}
        showScoreChoice={state.showScoreChoice}
        submitLoading={submit.submitLoading}
        onCloseSubmitConfirm={closeSubmitConfirm}
        onConfirmSubmit={submit.submit}
        onCloseScoreChoice={closeScoreChoice}
        onChooseScoreMode={submit.chooseScoreMode}
      />

      <ExamFooter
        useMobileReadingDrawer={useMobileReadingDrawer}
        footerNavigationItems={footerNavigationItems}
        onPaletteSelect={handleFooterSelect}
        isSingleMode={route.isSingleMode}
        hasSteps={hasSteps}
        steps={steps}
        currentStep={state.currentStep}
        setCurrentStep={setCurrentStep}
        isFirst={isFirst}
        isLast={isLast}
        questionRangeLabel={questionRangeLabel}
        currentStepCompletion={currentStepCompletion}
      />
    </div>
  );
}
