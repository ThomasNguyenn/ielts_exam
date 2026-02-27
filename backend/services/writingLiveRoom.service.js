import { randomUUID } from "crypto";
import IORedis from "ioredis";
import { WebSocket, WebSocketServer } from "ws";
import WritingSubmission from "../models/WritingSubmission.model.js";
import { getRedisUrl } from "../config/queue.config.js";
import { verifyAccessToken } from "../middleware/auth.middleware.js";

const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_MAX_RETRIES = 12;
const ROOM_TTL_SECONDS = 15 * 60;
const TEACHER_DISCONNECT_GRACE_MS = 60_000;
const PERSIST_DEBOUNCE_MS = 800;
const WS_PATH = "/ws/writing-live";
const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const VALID_CRITERIA = new Set([
  "task_response",
  "coherence_cohesion",
  "lexical_resource",
  "grammatical_range_accuracy",
]);
const LIVE_CONTEXT_FIELDS = [
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

let redisClient = null;
let wsServer = null;
let wsAttachedHttpServer = null;
let wsInitialized = false;
let redisErrorLogged = false;

const rooms = new Map();

const toRoomCodeKey = (code) => `writing-live:code:${String(code || "").trim().toUpperCase()}`;

const normalizeCode = (value = "") =>
  String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const isTeacherRole = (role) => role === "teacher" || role === "admin";

const toNowIso = () => new Date().toISOString();

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const buildRoomCode = () => {
  let output = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * ROOM_CODE_CHARS.length);
    output += ROOM_CODE_CHARS[index];
  }
  return output;
};

const buildError = (code, message, statusCode = 400) => {
  const err = new Error(message);
  err.code = code;
  err.statusCode = statusCode;
  return err;
};

const createRedisClient = () => {
  const redisUrl = getRedisUrl();
  if (!redisUrl) return null;

  const client = new IORedis(redisUrl, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: false,
    connectTimeout: 2000,
  });

  client.on("error", (error) => {
    if (!redisErrorLogged) {
      redisErrorLogged = true;
      console.warn("[writing-live] Redis unavailable:", error?.message || "Unknown error");
    }
  });

  client.on("ready", () => {
    redisErrorLogged = false;
  });

  return client;
};

const getRedisClient = () => {
  if (redisClient) return redisClient;
  redisClient = createRedisClient();
  return redisClient;
};

const sanitizeHighlightPayload = ({
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
  const note = String(highlight?.note || "").trim().slice(0, 600);
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
    note,
    created_at: highlight?.created_at ? new Date(highlight.created_at).toISOString() : toNowIso(),
    created_by: String(highlight?.created_by || fallbackUserId || "").trim(),
  };
};

const cloneHighlights = (items = []) =>
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
      note: String(item?.note || ""),
      created_at: item?.created_at ? new Date(item.created_at).toISOString() : toNowIso(),
      created_by: String(item?.created_by || ""),
    }))
    .filter((item) => item.id && item.task_id && item.end > item.start);

const readTaskTextById = (submission = {}, taskId = "") => {
  const answers = Array.isArray(submission?.writing_answers) ? submission.writing_answers : [];
  const answer = answers.find((row) => String(row?.task_id || "") === String(taskId || ""));
  return String(answer?.answer_text || "");
};

const sendWsMessage = (socket, payload = {}) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(JSON.stringify(payload));
  } catch {
    // Ignore socket send failures.
  }
};

const broadcastRoom = (room, payload = {}, { excludeSocket = null } = {}) => {
  for (const socket of room.sockets.keys()) {
    if (excludeSocket && socket === excludeSocket) continue;
    sendWsMessage(socket, payload);
  }
};

const getTeacherOnline = (room) => room.teacherSockets.size > 0;

const clearRoomPersistTimer = (room) => {
  if (!room.persistTimer) return;
  clearTimeout(room.persistTimer);
  room.persistTimer = null;
};

const clearTeacherCloseTimer = (room) => {
  if (!room.teacherCloseTimer) return;
  clearTimeout(room.teacherCloseTimer);
  room.teacherCloseTimer = null;
};

const toPersistPayload = (room) => ({
  highlights: cloneHighlights(room.highlights),
  active_task_id: room.activeTaskId || null,
  updated_at: new Date(),
  last_room_code: room.roomCode,
});

