export const GAPFILL_MODE_NUMBERED = "numbered";
export const GAPFILL_MODE_PARAGRAPH = "paragraph";
export const GAPFILL_MODES = [GAPFILL_MODE_NUMBERED, GAPFILL_MODE_PARAGRAPH];
export const FIND_MISTAKE_MODE_NUMBERED = "numbered";

const toPlainObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

export const normalizeGapfillMode = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return GAPFILL_MODES.includes(normalized) ? normalized : GAPFILL_MODE_NUMBERED;
};

export const normalizeGapfillBlockData = (data = {}) => {
  const base = toPlainObject(data);
  const mode = normalizeGapfillMode(base.mode);
  const numberedItems = Array.isArray(base.numbered_items)
    ? base.numbered_items.map((item) => String(item || ""))
    : Array.isArray(base.sentences)
      ? base.sentences.map((item) => String(item || ""))
      : [];
  const paragraphText = String(base.paragraph_text || base.text || "");

  return {
    ...base,
    mode,
    prompt: String(base.prompt || ""),
    numbered_items:
      mode === GAPFILL_MODE_NUMBERED
        ? (numberedItems.length > 0 ? numberedItems : [""])
        : numberedItems,
    paragraph_text: paragraphText,
  };
};

export const normalizeFindMistakeBlockData = (data = {}) => {
  const base = toPlainObject(data);
  const numberedItems = Array.isArray(base.numbered_items)
    ? base.numbered_items.map((item) => String(item || ""))
    : Array.isArray(base.sentences)
      ? base.sentences.map((item) => String(item || ""))
      : [];

  return {
    ...base,
    mode: FIND_MISTAKE_MODE_NUMBERED,
    prompt: String(base.prompt || ""),
    numbered_items: numberedItems.length > 0 ? numberedItems : [""],
  };
};

export const parseGapfillToken = (rawToken = "") => {
  const token = String(rawToken || "").trim();
  const options = token
    .split("/")
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (options.length > 1) {
    const correctIndex = options.findIndex((item) => item.startsWith("*"));
    const normalizedOptions = options.map((item) => item.replace(/^\*/, "").trim());
    return {
      type: "choice",
      options: normalizedOptions,
      correctAnswer: correctIndex >= 0 ? normalizedOptions[correctIndex] : "",
      correctIndex: correctIndex >= 0 ? correctIndex : null,
    };
  }

  return {
    type: "text",
    options: [],
    correctAnswer: token.replace(/^\*/, "").trim(),
    correctIndex: null,
  };
};

export const parseGapfillTemplate = (template = "") => {
  const text = String(template || "");
  const parts = [];
  const regex = /\[([^\]]+)\]/g;
  let cursor = 0;
  let blankIndex = 0;
  let match = regex.exec(text);

  while (match) {
    const matchText = String(match[0] || "");
    const tokenText = String(match[1] || "");
    if (match.index > cursor) {
      parts.push({
        kind: "text",
        text: text.slice(cursor, match.index),
      });
    }
    parts.push({
      kind: "blank",
      blankIndex,
      raw: tokenText,
      ...parseGapfillToken(tokenText),
    });
    cursor = match.index + matchText.length;
    blankIndex += 1;
    match = regex.exec(text);
  }

  if (cursor < text.length) {
    parts.push({
      kind: "text",
      text: text.slice(cursor),
    });
  }

  return {
    parts,
    blankCount: blankIndex,
  };
};
