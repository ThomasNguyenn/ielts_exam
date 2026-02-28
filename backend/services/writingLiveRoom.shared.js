import { randomUUID } from "crypto";

export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_MAX_RETRIES = 12;
export const ROOM_TTL_SECONDS = 15 * 60;
export const TEACHER_DISCONNECT_GRACE_MS = 60_000;
export const PERSIST_DEBOUNCE_MS = 800;
export const WS_PATH = "/ws/writing-live";
export const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const VALID_CRITERIA = new Set([
  "task_response",
  "coherence_cohesion",
  "lexical_resource",
  "grammatical_range_accuracy",
]);
export const VALID_HIGHLIGHT_COLORS = new Set([
  "highlight-yellow",
  "highlight-pink",
  "highlight-blue",
]);
export const HIGHLIGHT_COLOR_ALIASES = new Map([
  ["yellow", "highlight-yellow"],
  ["pink", "highlight-pink"],
  ["blue", "highlight-blue"],
  ["highlight-yellow", "highlight-yellow"],
  ["highlight-pink", "highlight-pink"],
  ["highlight-blue", "highlight-blue"],
]);
export const CRITERION_COLOR_FALLBACK = {
  task_response: "highlight-yellow",
  coherence_cohesion: "highlight-blue",
  lexical_resource: "highlight-pink",
  grammatical_range_accuracy: "highlight-blue",
};

export const LIVE_CONTEXT_FIELDS = [
  "_id",
  "user_id",
  "student_name",
  "student_email",
  "writing_answers",
  "scores",
  "score",
  "status",
  "submitted_at",
  "updatedAt",
  "ai_fast_result",
  "ai_fast_model",
  "ai_fast_scored_at",
  "is_ai_fast_graded",
  "scoring_state",
  "live_feedback",
].join(" ");

export const toRoomCodeKey = (code) => `writing-live:code:${String(code || "").trim().toUpperCase()}`;

export const normalizeCode = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

export const isTeacherRole = (role) => role === "teacher" || role === "admin";

export const toNowIso = () => new Date().toISOString();

export const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

export const toPositiveInteger = (value, fallback = null) => {
  const parsed = Math.floor(toNumber(value, -1));
  if (parsed < 1) return fallback;
  return parsed;
};

export const getFallbackColorFromCriterion = (criterion = "task_response") =>
  CRITERION_COLOR_FALLBACK[String(criterion || "").trim()] || "highlight-yellow";

export const normalizeHighlightColor = (value, fallback = "highlight-yellow") => {
  const normalized = String(value || "").trim().toLowerCase();
  const mapped = HIGHLIGHT_COLOR_ALIASES.get(normalized);
  if (mapped && VALID_HIGHLIGHT_COLORS.has(mapped)) return mapped;
  if (VALID_HIGHLIGHT_COLORS.has(normalized)) return normalized;
  return VALID_HIGHLIGHT_COLORS.has(fallback) ? fallback : "highlight-yellow";
};

export const buildRoomCode = () => {
  let output = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
    output += ROOM_CODE_CHARS[index];
  }
  return output;
};

export const buildError = (code, message, statusCode = 400) => {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
};

export const sanitizeHighlightPayload = ({
  highlight,
  taskText = "",
  fallbackUserId = "",
}) => {
  const start = Math.max(0, Math.floor(toNumber(highlight?.start, -1)));
  const end = Math.max(0, Math.floor(toNumber(highlight?.end, -1)));
  if (start < 0 || end <= start) {
    throw buildError("WRITING_LIVE_INVALID_RANGE", "Invalid highlight range");
  }
  if (end > String(taskText || "").length) {
    throw buildError("WRITING_LIVE_INVALID_RANGE", "Highlight range is outside essay text");
  }

  const criterion = String(highlight?.criterion || "task_response").trim();
  const safeCriterion = VALID_CRITERIA.has(criterion) ? criterion : "task_response";
  const color = normalizeHighlightColor(
    highlight?.color,
    getFallbackColorFromCriterion(safeCriterion),
  );
  const note = String(highlight?.note || "").trim().slice(0, 600);
  const noteIndex = note
    ? toPositiveInteger(highlight?.note_index, null)
    : null;
  const explicitText = String(highlight?.text || "");
  const computedText = String(taskText || "").slice(start, end);
  const text = (explicitText || computedText).trim().slice(0, 1200);

  return {
    id: String(highlight?.id || randomUUID()),
    task_id: String(highlight?.task_id || "").trim(),
    start,
    end,
    text,
    criterion: safeCriterion,
    color,
    note,
    note_index: noteIndex,
    created_at: highlight?.created_at ? new Date(highlight.created_at).toISOString() : toNowIso(),
    created_by: String(highlight?.created_by || fallbackUserId || "").trim(),
  };
};

export const cloneHighlights = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({
      id: String(item?.id || ""),
      task_id: String(item?.task_id || ""),
      start: Math.max(0, Math.floor(toNumber(item?.start, 0))),
      end: Math.max(0, Math.floor(toNumber(item?.end, 0))),
      text: String(item?.text || ""),
      criterion: VALID_CRITERIA.has(String(item?.criterion || ""))
        ? String(item.criterion)
        : "task_response",
      color: normalizeHighlightColor(
        item?.color,
        getFallbackColorFromCriterion(item?.criterion),
      ),
      note: String(item?.note || ""),
      note_index: String(item?.note || "").trim()
        ? toPositiveInteger(item?.note_index, null)
        : null,
      created_at: item?.created_at ? new Date(item.created_at).toISOString() : toNowIso(),
      created_by: String(item?.created_by || ""),
    }))
    .filter((item) => item.id && item.task_id && item.end > item.start);

export const deriveNextNoteIndex = (highlights = [], persistedCounter = null) => {
  const maxNoteIndex = cloneHighlights(highlights).reduce(
    (maxValue, item) => Math.max(maxValue, toPositiveInteger(item?.note_index, 0) || 0),
    0,
  );
  const persisted = toPositiveInteger(persistedCounter, 1) || 1;
  return Math.max(persisted, maxNoteIndex + 1, 1);
};

export const readTaskTextById = (submission = {}, taskId = "") => {
  const answers = Array.isArray(submission?.writing_answers) ? submission.writing_answers : [];
  const answer = answers.find((row) => String(row?.task_id || "") === String(taskId || ""));
  return String(answer?.answer_text || "");
};

export const parseRedisRoomValue = (raw) => {
  try {
    const parsed = JSON.parse(String(raw || "{}"));
    return {
      roomCode: normalizeCode(parsed.roomCode || ""),
      submissionId: String(parsed.submissionId || ""),
      createdBy: String(parsed.createdBy || ""),
      createdAt: parsed.createdAt || null,
      expiresAt: parsed.expiresAt || null,
    };
  } catch {
    return null;
  }
};