const flushRoomState = async (room, { force = false } = {}) => {
  if (!room) return;
  if (!room.dirty && !force) return;
  if (room.persistInFlight) {
    await room.persistInFlight;
    return;
  }

  clearRoomPersistTimer(room);
  room.persistInFlight = (async () => {
    const payload = toPersistPayload(room);
    await WritingSubmission.findByIdAndUpdate(room.submissionId, {
      $set: { live_feedback: payload },
    });
    room.dirty = false;
  })()
    .catch((error) => {
      console.warn("[writing-live] Failed to persist room state:", error?.message || "Unknown error");
    })
    .finally(() => {
      room.persistInFlight = null;
    });

  await room.persistInFlight;
};

const scheduleRoomPersist = (room) => {
  room.dirty = true;
  if (room.persistTimer) {
    clearTimeout(room.persistTimer);
  }
  room.persistTimer = setTimeout(() => {
    flushRoomState(room).catch(() => { });
  }, PERSIST_DEBOUNCE_MS);
  room.persistTimer.unref?.();
};

const buildPresencePayload = (room) => ({
  type: "presence_update",
  data: {
    roomCode: room.roomCode,
    teacher_online: getTeacherOnline(room),
    teacher_count: room.teacherSockets.size,
    updated_at: toNowIso(),
  },
});

const buildSnapshotPayload = (room, { expiresAt = null } = {}) => ({
  type: "room_snapshot",
  data: {
    roomCode: room.roomCode,
    submissionId: room.submissionId,
    active_task_id: room.activeTaskId || null,
    highlights: cloneHighlights(room.highlights),
    teacher_online: getTeacherOnline(room),
    teacher_count: room.teacherSockets.size,
    expires_at: expiresAt || null,
    server_time: toNowIso(),
  },
});

const createRoomState = ({ roomCode, submissionId, initialHighlights, activeTaskId }) => ({
  roomCode,
  submissionId: String(submissionId),
  highlights: cloneHighlights(initialHighlights),
  activeTaskId: activeTaskId || null,
  sockets: new Map(),
  teacherSockets: new Set(),
  persistTimer: null,
  persistInFlight: null,
  teacherCloseTimer: null,
  dirty: false,
});

const ensureRoomState = async ({ roomCode, submission }) => {
  const code = normalizeCode(roomCode);
  if (!code) return null;

  const existing = rooms.get(code);
  if (existing) return existing;

  const persisted = submission?.live_feedback || {};
  const room = createRoomState({
    roomCode: code,
    submissionId: submission?._id,
    initialHighlights: persisted?.highlights || [],
    activeTaskId: persisted?.active_task_id || submission?.writing_answers?.[0]?.task_id || null,
  });
  rooms.set(code, room);
  return room;
};

const closeRoom = async (roomCode, { reason = "room_closed", initiatedBy = "system" } = {}) => {
  const code = normalizeCode(roomCode);
  if (!code) return;

  const room = rooms.get(code);
  if (!room) {
    const redis = getRedisClient();
    if (redis) {
      await redis.del(toRoomCodeKey(code)).catch(() => { });
    }
    return;
  }

  clearTeacherCloseTimer(room);
  clearRoomPersistTimer(room);
  await flushRoomState(room, { force: true });

  broadcastRoom(room, {
    type: "room_closed",
    data: {
      roomCode: code,
      reason,
      initiated_by: initiatedBy,
      at: toNowIso(),
    },
  });

  for (const socket of room.sockets.keys()) {
    try {
      socket.close(1000, "Room closed");
    } catch {
      // Ignore close failures.
    }
  }

  rooms.delete(code);

  const redis = getRedisClient();
  if (redis) {
    await redis.del(toRoomCodeKey(code)).catch(() => { });
  }
};

const scheduleTeacherRoomClose = (room) => {
  clearTeacherCloseTimer(room);
  room.teacherCloseTimer = setTimeout(() => {
    closeRoom(room.roomCode, {
      reason: "teacher_offline_timeout",
      initiatedBy: "system",
    }).catch(() => { });
  }, TEACHER_DISCONNECT_GRACE_MS);
  room.teacherCloseTimer.unref?.();
};

const parseRedisRoomValue = (raw) => {
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

export const closeWritingLiveResources = async () => {
  for (const room of rooms.values()) {
    clearRoomPersistTimer(room);
    clearTeacherCloseTimer(room);
    await flushRoomState(room, { force: true });
  }
  rooms.clear();

  if (wsServer) {
    await new Promise((resolve) => {
      try {
        wsServer.close(() => resolve());
      } catch {
        resolve();
      }
    });
  }

  wsServer = null;
  wsAttachedHttpServer = null;
  wsInitialized = false;

  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    } finally {
      redisClient = null;
    }
  }
};

