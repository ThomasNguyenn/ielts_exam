import { useCallback, useEffect, useReducer, useRef } from 'react';

export const EXAM_SESSION_INITIAL_STATE = {
  answers: [],
  writingAnswers: [],
  currentStep: 0,
  passageStates: {},
  submitted: null,
  mode: 'test',
  showSubmitConfirm: false,
  showScoreChoice: false,
  startTime: null,
};

export function examSessionReducer(state, action) {
  switch (action.type) {
    case 'RESET_ATTEMPT': {
      const nextAnswers = Array(action.payload?.answerCount || 0).fill('');
      const nextWritingAnswers = Array(action.payload?.writingCount || 0).fill('');
      return {
        ...EXAM_SESSION_INITIAL_STATE,
        answers: nextAnswers,
        writingAnswers: nextWritingAnswers,
        currentStep: action.payload?.currentStep || 0,
        startTime: action.payload?.startTime || Date.now(),
      };
    }
    case 'HYDRATE_FROM_DRAFT':
      return {
        ...state,
        ...action.payload,
        mode: 'test',
        submitted: null,
        showSubmitConfirm: false,
        showScoreChoice: false,
      };
    case 'SET_ANSWER': {
      const next = [...state.answers];
      next[action.payload.index] = action.payload.value;
      return {
        ...state,
        answers: next,
      };
    }
    case 'SET_ANSWERS':
      return {
        ...state,
        answers: Array.isArray(action.payload) ? action.payload : state.answers,
      };
    case 'SET_WRITING_ANSWER': {
      const next = [...state.writingAnswers];
      next[action.payload.index] = action.payload.value;
      return {
        ...state,
        writingAnswers: next,
      };
    }
    case 'SET_WRITING_ANSWERS':
      return {
        ...state,
        writingAnswers: Array.isArray(action.payload) ? action.payload : state.writingAnswers,
      };
    case 'SET_CURRENT_STEP':
      return {
        ...state,
        currentStep: Math.max(0, Number(action.payload) || 0),
      };
    case 'SET_PASSAGE_STATES':
      return {
        ...state,
        passageStates: action.payload && typeof action.payload === 'object' ? action.payload : state.passageStates,
      };
    case 'SET_SUBMITTED':
      return {
        ...state,
        submitted: action.payload || null,
      };
    case 'SET_MODE':
      return {
        ...state,
        mode: action.payload === 'review' ? 'review' : 'test',
      };
    case 'SET_SHOW_SUBMIT_CONFIRM':
      return {
        ...state,
        showSubmitConfirm: Boolean(action.payload),
      };
    case 'SET_SHOW_SCORE_CHOICE':
      return {
        ...state,
        showScoreChoice: Boolean(action.payload),
      };
    case 'SET_START_TIME':
      return {
        ...state,
        startTime: action.payload,
      };
    default:
      return state;
  }
}

export default function useExamSession() {
  const [state, dispatch] = useReducer(examSessionReducer, EXAM_SESSION_INITIAL_STATE);
  const stateRef = useRef(state);
  const answersRef = useRef(state.answers);
  const writingAnswersRef = useRef(state.writingAnswers);

  useEffect(() => {
    stateRef.current = state;
    answersRef.current = state.answers;
    writingAnswersRef.current = state.writingAnswers;
  }, [state]);

  const resetAttempt = useCallback(({ answerCount, writingCount, currentStep, startTime }) => {
    dispatch({
      type: 'RESET_ATTEMPT',
      payload: { answerCount, writingCount, currentStep, startTime },
    });
  }, []);

  const hydrateFromDraft = useCallback((restoredState) => {
    dispatch({ type: 'HYDRATE_FROM_DRAFT', payload: restoredState });
  }, []);

  const setAnswer = useCallback((index, value) => {
    dispatch({ type: 'SET_ANSWER', payload: { index, value } });
  }, []);

  const setWritingAnswer = useCallback((index, value) => {
    dispatch({ type: 'SET_WRITING_ANSWER', payload: { index, value } });
  }, []);

  const setCurrentStep = useCallback((value) => {
    dispatch({ type: 'SET_CURRENT_STEP', payload: value });
  }, []);

  const setPassageState = useCallback((nextValueOrUpdater) => {
    const current = stateRef.current.passageStates;
    const next = typeof nextValueOrUpdater === 'function'
      ? nextValueOrUpdater(current)
      : nextValueOrUpdater;
    dispatch({ type: 'SET_PASSAGE_STATES', payload: next });
  }, []);

  const openSubmitConfirm = useCallback(() => {
    dispatch({ type: 'SET_SHOW_SUBMIT_CONFIRM', payload: true });
  }, []);

  const closeSubmitConfirm = useCallback(() => {
    dispatch({ type: 'SET_SHOW_SUBMIT_CONFIRM', payload: false });
  }, []);

  const openScoreChoice = useCallback(() => {
    dispatch({ type: 'SET_SHOW_SCORE_CHOICE', payload: true });
  }, []);

  const closeScoreChoice = useCallback(() => {
    dispatch({ type: 'SET_SHOW_SCORE_CHOICE', payload: false });
  }, []);

  const setSubmitted = useCallback((payload) => {
    dispatch({ type: 'SET_SUBMITTED', payload });
  }, []);

  const enterReviewMode = useCallback(() => {
    dispatch({ type: 'SET_MODE', payload: 'review' });
  }, []);

  const exitReviewMode = useCallback(() => {
    dispatch({ type: 'SET_MODE', payload: 'test' });
  }, []);

  const setStartTime = useCallback((value) => {
    dispatch({ type: 'SET_START_TIME', payload: value });
  }, []);

  return {
    state,
    stateRef,
    dispatch,
    answersRef,
    writingAnswersRef,
    resetAttempt,
    hydrateFromDraft,
    setAnswer,
    setWritingAnswer,
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
  };
}
