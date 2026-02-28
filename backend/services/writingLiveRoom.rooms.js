import WritingSubmission from "../models/WritingSubmission.model.js";
import {
  PERSIST_DEBOUNCE_MS,
  TEACHER_DISCONNECT_GRACE_MS,
  cloneHighlights,
  deriveNextNoteIndex,
  normalizeCode,
  toNowIso,
  toPositiveInteger,
} from "./writingLiveRoom.shared.js";

const rooms = new Map();

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
  note_counter: toPositiveInteger(room.nextNoteIndex, 1) || 1,
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
    note_counter: toPositiveInteger(room.nextNoteIndex, 1) || 1,
    teacher_online: getTeacherOnline(room),
    teacher_count: room.teacherSockets.size,
    expires_at: expiresAt || null,
    server_time: toNowIso(),
  },
});

const createRoomState = ({
  roomCode,
  submissionId,
  initialHighlights,
  activeTaskId,
  nextNoteIndex = 1,
}) => ({
  roomCode,
  submissionId: String(submissionId),
  highlights: cloneHighlights(initialHighlights),
  activeTaskId: activeTaskId || null,
  nextNoteIndex: toPositiveInteger(nextNoteIndex, 1) || 1,
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
    nextNoteIndex: deriveNextNoteIndex(
      persisted?.highlights || [],
      persisted?.note_counter,
    ),
  });
  rooms.set(code, room);
  return room;
};

const scheduleTeacherRoomClose = (room, closeRoom) => {
  clearTeacherCloseTimer(room);
  room.teacherCloseTimer = setTimeout(() => {
    closeRoom(room.roomCode, {
      reason: "teacher_offline_timeout",
      initiatedBy: "system",
    }).catch(() => { });
  }, TEACHER_DISCONNECT_GRACE_MS);
  room.teacherCloseTimer.unref?.();
};

const closeRoom = async (
  roomCode,
  {
    reason = "room_closed",
    initiatedBy = "system",
    onDeleteRoomCode,
    onBroadcast,
    onCloseSocket,
  } = {},
) => {
  const code = normalizeCode(roomCode);
  if (!code) return;

  const room = rooms.get(code);
  if (!room) {
    await onDeleteRoomCode?.(code);
    return;
  }

  clearTeacherCloseTimer(room);
  clearRoomPersistTimer(room);
  await flushRoomState(room, { force: true });

  onBroadcast?.(room, {
    type: "room_closed",
    data: {
      roomCode: code,
      reason,
      initiated_by: initiatedBy,
      at: toNowIso(),
    },
  });

  for (const socket of room.sockets.keys()) {
    onCloseSocket?.(socket, 1000, "Room closed");
  }

  rooms.delete(code);
  await onDeleteRoomCode?.(code);
};

const bindSocketToRoom = ({ room, socket, user }) => {
  room.sockets.set(socket, {
    userId: String(user?.userId || ""),
    role: String(user?.role || ""),
  });
};

const addTeacherSocket = (room, socket) => {
  room.teacherSockets.add(socket);
  clearTeacherCloseTimer(room);
};

const unbindSocketFromRoom = (room, socket, closeRoomHandler) => {
  if (!room) return;
  room.sockets.delete(socket);
  room.teacherSockets.delete(socket);

  if (room.teacherSockets.size === 0) {
    scheduleTeacherRoomClose(room, closeRoomHandler);
  }
};

const closeAllRooms = async () => {
  for (const room of rooms.values()) {
    clearRoomPersistTimer(room);
    clearTeacherCloseTimer(room);
    await flushRoomState(room, { force: true });
  }
  rooms.clear();
};

export const roomStore = {
  rooms,
  getTeacherOnline,
  clearRoomPersistTimer,
  clearTeacherCloseTimer,
  flushRoomState,
  scheduleRoomPersist,
  buildPresencePayload,
  buildSnapshotPayload,
  ensureRoomState,
  closeRoom,
  bindSocketToRoom,
  addTeacherSocket,
  unbindSocketFromRoom,
  closeAllRooms,
};