export const createWritingLiveRoom = async ({ submissionId, createdBy }) => {
  const redis = getRedisClient();
  if (!redis) {
    throw buildError(
      "WRITING_LIVE_REDIS_UNAVAILABLE",
      "Redis is required for writing live rooms",
      503,
    );
  }

  const normalizedSubmissionId = String(submissionId || "").trim();
  if (!normalizedSubmissionId) {
    throw buildError("WRITING_LIVE_SUBMISSION_REQUIRED", "submissionId is required");
  }

  for (let attempt = 0; attempt < ROOM_CODE_MAX_RETRIES; attempt += 1) {
    const roomCode = buildRoomCode();
    const expiresAt = new Date(Date.now() + ROOM_TTL_SECONDS * 1000).toISOString();
    const roomValue = JSON.stringify({
      roomCode,
      submissionId: normalizedSubmissionId,
      createdBy: String(createdBy || ""),
      createdAt: toNowIso(),
      expiresAt,
    });

    try {
      const result = await redis.set(
        toRoomCodeKey(roomCode),
        roomValue,
        "EX",
        ROOM_TTL_SECONDS,
        "NX",
      );

      if (result === "OK") {
        return {
          roomCode,
          expiresAt,
          ttlSec: ROOM_TTL_SECONDS,
        };
      }
    } catch (error) {
      throw buildError(
        "WRITING_LIVE_REDIS_UNAVAILABLE",
        `Failed to create room: ${error?.message || "Unknown Redis error"}`,
        503,
      );
    }
  }

  throw buildError("WRITING_LIVE_CODE_COLLISION", "Unable to allocate room code", 503);
};

export const resolveWritingLiveRoom = async (roomCode) => {
  const code = normalizeCode(roomCode);
  if (!code) return null;

  const redis = getRedisClient();
  if (!redis) {
    throw buildError(
      "WRITING_LIVE_REDIS_UNAVAILABLE",
      "Redis is required for writing live rooms",
      503,
    );
  }

  const key = toRoomCodeKey(code);
  let rawValue = null;
  let ttlMs = -1;
  try {
    [rawValue, ttlMs] = await Promise.all([redis.get(key), redis.pttl(key)]);
  } catch (error) {
    throw buildError(
      "WRITING_LIVE_REDIS_UNAVAILABLE",
      `Failed to resolve room code: ${error?.message || "Unknown Redis error"}`,
      503,
    );
  }

  if (!rawValue || ttlMs <= 0) {
    if (ttlMs <= 0) {
      await redis.del(key).catch(() => { });
    }
    return null;
  }

  const parsed = parseRedisRoomValue(rawValue);
  if (!parsed?.roomCode || !parsed?.submissionId) return null;

  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  return {
    ...parsed,
    roomCode: code,
    ttlMs,
    expiresAt,
  };
};

export const getWritingLiveRoomContext = async (roomCode) => {
  const resolved = await resolveWritingLiveRoom(roomCode);
  if (!resolved) return null;

  const submission = await WritingSubmission.findById(resolved.submissionId)
    .select(LIVE_CONTEXT_FIELDS)
    .lean();
  if (!submission) {
    const redis = getRedisClient();
    if (redis) {
      await redis.del(toRoomCodeKey(resolved.roomCode)).catch(() => { });
    }
    return null;
  }

  const inMemoryRoom = rooms.get(resolved.roomCode);
  const persistedFeedback = submission?.live_feedback || {};
  const highlights = inMemoryRoom
    ? cloneHighlights(inMemoryRoom.highlights)
    : cloneHighlights(persistedFeedback.highlights || []);
  const activeTaskId = inMemoryRoom
    ? (inMemoryRoom.activeTaskId || null)
    : (persistedFeedback.active_task_id || submission?.writing_answers?.[0]?.task_id || null);

  return {
    roomCode: resolved.roomCode,
    expiresAt: resolved.expiresAt,
    ttlMs: resolved.ttlMs,
    submission,
    room: {
      teacher_online: inMemoryRoom ? getTeacherOnline(inMemoryRoom) : false,
      teacher_count: inMemoryRoom ? inMemoryRoom.teacherSockets.size : 0,
      active_task_id: activeTaskId,
      highlights,
      teacher_disconnect_grace_ms: TEACHER_DISCONNECT_GRACE_MS,
    },
  };
};

const sendWsError = (socket, code, message) => {
  sendWsMessage(socket, {
    type: "error",
    data: {
      code,
      message,
    },
  });
};

const bindSocketToRoom = ({ room, socket, user }) => {
  room.sockets.set(socket, {
    userId: String(user?.userId || ""),
    role: String(user?.role || ""),
  });

  if (isTeacherRole(user?.role)) {
    room.teacherSockets.add(socket);
    clearTeacherCloseTimer(room);
  }
};

