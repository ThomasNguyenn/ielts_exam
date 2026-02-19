export function buildPassageHighlightSegments(passageText = '', referenceText = '') {
  const source = String(passageText ?? '');
  const reference = String(referenceText ?? '').trim();

  if (!source) return [{ text: '', highlight: false }];
  if (!reference) return [{ text: source, highlight: false }];

  const sourceLower = source.toLowerCase();
  const referenceLower = reference.toLowerCase();
  const start = sourceLower.indexOf(referenceLower);

  if (start < 0) {
    return [{ text: source, highlight: false }];
  }

  const end = start + reference.length;
  const before = source.slice(0, start);
  const match = source.slice(start, end);
  const after = source.slice(end);

  return [
    { text: before, highlight: false },
    { text: match, highlight: true },
    { text: after, highlight: false },
  ].filter((segment) => segment.text.length > 0);
}
