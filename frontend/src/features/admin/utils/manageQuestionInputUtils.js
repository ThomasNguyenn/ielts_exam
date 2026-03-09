export function parseCorrectAnswersRaw(rawValue = '') {
  return String(rawValue)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

const ROMAN_TO_NUMBER = new Map([
  ['I', 1],
  ['II', 2],
  ['III', 3],
  ['IV', 4],
  ['V', 5],
  ['VI', 6],
  ['VII', 7],
  ['VIII', 8],
  ['IX', 9],
  ['X', 10],
]);

const NUMBER_TO_ROMAN = new Map(Array.from(ROMAN_TO_NUMBER.entries()).map(([roman, number]) => [number, roman]));

export function parseMatchingInformationRange(rawValue = '') {
  const source = String(rawValue || '').trim().toUpperCase();
  if (!source) {
    return { ok: false, error: 'Please enter a range. Example: A-G or I-VII.' };
  }

  const match = source.match(/^([A-Z]+)\s*-\s*([A-Z]+)$/);
  if (!match) {
    return { ok: false, error: 'Invalid format. Use A-G or I-VII.' };
  }

  const startToken = match[1];
  const endToken = match[2];

  const isAlphabetic = /^[A-Z]$/.test(startToken) && /^[A-Z]$/.test(endToken);
  if (isAlphabetic) {
    const startCode = startToken.charCodeAt(0);
    const endCode = endToken.charCodeAt(0);
    if (endCode < startCode) {
      return { ok: false, error: 'Range must be increasing (example: A-G).' };
    }

    const tokens = [];
    for (let code = startCode; code <= endCode; code += 1) {
      tokens.push(String.fromCharCode(code));
    }
    return { ok: true, tokens };
  }

  const startNumber = ROMAN_TO_NUMBER.get(startToken);
  const endNumber = ROMAN_TO_NUMBER.get(endToken);
  if (!startNumber || !endNumber) {
    return { ok: false, error: 'Roman range supports only I-X.' };
  }
  if (endNumber < startNumber) {
    return { ok: false, error: 'Range must be increasing (example: I-VII).' };
  }

  const tokens = [];
  for (let value = startNumber; value <= endNumber; value += 1) {
    const roman = NUMBER_TO_ROMAN.get(value);
    if (!roman) {
      return { ok: false, error: 'Roman range supports only I-X.' };
    }
    tokens.push(roman);
  }

  return { ok: true, tokens };
}

export function buildMatchingInformationHeadingsFromRange(rawValue = '') {
  const parsed = parseMatchingInformationRange(rawValue);
  if (!parsed.ok) return parsed;

  return {
    ok: true,
    headings: parsed.tokens.map((token) => ({
      id: token,
      text: token,
    })),
  };
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
