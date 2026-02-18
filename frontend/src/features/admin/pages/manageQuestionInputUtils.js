export function parseCorrectAnswersRaw(rawValue = '') {
  return String(rawValue)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function extractPlaceholderNumbers(rawText = '') {
  const regex = /\[(\d+)\]/g;
  const values = new Set();
  let match = regex.exec(String(rawText));

  while (match) {
    values.add(Number(match[1]));
    match = regex.exec(String(rawText));
  }

  return Array.from(values).sort((a, b) => a - b);
}

export function buildQuestionsFromPlaceholders({
  rawText = '',
  existingQuestions = [],
  createQuestion,
}) {
  const placeholderNumbers = extractPlaceholderNumbers(rawText);
  if (!placeholderNumbers.length) return [];

  const questionByNumber = new Map(
    (existingQuestions || []).map((question) => [Number(question.q_number), question])
  );

  return placeholderNumbers.map((number) => {
    const existing = questionByNumber.get(number);
    if (existing) return existing;
    return createQuestion(number);
  });
}