const unbindSocketFromRoom = (room, socket) => {
  if (!room) return;
  room.sockets.delete(socket);
  room.teacherSockets.delete(socket);

  if (room.teacherSockets.size === 0) {
    scheduleTeacherRoomClose(room);
  }
};

const handleTeacherEvent = async ({ room, socket, user, submission, eventType, payload }) => {
  const isTeacher = isTeacherRole(user?.role);
  if (!isTeacher) {
    sendWsError(socket, "WRITING_LIVE_FORBIDDEN", "Only teacher/admin can modify room state");
    return;
  }

  if (eventType === "set_active_task") {
    const taskId = String(payload?.task_id || "").trim();
    const taskText = readTaskTextById(submission, taskId);
    if (!taskId || !taskText) {
      sendWsError(socket, "WRITING_LIVE_INVALID_TASK", "Task not found");
      return;
    }
    room.activeTaskId = taskId;
    scheduleRoomPersist(room);
    broadcastRoom(room, {
      type: "task_changed",
      data: {
        roomCode: room.roomCode,
        active_task_id: taskId,
        changed_by: String(user?.userId || ""),
        at: toNowIso(),
      },
    });
    return;
  }

  if (eventType === "add_highlight") {
    const taskId = String(payload?.task_id || room.activeTaskId || "").trim();
    const taskText = readTaskTextById(submission, taskId);
    if (!taskId || !taskText) {
      sendWsError(socket, "WRITING_LIVE_INVALID_TASK", "Task not found");
      return;
    }

    try {
      const highlight = sanitizeHighlightPayload({
        highlight: { ...payload, task_id: taskId },
        taskText,
        fallbackUserId: String(user?.userId || ""),
      });
      room.highlights.push(highlight);
      room.activeTaskId = taskId;
      scheduleRoomPersist(room);
      broadcastRoom(room, {
        type: "highlight_added",
        data: {
          roomCode: room.roomCode,
          active_task_id: room.activeTaskId || null,
          highlight,
          at: toNowIso(),
        },
      });
    } catch (error) {
      sendWsError(
        socket,
        error?.code || "WRITING_LIVE_INVALID_HIGHLIGHT",
        error?.message || "Invalid highlight payload",
      );
    }
    return;
  }

  if (eventType === "remove_highlight") {
    const highlightId = String(payload?.id || "").trim();
    if (!highlightId) {
      sendWsError(socket, "WRITING_LIVE_HIGHLIGHT_REQUIRED", "Highlight id is required");
      return;
    }
    const before = room.highlights.length;
    room.highlights = room.highlights.filter((item) => String(item?.id || "") !== highlightId);
    if (before === room.highlights.length) return;
    scheduleRoomPersist(room);
    broadcastRoom(room, {
      type: "highlight_removed",
      data: {
        roomCode: room.roomCode,
        id: highlightId,
        at: toNowIso(),
      },
    });
    return;
  }

  if (eventType === "clear_task_highlights") {
    const taskId = String(payload?.task_id || room.activeTaskId || "").trim();
    if (!taskId) {
      sendWsError(socket, "WRITING_LIVE_INVALID_TASK", "Task id is required");
      return;
    }
    room.highlights = room.highlights.filter((item) => String(item?.task_id || "") !== taskId);
    scheduleRoomPersist(room);
    broadcastRoom(room, {
      type: "highlights_cleared",
      data: {
        roomCode: room.roomCode,
        task_id: taskId,
        at: toNowIso(),
      },
    });
    return;
  }

  if (eventType === "end_room") {
    await closeRoom(room.roomCode, {
      reason: "teacher_ended",
      initiatedBy: String(user?.userId || "teacher"),
    });
    return;
  }

  sendWsError(socket, "WRITING_LIVE_UNSUPPORTED_EVENT", `Unsupported event: ${eventType}`);
};

const handleSocketMessage = async ({ room, socket, user, submission, raw }) => {
  let event = null;
  try {
    event = JSON.parse(String(raw || ""));
  } catch {
    sendWsError(socket, "WRITING_LIVE_BAD_JSON", "Message payload must be valid JSON");
    return;
  }

  const eventType = String(event?.type || "").trim();
  const payload = event?.payload || {};
  if (!eventType) {
    sendWsError(socket, "WRITING_LIVE_BAD_EVENT", "Event type is required");
    return;
  }

  if (eventType === "request_snapshot") {
    const resolved = await resolveWritingLiveRoom(room.roomCode).catch(() => null);
    sendWsMessage(socket, buildSnapshotPayload(room, {
      expiresAt: resolved?.expiresAt || null,
    }));
    return;
  }

  await handleTeacherEvent({
    room,
    socket,
    user,
    submission,
    eventType,
    payload,
  });
};

