import DOMPurify from "dompurify";

const DEFAULT_SANITIZE_OPTIONS = {
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
  FORBID_ATTR: [
    "onerror",
    "onload",
    "onclick",
    "onmouseover",
    "onmouseenter",
    "onmouseleave",
    "onfocus",
    "onblur",
  ],
};

function mergeSanitizeOptions(options = {}) {
  const merged = { ...DEFAULT_SANITIZE_OPTIONS, ...options };

  if (Array.isArray(DEFAULT_SANITIZE_OPTIONS.FORBID_TAGS) && Array.isArray(options.FORBID_TAGS)) {
    merged.FORBID_TAGS = Array.from(new Set([...DEFAULT_SANITIZE_OPTIONS.FORBID_TAGS, ...options.FORBID_TAGS]));
  }

  if (Array.isArray(DEFAULT_SANITIZE_OPTIONS.FORBID_ATTR) && Array.isArray(options.FORBID_ATTR)) {
    merged.FORBID_ATTR = Array.from(new Set([...DEFAULT_SANITIZE_OPTIONS.FORBID_ATTR, ...options.FORBID_ATTR]));
  }

  return merged;
}

export function sanitizeHtml(rawHtml, options = {}) {
  const html = String(rawHtml || "");
  return DOMPurify.sanitize(html, mergeSanitizeOptions(options));
}

export function toSanitizedInnerHtml(rawHtml, options = {}) {
  return { __html: sanitizeHtml(rawHtml, options) };
}
