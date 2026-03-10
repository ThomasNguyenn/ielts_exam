import { describe, expect, it } from 'vitest';
import { buildAiReviewPayload } from '../src/features/homework/pages/homeworkAiReview.utils';

describe('buildAiReviewPayload', () => {
  it('builds clean payload from allowed fields only', () => {
    const result = buildAiReviewPayload({
      assignment: { title: 'Homework 1' },
      payload: { test_title: 'Reading Mini Test' },
      promptBlocks: [
        { type: 'instruction', data: { text: '<p>Read and answer</p>' } },
      ],
      answerBlocks: [
        { type: 'answer', data: { text: 'Reference answer text' } },
      ],
      submission: {
        text_answer: 'Student short answer',
        audio_item: { url: 'https://cdn/audio.mp3', mime: 'audio/mpeg' },
        image_items: [
          { url: 'https://cdn/image.png', mime: 'image/png' },
          { url: 'https://cdn/video.mp4', mime: 'video/mp4' },
        ],
      },
      objectiveBlocks: [
        {
          type: 'quiz',
          data: {
            block_id: 'quiz-1',
            questions: [
              {
                id: 'q1',
                question: 'Question 1',
                options: [
                  { id: 'a', text: 'Option A' },
                  { id: 'b', text: 'Option B' },
                ],
              },
            ],
          },
        },
      ],
      objectiveAnswerMaps: {
        quizByQuestionKey: { 'quiz-1:q1': 'b' },
        gapfillByBlankKey: {},
        findMistakeByLineKey: {},
        matchingByBlockKey: {},
      },
    });

    expect(result.canSubmit).toBe(true);
    expect(result.payload.assignmentTitle).toBe('Homework 1');
    expect(result.payload.testTitle).toBe('Reading Mini Test');
    expect(result.payload.promptText).toContain('Read and answer');
    expect(result.payload.referenceAnswerText).toContain('Reference answer text');
    expect(result.payload.studentAnswer.text).toBe('Student short answer');
    expect(result.payload.studentAnswer.audioUrl).toBe('https://cdn/audio.mp3');
    expect(result.payload.studentAnswer.objectiveText).toContain('Quiz - Question 1: Option B');
    expect(Object.prototype.hasOwnProperty.call(result.payload.studentAnswer, 'image_items')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result.payload.studentAnswer, 'video')).toBe(false);
  });

  it('disables submit when only image/video exists', () => {
    const result = buildAiReviewPayload({
      assignment: { title: 'Homework 2' },
      payload: {},
      promptBlocks: [],
      answerBlocks: [],
      submission: {
        image_items: [{ url: 'https://cdn/video.mp4', mime: 'video/mp4' }],
      },
      objectiveBlocks: [],
      objectiveAnswerMaps: {
        quizByQuestionKey: {},
        gapfillByBlankKey: {},
        findMistakeByLineKey: {},
        matchingByBlockKey: {},
      },
    });

    expect(result.canSubmit).toBe(false);
    expect(result.disabledReason).toContain('No prompt and no eligible student answer');
  });

  it('ignores audio url when mime is non-audio', () => {
    const result = buildAiReviewPayload({
      assignment: {},
      payload: {},
      promptBlocks: [],
      answerBlocks: [],
      submission: {
        audio_item: { url: 'https://cdn/file.mp4', mime: 'video/mp4' },
      },
      objectiveBlocks: [],
      objectiveAnswerMaps: {
        quizByQuestionKey: {},
        gapfillByBlankKey: {},
        findMistakeByLineKey: {},
        matchingByBlockKey: {},
      },
    });

    expect(result.payload.studentAnswer.audioUrl).toBe('');
    expect(result.canSubmit).toBe(false);
  });

  it('accepts objective-only submission as valid input', () => {
    const result = buildAiReviewPayload({
      assignment: {},
      payload: {},
      promptBlocks: [],
      answerBlocks: [],
      submission: {},
      objectiveBlocks: [],
      objectiveAnswerMaps: {
        quizByQuestionKey: {},
        gapfillByBlankKey: { blank1: 'answer' },
        findMistakeByLineKey: {},
        matchingByBlockKey: {},
      },
    });

    expect(result.canSubmit).toBe(true);
    expect(result.payload.studentAnswer.objectiveText).toContain('Gapfill - blank1: answer');
  });
});
