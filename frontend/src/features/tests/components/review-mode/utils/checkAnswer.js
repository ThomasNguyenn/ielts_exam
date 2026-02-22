const normalizeText = (value) => String(value ?? '')
  .trim()
  .replace(/\s+/g, ' ')
  .toUpperCase();

const toNormalizedArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .sort();
  }

  const raw = String(value ?? '').trim();
  if (!raw) return [];

  if (raw.includes(',')) {
    return raw
      .split(',')
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .sort();
  }

  return [normalizeText(raw)];
};

export function checkAnswer(userAnswer, correctAnswer) {
  const expectedArray = toNormalizedArray(correctAnswer);
  const actualArray = toNormalizedArray(userAnswer);

  if (Array.isArray(correctAnswer) || Array.isArray(userAnswer)) {
    if (expectedArray.length !== actualArray.length) return false;
    return expectedArray.every((item, index) => item === actualArray[index]);
  }

  if (!expectedArray.length && !actualArray.length) return true;
  return normalizeText(userAnswer) === normalizeText(correctAnswer);
}

export function formatAnswerDisplay(answer) {
  if (Array.isArray(answer)) {
    const values = answer.map((item) => String(item ?? '').trim()).filter(Boolean);
    return values.length ? values.join(', ') : '(No answer)';
  }

  const value = String(answer ?? '').trim();
  return value || '(No answer)';
}
