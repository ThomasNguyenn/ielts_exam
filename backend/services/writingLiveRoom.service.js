import { WebSocket, WebSocketServer } from "ws";
import WritingSubmission from "../models/WritingSubmission.model.js";
import { verifyAccessToken } from "../middleware/auth.middleware.js";
import { createRedisClientInstance, getRedisClient, closeRedisClient } from "./writingLiveRoom.redis.js";
import { roomStore } from "./writingLiveRoom.rooms.js";
import { createTeacherEventHandler } from "./writingLiveRoom.events.js";
import {
  LIVE_CONTEXT_FIELDS,
  ROOM_CODE_MAX_RETRIES,
  ROOM_TTL_SECONDS,
  TEACHER_DISCONNECT_GRACE_MS,
  WS_PATH,
  buildError,
  buildRoomCode,
  cloneHighlights,
  deriveNextNoteIndex,
  isTeacherRole,
  normalizeCode,
  parseRedisRoomValue,
  toNowIso,
  toPositiveInteger,
  toRoomCodeKey,
} from "./writingLiveRoom.shared.js";

let wsServer = null;
let wsAttachedHttpServer = null;
let wsInitialized = false;

let subClient = null;

const sendWsMessage = (socket, payload = {}) => {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(JSON.stringify(payload));
  } catch {
    // Ignore socket send failures.
  }
};

const broadcastRoom = (room, payload = {}, { excludeSocket = null } = {}) => {
  if (!room?.sockets) return;
  for (const socket of room.sockets.keys()) {
    if (excludeSocket && socket === excludeSocket) continue;
    sendWsMessage(socket, payload);
  }
};

const publishRoomEvent = async (roomCode, event) => {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    const channel = roomStore.toRoomEventChannel(roomCode);
    const message = JSON.stringify(event);
    await redis.publish(channel, message);
  } catch (error) {
    console.warn("[writing-live] Failed to publish room event:", error.message);
  }
};

