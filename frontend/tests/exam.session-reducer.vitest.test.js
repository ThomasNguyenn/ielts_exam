import { describe, expect, it } from 'vitest';
import {
  EXAM_SESSION_INITIAL_STATE,
  examSessionReducer,
} from '../src/features/tests/pages/exam/hooks/useExamSession';

describe('examSessionReducer', () => {
  it('resets attempt state with counts and step', () => {
    const state = examSessionReducer(EXAM_SESSION_INITIAL_STATE, {
      type: 'RESET_ATTEMPT',
      payload: {
        answerCount: 3,
        writingCount: 2,
        currentStep: 1,
        startTime: 123,
      },
    });

    expect(state.answers).toEqual(['', '', '']);
    expect(state.writingAnswers).toEqual(['', '']);
    expect(state.currentStep).toBe(1);
    expect(state.startTime).toBe(123);
    expect(state.mode).toBe('test');
    expect(state.submitted).toBeNull();
  });

  it('updates objective and writing answers independently', () => {
    const seed = {
      ...EXAM_SESSION_INITIAL_STATE,
      answers: ['', ''],
      writingAnswers: [''],
    };

    const withObjective = examSessionReducer(seed, {
      type: 'SET_ANSWER',
      payload: { index: 1, value: 'A' },
    });
    const withWriting = examSessionReducer(withObjective, {
      type: 'SET_WRITING_ANSWER',
      payload: { index: 0, value: 'Essay' },
    });

    expect(withObjective.answers).toEqual(['', 'A']);
    expect(withWriting.writingAnswers).toEqual(['Essay']);
  });

  it('hydrates from draft in one patch action', () => {
    const hydrated = examSessionReducer(EXAM_SESSION_INITIAL_STATE, {
      type: 'HYDRATE_FROM_DRAFT',
      payload: {
        answers: ['A'],
        writingAnswers: ['W'],
        currentStep: 2,
        passageStates: { p1: '<p>x</p>' },
        startTime: 999,
      },
    });

    expect(hydrated.answers).toEqual(['A']);
    expect(hydrated.writingAnswers).toEqual(['W']);
    expect(hydrated.currentStep).toBe(2);
    expect(hydrated.passageStates).toEqual({ p1: '<p>x</p>' });
    expect(hydrated.startTime).toBe(999);
    expect(hydrated.mode).toBe('test');
    expect(hydrated.submitted).toBeNull();
  });
});
