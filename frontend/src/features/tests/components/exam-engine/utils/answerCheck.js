function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  if (!raw.includes(',')) return [raw];
  return raw.split(',');
}

function normalizeArray(values) {
  return values
    .map((item) => normalizeText(item).replace(/^[\s\(\[]+|[\s\)\]]+$/g, ''))
    .filter(Boolean)
    .sort();
}

function arraysEqual(left, right) {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

/**
 * Universal answer checker:
 * - case-insensitive
 * - trim + collapse whitespace
 * - array compare sorted
 * - supports multi-word answers
 */
export function checkAnswer(userAnswer, correctAnswer) {
  const isCorrectArray = Array.isArray(correctAnswer) || String(correctAnswer ?? '').includes(',');
  const isUserArray = Array.isArray(userAnswer) || String(userAnswer ?? '').includes(',');

  if (isCorrectArray) {
    const correct = normalizeArray(toArray(correctAnswer));
    const user = normalizeArray(toArray(userAnswer));
    return arraysEqual(user, correct);
  }

  if (isUserArray) {
    const user = normalizeArray(toArray(userAnswer));
    if (user.length !== 1) return false;
    return user[0] === normalizeText(correctAnswer);
  }

  return normalizeText(userAnswer) === normalizeText(correctAnswer);
}

export function checkAnswerMap(answerMap = {}, expectedAnswerList = []) {
  const result = {
    total: 0,
    correct: 0,
    wrong: 0,
    detail: [],
  };

  expectedAnswerList.forEach((item) => {
    const id = String(item.id);
    const userValue = answerMap[id];
    const isCorrect = checkAnswer(userValue, item.correct_answer);

    result.total += 1;
    if (isCorrect) result.correct += 1;
    else result.wrong += 1;

    result.detail.push({
      id,
      isCorrect,
      userAnswer: userValue,
      correctAnswer: item.correct_answer,
    });
  });

  return result;
}

/**
 * Example global answer state shape.
 */
export const EXAMPLE_GLOBAL_ANSWER_STATE = {
  1: 'TRUE',
  2: 'NOT GIVEN',
  3: 'B',
  4: ['A', 'D'],
  5: 'ii',
  6: '1990',
  7: '300',
};
