/**
 * @typedef {Object} ExamSessionState
 * @property {string[]} answers
 * @property {string[]} writingAnswers
 * @property {number} currentStep
 * @property {Record<string, string>} passageStates
 * @property {Object|null} submitted
 * @property {'test'|'review'} mode
 * @property {boolean} showSubmitConfirm
 * @property {boolean} showScoreChoice
 * @property {number|null} startTime
 */

/**
 * @typedef {Object} ExamDraftPayload
 * @property {number} version
 * @property {number} updatedAt
 * @property {boolean} isSingleMode
 * @property {string[]} answers
 * @property {string[]} writingAnswers
 * @property {number} currentStep
 * @property {Record<string, string>} passageStates
 * @property {number|null} timeRemaining
 * @property {number|null} startTime
 * @property {number} listeningAudioIndex
 * @property {number} listeningAudioPositionSec
 */

/**
 * @typedef {Object} ExamTrackingContext
 * @property {boolean} enabled
 * @property {string} examId
 * @property {string} hwctx
 * @property {string} resourceRefType
 * @property {string} resourceRefId
 */

/**
 * @typedef {Object} ExamSubmitResult
 * @property {number} score
 * @property {number} total
 * @property {number} wrong
 * @property {number} timeTaken
 * @property {Array<Object>} question_review
 * @property {string|null} writingSubmissionId
 */

export const EXAM_TYPES_DOC = {
  name: 'exam.types.js',
  version: 1,
};
