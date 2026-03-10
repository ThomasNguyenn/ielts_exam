import { beforeEach, describe, expect, it } from 'vitest';
import { EXAM_DRAFT_VERSION } from '../src/features/tests/pages/exam/constants/examConstants';
import { loadExamDraft } from '../src/features/tests/pages/exam/utils/examStorage';

describe('loadExamDraft', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('restores valid draft and rewinds listening state', () => {
    const key = 'exam-draft:test:full:full';
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: EXAM_DRAFT_VERSION,
        updatedAt: Date.now(),
        isSingleMode: false,
        answers: ['A', 'B'],
        writingAnswers: ['W'],
        currentStep: 1,
        passageStates: { x: '<p>test</p>' },
        timeRemaining: 100,
        startTime: 456,
        listeningAudioIndex: 1,
        listeningAudioPositionSec: 20,
      }),
    );

    const draft = loadExamDraft({
      draftKey: key,
      isSingleMode: false,
      answerCount: 2,
      writingCount: 1,
      maxStep: 3,
      defaultTimeRemaining: 120,
      examType: 'listening',
      listeningQueueLength: 2,
    });

    expect(draft.restored).toBe(true);
    expect(draft.sessionPatch.answers).toEqual(['A', 'B']);
    expect(draft.sessionPatch.writingAnswers).toEqual(['W']);
    expect(draft.sessionPatch.currentStep).toBe(1);
    expect(draft.timeRemaining).toBe(110);
    expect(draft.listening).toMatchObject({
      audioIndex: 1,
      audioPositionSec: 15,
    });
  });

  it('rejects invalid version and clears key', () => {
    const key = 'exam-draft:test:full:full';
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: EXAM_DRAFT_VERSION + 1,
        updatedAt: Date.now(),
        isSingleMode: false,
      }),
    );

    const draft = loadExamDraft({
      draftKey: key,
      isSingleMode: false,
      answerCount: 0,
      writingCount: 0,
      maxStep: 0,
      defaultTimeRemaining: 60,
      examType: 'reading',
      listeningQueueLength: 0,
    });

    expect(draft.restored).toBe(false);
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('rejects draft from different mode', () => {
    const key = 'exam-draft:test:single:1';
    window.localStorage.setItem(
      key,
      JSON.stringify({
        version: EXAM_DRAFT_VERSION,
        updatedAt: Date.now(),
        isSingleMode: true,
      }),
    );

    const draft = loadExamDraft({
      draftKey: key,
      isSingleMode: false,
      answerCount: 0,
      writingCount: 0,
      maxStep: 0,
      defaultTimeRemaining: 60,
      examType: 'reading',
      listeningQueueLength: 0,
    });

    expect(draft.restored).toBe(false);
  });
});
