const PLACEHOLDER_REGEX = /\[(\d+)\]/g;

export function extractPlaceholderIds(rawText = '') {
  if (typeof rawText !== 'string' || !rawText) return [];

  const seen = new Set();
  let match = PLACEHOLDER_REGEX.exec(rawText);

  while (match) {
    seen.add(String(match[1]));
    match = PLACEHOLDER_REGEX.exec(rawText);
  }

  PLACEHOLDER_REGEX.lastIndex = 0;
  return Array.from(seen);
}

export function splitByPlaceholders(rawText = '') {
  if (typeof rawText !== 'string' || rawText.length === 0) {
    return [{ type: 'text', value: '' }];
  }

  const tokens = [];
  let cursor = 0;
  let match = PLACEHOLDER_REGEX.exec(rawText);

  while (match) {
    const [fullMatch, id] = match;
    const start = match.index;

    if (start > cursor) {
      tokens.push({ type: 'text', value: rawText.slice(cursor, start) });
    }

    tokens.push({
      type: 'placeholder',
      raw: fullMatch,
      id: String(id),
    });

    cursor = start + fullMatch.length;
    match = PLACEHOLDER_REGEX.exec(rawText);
  }

  if (cursor < rawText.length) {
    tokens.push({ type: 'text', value: rawText.slice(cursor) });
  }

  PLACEHOLDER_REGEX.lastIndex = 0;
  return tokens;
}

export function hasPlaceholder(rawText = '') {
  if (typeof rawText !== 'string' || !rawText) return false;
  const result = PLACEHOLDER_REGEX.test(rawText);
  PLACEHOLDER_REGEX.lastIndex = 0;
  return result;
}