const attachSocketConnectionHandler = () => {
  if (!wsServer) return;

  wsServer.on("connection", async (socket, request, context = {}) => {
    const searchParams = context.searchParams;
    const token = String(searchParams?.get("token") || "").trim();
    const roomCode = normalizeCode(searchParams?.get("roomCode") || "");

    if (!token || !roomCode) {
      sendWsError(socket, "WRITING_LIVE_AUTH_REQUIRED", "token and roomCode are required");
      socket.close(1008, "Missing token or roomCode");
      return;
    }

    let user = null;
    try {
      user = await verifyAccessToken(token);
    } catch (error) {
      sendWsError(socket, "WRITING_LIVE_INVALID_TOKEN", error?.message || "Invalid token");
      socket.close(1008, "Invalid token");
      return;
    }

    let resolved = null;
    try {
      resolved = await resolveWritingLiveRoom(roomCode);
    } catch (error) {
      sendWsError(socket, error?.code || "WRITING_LIVE_REDIS_UNAVAILABLE", error?.message || "Redis error");
      socket.close(1011, "Redis unavailable");
      return;
    }
    if (!resolved) {
      sendWsError(socket, "WRITING_LIVE_ROOM_NOT_FOUND", "Room code expired or invalid");
      socket.close(1008, "Room not found");
      return;
    }

    const submission = await WritingSubmission.findById(resolved.submissionId)
      .select(LIVE_CONTEXT_FIELDS)
      .lean();
    if (!submission) {
      sendWsError(socket, "WRITING_LIVE_SUBMISSION_NOT_FOUND", "Submission not found");
      socket.close(1008, "Submission not found");
      return;
    }

    const room = await ensureRoomState({
      roomCode: resolved.roomCode,
      submission,
    });
    bindSocketToRoom({
      room,
      socket,
      user,
    });

    sendWsMessage(socket, buildSnapshotPayload(room, { expiresAt: resolved.expiresAt }));
    broadcastRoom(room, buildPresencePayload(room), { excludeSocket: null });

    socket.on("message", async (raw) => {
      try {
        await handleSocketMessage({
          room,
          socket,
          user,
          submission,
          raw,
        });
      } catch (error) {
        sendWsError(
          socket,
          error?.code || "WRITING_LIVE_MESSAGE_FAILED",
          error?.message || "Unable to process socket message",
        );
      }
    });

    socket.on("close", () => {
      unbindSocketFromRoom(room, socket);
      broadcastRoom(room, buildPresencePayload(room), { excludeSocket: null });
    });
  });
};

export const attachWritingLiveWebSocketServer = (httpServer) => {
  if (!httpServer || typeof httpServer.on !== "function") {
    throw buildError("WRITING_LIVE_SERVER_REQUIRED", "HTTP server is required");
  }

  if (wsInitialized && wsAttachedHttpServer === httpServer) return wsServer;
  if (wsInitialized && wsAttachedHttpServer && wsAttachedHttpServer !== httpServer) {
    throw buildError("WRITING_LIVE_ALREADY_ATTACHED", "Writing live websocket already attached");
  }

  wsServer = new WebSocketServer({ noServer: true });
  wsAttachedHttpServer = httpServer;
  wsInitialized = true;
  attachSocketConnectionHandler();

  httpServer.on("upgrade", (request, socket, head) => {
    let parsedUrl = null;
    try {
      parsedUrl = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
    } catch {
      socket.destroy();
      return;
    }

    const incomingPath = String(parsedUrl.pathname || "").replace(/\/+$/, "");
    const allowedPaths = new Set([WS_PATH, "/api/ws/writing-live"]);
    if (!allowedPaths.has(incomingPath)) {
      socket.destroy();
      return;
    }

    wsServer.handleUpgrade(request, socket, head, (wsSocket) => {
      wsServer.emit("connection", wsSocket, request, {
        searchParams: parsedUrl.searchParams,
      });
    });
  });

  return wsServer;
};

export const getWritingLiveRoomState = (roomCode) => {
  const code = normalizeCode(roomCode);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;

  return {
    roomCode: room.roomCode,
    submissionId: room.submissionId,
    active_task_id: room.activeTaskId || null,
    teacher_online: getTeacherOnline(room),
    teacher_count: room.teacherSockets.size,
    highlights: cloneHighlights(room.highlights),
  };
};

export const closeWritingLiveRoom = async (roomCode, options = {}) => {
  await closeRoom(roomCode, options);
};
