export const formatDate = (value) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const toMonthValue = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}`;
};

export const monthLabel = (month = "") => {
  if (!/^\d{4}-\d{2}$/.test(String(month || ""))) return month || "Unknown";
  const [year, monthNum] = String(month).split("-");
  const date = new Date(Number(year), Number(monthNum) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

export const groupAssignmentsByMonth = (items = []) => {
  const grouped = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const month = String(item?.month || "unknown");
    if (!grouped.has(month)) grouped.set(month, []);
    grouped.get(month).push(item);
  });

  return Array.from(grouped.entries())
    .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
    .map(([month, assignments]) => ({ month, assignments }));
};

export const clampScore = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  const rounded = Math.round(parsed * 10) / 10;
  if (rounded < 0) return 0;
  if (rounded > 10) return 10;
  return rounded;
};

export const normalizeTaskForSubmit = (task = {}, index = 0) => {
  const toNullableString = (value) => {
    if (value === null || value === undefined) return null;
    const normalized = String(value).trim();
    return normalized || null;
  };
  const toNumberOrNull = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    _id: toNullableString(task._id),
    type: toNullableString(task.type) || "custom_task",
    title: toNullableString(task.title) || `Task ${index + 1}`,
    instruction: toNullableString(task.instruction) || "",
    order: Number.isFinite(Number(task.order)) ? Number(task.order) : index,
    resource_mode: toNullableString(task.resource_mode) || "internal",
    resource_ref_type: toNullableString(task.resource_ref_type),
    resource_ref_id: toNullableString(task.resource_ref_id),
    resource_url: toNullableString(task.resource_url),
    resource_storage_key: toNullableString(task.resource_storage_key),
    requires_text: Boolean(task.requires_text),
    requires_image: Boolean(task.requires_image),
    requires_audio: Boolean(task.requires_audio),
    min_words: toNumberOrNull(task.min_words),
    max_words: toNumberOrNull(task.max_words),
  };
};

export const statusLabel = (status = "") => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "published") return "Published";
  if (normalized === "archived") return "Archived";
  if (normalized === "graded") return "Graded";
  if (normalized === "submitted") return "Submitted";
  return "Draft";
};

const normalizeUrl = (rawUrl = "") => {
  const value = String(rawUrl || "").trim();
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    try {
      return new URL(`https://${value}`);
    } catch {
      return null;
    }
  }
};

const extractYoutubeId = (url) => {
  const host = String(url?.hostname || "").replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    return String(url.pathname || "").split("/").filter(Boolean)[0] || null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    const byQuery = url.searchParams.get("v");
    if (byQuery) return byQuery;
    const parts = String(url.pathname || "").split("/").filter(Boolean);
    if (parts[0] === "embed" || parts[0] === "shorts") {
      return parts[1] || null;
    }
  }
  return null;
};

const extractVimeoId = (url) => {
  const host = String(url?.hostname || "").replace(/^www\./, "").toLowerCase();
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const parts = String(url.pathname || "").split("/").filter(Boolean);
    const match = [...parts].reverse().find((part) => /^\d+$/.test(part));
    return match || null;
  }
  return null;
};

const normalizeMediaType = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "image" || normalized === "video") return normalized;
  return "";
};

const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i;
const VIDEO_EXTENSION_PATTERN = /\.(mp4|webm|ogg|mov|m4v|avi|mkv)$/i;

export const resolveVideoPreview = (rawUrl = "") => {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return { kind: "none", src: "", youtubeId: "" };

  const youtubeId = extractYoutubeId(normalized);
  if (youtubeId) {
    return { kind: "youtube", src: normalized.toString(), youtubeId };
  }

  const vimeoId = extractVimeoId(normalized);
  if (vimeoId) {
    return { kind: "vimeo", src: `https://player.vimeo.com/video/${vimeoId}`, youtubeId: "" };
  }

  const path = String(normalized.pathname || "").toLowerCase();
  if (/\.(mp4|webm|ogg|mov|m4v)$/.test(path)) {
    return { kind: "direct", src: normalized.toString(), youtubeId: "" };
  }

  return { kind: "unsupported", src: normalized.toString(), youtubeId: "" };
};

export const inferMediaTypeFromUrl = (rawUrl = "", fallback = "") => {
  const normalized = normalizeUrl(rawUrl);
  const normalizedFallback = normalizeMediaType(fallback);
  if (!normalized) return normalizedFallback;

  const path = String(normalized.pathname || "").toLowerCase();
  if (IMAGE_EXTENSION_PATTERN.test(path)) return "image";
  if (VIDEO_EXTENSION_PATTERN.test(path)) return "video";

  const preview = resolveVideoPreview(normalized.toString());
  if (preview.kind !== "none" && preview.kind !== "unsupported") return "video";
  return normalizedFallback;
};
