import {
  isTeacherRole,
  readTaskTextById,
  sanitizeHighlightPayload,
  toNowIso,
  toPositiveInteger,
} from "./writingLiveRoom.shared.js";

const buildTeacherEventHandlers = ({ sendWsError, broadcastRoom, closeRoomByCode, roomStore }) => {
  const handleSetActiveTask = async ({ room, socket, user, submission, payload }) => {
    const taskId = String(payload?.task_id || "").trim();
    const taskText = readTaskTextById(submission, taskId);
    if (!taskId || !taskText) {
      sendWsError(socket, "WRITING_LIVE_INVALID_TASK", "Task not found");
      return;
    }

    room.activeTaskId = taskId;
    roomStore.scheduleRoomPersist(room);
    broadcastRoom(room, {
      type: "task_changed",
      data: {
        roomCode: room.roomCode,
        active_task_id: taskId,
        changed_by: String(user?.userId || ""),
        at: toNowIso(),
      },
    });
  };

  const handleAddHighlight = async ({ room, socket, user, submission, payload }) => {
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
      if (highlight.note) {
        const assignedNoteIndex = toPositiveInteger(room.nextNoteIndex, 1) || 1;
        highlight.note_index = assignedNoteIndex;
        room.nextNoteIndex = assignedNoteIndex + 1;
      } else {
        highlight.note_index = null;
      }

      room.highlights.push(highlight);
      room.activeTaskId = taskId;
      roomStore.scheduleRoomPersist(room);
      broadcastRoom(room, {
        type: "highlight_added",
        data: {
          roomCode: room.roomCode,
          active_task_id: room.activeTaskId || null,
          note_counter: toPositiveInteger(room.nextNoteIndex, 1) || 1,
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
  };

  const handleRemoveHighlight = async ({ room, socket, payload }) => {
    const highlightId = String(payload?.id || "").trim();
    if (!highlightId) {
      sendWsError(socket, "WRITING_LIVE_HIGHLIGHT_REQUIRED", "Highlight id is required");
      return;
    }

    const before = room.highlights.length;
    room.highlights = room.highlights.filter((item) => String(item?.id || "") !== highlightId);
    if (before === room.highlights.length) return;

    roomStore.scheduleRoomPersist(room);
    broadcastRoom(room, {
      type: "highlight_removed",
      data: {
        roomCode: room.roomCode,
        id: highlightId,
        at: toNowIso(),
      },
    });
  };

  const handleClearTaskHighlights = async ({ room, socket, payload }) => {
    const taskId = String(payload?.task_id || room.activeTaskId || "").trim();
    if (!taskId) {
      sendWsError(socket, "WRITING_LIVE_INVALID_TASK", "Task id is required");
      return;
    }

    room.highlights = room.highlights.filter((item) => String(item?.task_id || "") !== taskId);
    roomStore.scheduleRoomPersist(room);
    broadcastRoom(room, {
      type: "highlights_cleared",
      data: {
        roomCode: room.roomCode,
        task_id: taskId,
        at: toNowIso(),
      },
    });
  };

  const handleEndRoom = async ({ room, user }) => {
    await closeRoomByCode(room.roomCode, {
      reason: "teacher_ended",
      initiatedBy: String(user?.userId || "teacher"),
    });
  };

  return {
    set_active_task: handleSetActiveTask,
    add_highlight: handleAddHighlight,
    remove_highlight: handleRemoveHighlight,
    clear_task_highlights: handleClearTaskHighlights,
    end_room: handleEndRoom,
  };
};

export const createTeacherEventHandler = ({ sendWsError, broadcastRoom, closeRoomByCode, roomStore }) => {
  const teacherEventHandlers = buildTeacherEventHandlers({
    sendWsError,
    broadcastRoom,
    closeRoomByCode,
    roomStore,
  });

  return async ({ room, socket, user, submission, eventType, payload }) => {
    const isTeacher = isTeacherRole(user?.role);
    if (!isTeacher) {
      sendWsError(socket, "WRITING_LIVE_FORBIDDEN", "Only teacher/admin can modify room state");
      return;
    }

    const handler = teacherEventHandlers[eventType];
    if (!handler) {
      sendWsError(socket, "WRITING_LIVE_UNSUPPORTED_EVENT", `Unsupported event: ${eventType}`);
      return;
    }

    await handler({ room, socket, user, submission, payload });
  };
};