const initializeSubscription = async () => {
  if (subClient) return;
  subClient = createRedisClientInstance();
  if (!subClient) return;

  try {
    // Subscribe to all room channels using pattern
    await subClient.psubscribe("writing-live:room:*");

    subClient.on("pmessage", (pattern, channel, message) => {
      const roomCode = channel.replace("writing-live:room:", "");
      const room = roomStore.rooms.get(roomCode);
      if (!room) return;

      let event = null;
      try {
        event = JSON.parse(message);
      } catch {
        return;
      }

      // Special case for room_closed: it should trigger local room cleanup
      if (event.type === "room_closed") {
        roomStore.closeRoom(roomCode, {
          reason: event.data?.reason,
          initiatedBy: event.data?.initiated_by,
          onBroadcast: (r, p) => broadcastRoom(r, p),
          onCloseSocket: closeSocketSafe,
        }).catch(() => {});
        return;
      }

      // Apply to memory
      const applied = roomStore.applyExternalEvent(room, event);
      if (applied) {
        // Broadcast to local sockets
        broadcastRoom(room, event);
      }
    });

  } catch (error) {
    console.error("[writing-live] Failed to initialize Redis subscription:", error.message);
  }
};
const closeSocketSafe = (socket, code, reason) => {
  try {
    socket.close(code, reason);
  } catch {
    // Ignore close failures.
  }
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
const closeRoomByCode = async (roomCode, options = {}) => {
  const redis = getRedisClient();
  await roomStore.closeRoom(roomCode, {
    ...options,
    onDeleteRoomCode: async (code) => {
      if (!redis) return;
      await redis.del(toRoomCodeKey(code)).catch(() => {});
    },
    onBroadcast: (room, payload) => {
      broadcastRoom(room, payload);
      publishRoomEvent(room.roomCode, payload);
    },
    onCloseSocket: closeSocketSafe,
  });
};
const handleTeacherEvent = async (context) => {
  const handler = createTeacherEventHandler({
    sendWsError,
    broadcastRoom: (room, event) => {
      // Local broadcast
      broadcastRoom(room, event);
      // Global publish
      publishRoomEvent(room.roomCode, event);
    },
    closeRoomByCode,
    roomStore,
  });
  await handler(context);
};
const resolveWritingLiveRoomInternal = async (roomCode) => {
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
      await redis.del(key).catch(() => {});
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
const handleSocketMessage = async ({ room, socket, user, submission, raw }) => {
  let event = null;
  try {
    event = JSON.parse(String(raw || ""));
  } catch {
    sendWsError(
      socket,
      "WRITING_LIVE_BAD_JSON",
      "Message payload must be valid JSON",
    );
    return;
  }
  const eventType = String(event?.type || "").trim();
  const payload = event?.payload || {};
  if (!eventType) {
    sendWsError(socket, "WRITING_LIVE_BAD_EVENT", "Event type is required");
    return;
  }
  if (eventType === "request_snapshot") {
    const resolved = await resolveWritingLiveRoomInternal(room.roomCode).catch(
      () => null,
    );
    sendWsMessage(
      socket,
      roomStore.buildSnapshotPayload(room, {
        expiresAt: resolved?.expiresAt || null,
      }),
    );
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
  wsServer.on("connection", async (socket, _request, context = {}) => {
    const searchParams = context.searchParams;
    const token = String(searchParams?.get("token") || "").trim();
    const roomCode = normalizeCode(searchParams?.get("roomCode") || "");
    if (!token || !roomCode) {
      sendWsError(
        socket,
        "WRITING_LIVE_AUTH_REQUIRED",
        "token and roomCode are required",
      );
      socket.close(1008, "Missing token or roomCode");
      return;
    }
    let user = null;
    try {
      user = await verifyAccessToken(token);
    } catch (error) {
      sendWsError(
        socket,
        "WRITING_LIVE_INVALID_TOKEN",
        error?.message || "Invalid token",
      );
      socket.close(1008, "Invalid token");
      return;
    }
    let resolved = null;
    try {
      resolved = await resolveWritingLiveRoomInternal(roomCode);
    } catch (error) {
      sendWsError(
        socket,
        error?.code || "WRITING_LIVE_REDIS_UNAVAILABLE",
        error?.message || "Redis error",
      );
      socket.close(1011, "Redis unavailable");
      return;
    }
    if (!resolved) {
      sendWsError(
        socket,
        "WRITING_LIVE_ROOM_NOT_FOUND",
        "Room code expired or invalid",
      );
      socket.close(1008, "Room not found");
      return;
    }
    const submission = await WritingSubmission.findById(resolved.submissionId)
      .select(LIVE_CONTEXT_FIELDS)
      .lean();
    if (!submission) {
      sendWsError(
        socket,
        "WRITING_LIVE_SUBMISSION_NOT_FOUND",
        "Submission not found",
      );
      socket.close(1008, "Submission not found");
      return;
    }
    const room = await roomStore.ensureRoomState({
      roomCode: resolved.roomCode,
      submission,
    });
    roomStore.bindSocketToRoom({ room, socket, user });
    if (isTeacherRole(user?.role)) {
      roomStore.addTeacherSocket(room, socket);
    }
    sendWsMessage(
      socket,
      roomStore.buildSnapshotPayload(room, { expiresAt: resolved.expiresAt }),
    );
    broadcastRoom(room, roomStore.buildPresencePayload(room), {
      excludeSocket: null,
    });
    // Global presence publish
    publishRoomEvent(room.roomCode, roomStore.buildPresencePayload(room));

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
      roomStore.unbindSocketFromRoom(room, socket, closeRoomByCode);
      broadcastRoom(room, roomStore.buildPresencePayload(room), {
        excludeSocket: null,
      });
    });
  });
};
export const closeWritingLiveResources = async () => {
  await roomStore.closeAllRooms();
  if (subClient) {
    try {
      await subClient.quit();
    } catch {
      subClient.disconnect();
    }
    subClient = null;
  }
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
  await closeRedisClient();
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
    throw buildError(
      "WRITING_LIVE_SUBMISSION_REQUIRED",
      "submissionId is required",
    );
  }
  for (let attempt = 0; attempt < ROOM_CODE_MAX_RETRIES; attempt += 1) {
    const roomCode = buildRoomCode();
    const expiresAt = new Date(
      Date.now() + ROOM_TTL_SECONDS * 1000,
    ).toISOString();
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
  throw buildError(
    "WRITING_LIVE_CODE_COLLISION",
    "Unable to allocate room code",
    503,
  );
};
export const resolveWritingLiveRoomPublic = async (roomCode) =>
  resolveWritingLiveRoomInternal(roomCode);
export const getWritingLiveRoomContext = async (roomCode) => {
  const resolved = await resolveWritingLiveRoomInternal(roomCode);
  if (!resolved) return null;
  const submission = await WritingSubmission.findById(resolved.submissionId)
    .select(LIVE_CONTEXT_FIELDS)
    .lean();
  if (!submission) {
    const redis = getRedisClient();
    if (redis) {
      await redis.del(toRoomCodeKey(resolved.roomCode)).catch(() => {});
    }
    return null;
  }
  const inMemoryRoom = roomStore.rooms.get(resolved.roomCode);
  const persistedFeedback = submission?.live_feedback || {};
  const highlights = inMemoryRoom
    ? cloneHighlights(inMemoryRoom.highlights)
    : cloneHighlights(persistedFeedback.highlights || []);
  const activeTaskId = inMemoryRoom
    ? inMemoryRoom.activeTaskId || null
    : persistedFeedback.active_task_id ||
      submission?.writing_answers?.[0]?.task_id ||
      null;
  const noteCounter = inMemoryRoom
    ? toPositiveInteger(inMemoryRoom.nextNoteIndex, 1) || 1
    : deriveNextNoteIndex(highlights, persistedFeedback?.note_counter);
  return {
    roomCode: resolved.roomCode,
    expiresAt: resolved.expiresAt,
    ttlMs: resolved.ttlMs,
    submission,
    room: {
      teacher_online: inMemoryRoom
        ? roomStore.getTeacherOnline(inMemoryRoom)
        : false,
      teacher_count: inMemoryRoom ? inMemoryRoom.teacherSockets.size : 0,
      active_task_id: activeTaskId,
      highlights,
      note_counter: noteCounter,
      teacher_disconnect_grace_ms: TEACHER_DISCONNECT_GRACE_MS,
    },
  };
};
export const attachWritingLiveWebSocketServer = (httpServer) => {
  if (!httpServer || typeof httpServer.on !== "function") {
    throw buildError("WRITING_LIVE_SERVER_REQUIRED", "HTTP server is required");
  }
  if (wsInitialized && wsAttachedHttpServer === httpServer) return wsServer;
  if (
    wsInitialized &&
    wsAttachedHttpServer &&
    wsAttachedHttpServer !== httpServer
  ) {
    throw buildError(
      "WRITING_LIVE_ALREADY_ATTACHED",
      "Writing live websocket already attached",
    );
  }
  wsServer = new WebSocketServer({ noServer: true });
  wsAttachedHttpServer = httpServer;
  wsInitialized = true;
  attachSocketConnectionHandler();
  initializeSubscription().catch((err) => {
    console.error("[writing-live] Failed to init subscription:", err.message);
  });
  httpServer.on("upgrade", (request, socket, head) => {
    let parsedUrl = null;
    try {
      parsedUrl = new URL(
        request.url || "",
        `http://${request.headers.host || "localhost"}`,
      );
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
  const room = roomStore.rooms.get(code);
  if (!room) return null;
  return {
    roomCode: room.roomCode,
    submissionId: room.submissionId,
    active_task_id: room.activeTaskId || null,
    note_counter: toPositiveInteger(room.nextNoteIndex, 1) || 1,
    teacher_online: roomStore.getTeacherOnline(room),
    teacher_count: room.teacherSockets.size,
    highlights: cloneHighlights(room.highlights),
  };
};
export const closeWritingLiveRoom = async (roomCode, options = {}) => {
  await closeRoomByCode(roomCode, options);
};
export const resolveWritingLiveRoom = resolveWritingLiveRoomPublic;
