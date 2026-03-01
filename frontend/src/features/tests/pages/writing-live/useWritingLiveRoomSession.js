import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/shared/api/client';

const LIVE_SOCKET_PATHS = ['/ws/writing-live', '/api/ws/writing-live'];

const VALID_CRITERIA = new Set([
  'task_response',
  'coherence_cohesion',
  'lexical_resource',
  'grammatical_range_accuracy',
]);

const CRITERION_ALIAS = {
  grammar: 'grammatical_range_accuracy',
  grammatical: 'grammatical_range_accuracy',
  vocab: 'lexical_resource',
  vocabulary: 'lexical_resource',
  lexical: 'lexical_resource',
  coherence: 'coherence_cohesion',
  content: 'task_response',
};

const HIGHLIGHT_COLOR_SET = new Set(['highlight-yellow', 'highlight-pink', 'highlight-blue']);
const BACKEND_COLOR_BY_CRITERION = {
  task_response: 'highlight-yellow',
  coherence_cohesion: 'highlight-blue',
  lexical_resource: 'highlight-yellow',
  grammatical_range_accuracy: 'highlight-pink',
};

const CRITERION_META = {
  task_response: {
    key: 'task_response',
    label: 'Content',
    icon: 'description',
    markClass: 'writing-live-ui__mark--content',
    badgeClass: 'writing-live-ui__badge--content',
    cardClass: 'writing-live-ui__activity-card--content',
    dotClass: 'writing-live-ui__dot--content',
  },
  coherence_cohesion: {
    key: 'coherence_cohesion',
    label: 'Coherence',
    icon: 'link',
    markClass: 'writing-live-ui__mark--coherence',
    badgeClass: 'writing-live-ui__badge--coherence',
    cardClass: 'writing-live-ui__activity-card--coherence',
    dotClass: 'writing-live-ui__dot--coherence',
  },
  lexical_resource: {
    key: 'lexical_resource',
    label: 'Vocab',
    icon: 'book_2',
    markClass: 'writing-live-ui__mark--vocab',
    badgeClass: 'writing-live-ui__badge--vocab',
    cardClass: 'writing-live-ui__activity-card--vocab',
    dotClass: 'writing-live-ui__dot--vocab',
  },
  grammatical_range_accuracy: {
    key: 'grammatical_range_accuracy',
    label: 'Grammar',
    icon: 'gavel',
    markClass: 'writing-live-ui__mark--grammar',
    badgeClass: 'writing-live-ui__badge--grammar',
    cardClass: 'writing-live-ui__activity-card--grammar',
    dotClass: 'writing-live-ui__dot--grammar',
  },
};

export const TEACHER_HIGHLIGHT_OPTIONS = [
  {
    value: 'grammatical_range_accuracy',
    label: 'Grammar',
    chipClass: 'writing-live-ui__chip--grammar',
    dotClass: 'writing-live-ui__chip-dot--grammar',
  },
  {
    value: 'lexical_resource',
    label: 'Vocab',
    chipClass: 'writing-live-ui__chip--vocab',
    dotClass: 'writing-live-ui__chip-dot--vocab',
  },
  {
    value: 'coherence_cohesion',
    label: 'Coherence',
    chipClass: 'writing-live-ui__chip--coherence',
    dotClass: 'writing-live-ui__chip-dot--coherence',
  },
];

export const SCORE_CRITERIA = [
  { value: 'task_response', label: 'Task Response', colorClass: 'writing-live-ui__score-bar--content' },
  { value: 'coherence_cohesion', label: 'Coherence & Cohesion', colorClass: 'writing-live-ui__score-bar--coherence' },
  { value: 'lexical_resource', label: 'Lexical Resource', colorClass: 'writing-live-ui__score-bar--vocab' },
  { value: 'grammatical_range_accuracy', label: 'Grammar', colorClass: 'writing-live-ui__score-bar--grammar' },
];

const toFiniteNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const normalizeRoomCode = (value = '') =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

export const toBand = (value) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return '--';
  return numberValue.toFixed(1);
};

const normalizeCriterion = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (VALID_CRITERIA.has(normalized)) return normalized;
  if (CRITERION_ALIAS[normalized]) return CRITERION_ALIAS[normalized];
  return 'task_response';
};

const normalizeHighlightColor = (value = '', criterion = 'task_response') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (HIGHLIGHT_COLOR_SET.has(normalized)) return normalized;
  if (normalized === 'yellow') return 'highlight-yellow';
  if (normalized === 'pink' || normalized === 'red') return 'highlight-pink';
  if (normalized === 'blue') return 'highlight-blue';
  return BACKEND_COLOR_BY_CRITERION[normalizeCriterion(criterion)] || 'highlight-yellow';
};

const toBackendHighlightColor = (criterion = '') =>
  BACKEND_COLOR_BY_CRITERION[normalizeCriterion(criterion)] || 'highlight-yellow';

const uniqueById = (items = []) => {
  const map = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const id = String(item?.id || '').trim();
    if (!id) return;
    map.set(id, item);
  });
  return Array.from(map.values());
};

const normalizeTopIssueList = (items = []) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({
      text_snippet: String(item?.text_snippet || '').trim(),
      explanation: String(item?.explanation || '').trim(),
      improved: String(item?.improved || '').trim(),
      error_code: String(item?.error_code || '').trim(),
    }))
    .filter((item) => item.text_snippet || item.explanation)
    .slice(0, 5);

const buildTopIssuesFromFastResult = (fastResult = null) => {
  const topIssues = fastResult?.top_issues && typeof fastResult.top_issues === 'object'
    ? fastResult.top_issues
    : {};
  return {
    grammatical_range_accuracy: normalizeTopIssueList(topIssues?.grammatical_range_accuracy),
    lexical_resource: normalizeTopIssueList(topIssues?.lexical_resource),
  };
};

const normalizeHighlights = (items = [], textLength = 0) =>
  uniqueById(items)
    .map((item) => {
      const criterion = normalizeCriterion(item?.criterion);
      return {
        ...item,
        id: String(item?.id || ''),
        task_id: String(item?.task_id || ''),
        start: Number(item?.start),
        end: Number(item?.end),
        criterion,
        color: normalizeHighlightColor(item?.color, criterion),
        note: String(item?.note || ''),
        note_index: Number(item?.note_index),
        text: String(item?.text || ''),
        created_at: item?.created_at || '',
      };
    })
    .filter((item) =>
      Number.isFinite(item.start)
      && Number.isFinite(item.end)
      && item.start >= 0
      && item.end > item.start
      && item.end <= textLength,
    )
    .sort((a, b) => (a.start - b.start) || (a.end - b.end));

const buildSegments = (text = '', highlights = []) => {
  const sourceText = String(text || '');
  if (!sourceText) {
    return [{ key: '0:0', text: '', active: [], start: 0, end: 0 }];
  }

  const validHighlights = normalizeHighlights(highlights, sourceText.length);
  if (validHighlights.length === 0) {
    return [{
      key: `0:${sourceText.length}`,
      text: sourceText,
      active: [],
      start: 0,
      end: sourceText.length,
    }];
  }

  const boundaries = new Set([0, sourceText.length]);
  validHighlights.forEach((item) => {
    boundaries.add(item.start);
    boundaries.add(item.end);
  });
  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  const output = [];

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    if (end <= start) continue;
    output.push({
      key: `${start}:${end}`,
      text: sourceText.slice(start, end),
      start,
      end,
      active: validHighlights.filter((item) => item.start < end && item.end > start),
    });
  }

  return output;
};

const getSelectionOffsets = (container) => {
  if (!container || typeof window === 'undefined') return null;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  if (range.collapsed) return null;
  if (!container.contains(range.commonAncestorContainer)) return null;

  const preRange = document.createRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  const start = preRange.toString().length;

  const fullRange = document.createRange();
  fullRange.selectNodeContents(container);
  fullRange.setEnd(range.endContainer, range.endOffset);
  const end = fullRange.toString().length;

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const text = String(container.textContent || '').slice(start, end);
  if (!text.trim()) return null;

  const rect = range.getBoundingClientRect();
  const anchorRect = rect && Number.isFinite(rect.top) && Number.isFinite(rect.left)
    ? {
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    }
    : null;

  return { start, end, text, rect: anchorRect };
};

const formatFeedTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const getCriterionMeta = (criterion = '') => {
  const key = normalizeCriterion(criterion);
  return CRITERION_META[key] || CRITERION_META.task_response;
};

const createActivityItems = (items = [], sourceText = '') =>
  (Array.isArray(items) ? items : [])
    .map((item) => {
      const criterion = normalizeCriterion(item?.criterion);
      const meta = getCriterionMeta(criterion);
      const snippet = String(item?.text || '').trim() || String(sourceText).slice(item.start, item.end).trim();
      return {
        id: String(item?.id || ''),
        highlightId: String(item?.id || ''),
        taskId: String(item?.task_id || ''),
        label: meta.label,
        icon: meta.icon,
        colorToken: criterion,
        criterion,
        cardClass: meta.cardClass,
        badgeClass: meta.badgeClass,
        dotClass: meta.dotClass,
        excerpt: snippet || '(empty highlight)',
        comment: String(item?.note || '').trim(),
        noteIndex: Number(item?.note_index),
        start: Number(item?.start),
        end: Number(item?.end),
        createdAt: item?.created_at || '',
        timeLabel: formatFeedTime(item?.created_at),
      };
    })
    .filter((item) => item.id)
    .sort((a, b) => {
      const timeA = Date.parse(a.createdAt || '');
      const timeB = Date.parse(b.createdAt || '');
      if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) return timeA - timeB;

      const noteA = Number.isFinite(a.noteIndex) ? a.noteIndex : Number.MAX_SAFE_INTEGER;
      const noteB = Number.isFinite(b.noteIndex) ? b.noteIndex : Number.MAX_SAFE_INTEGER;
      if (noteA !== noteB) return noteA - noteB;

      return a.start - b.start;
    });

export function useWritingLiveRoomSession({
  roomCode,
  isTeacher,
  onRoomClosed,
}) {
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const socketPathIndexRef = useRef(0);
  const endedByServerRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [wsState, setWsState] = useState('disconnected');
  const [roomClosedMessage, setRoomClosedMessage] = useState('');

  const [submission, setSubmission] = useState(null);
  const [aiFastResult, setAiFastResult] = useState(null);
  const [aiFastLoading, setAiFastLoading] = useState(false);
  const [topIssues, setTopIssues] = useState({
    grammatical_range_accuracy: [],
    lexical_resource: [],
  });

  const [activeTaskId, setActiveTaskId] = useState('');
  const [highlights, setHighlights] = useState([]);
  const [teacherOnline, setTeacherOnline] = useState(false);

  const [selectionDraft, setSelectionDraft] = useState(null);
  const [selectedCriterion, setSelectedCriterion] = useState('grammatical_range_accuracy');
  const [noteDraft, setNoteDraft] = useState('');

  const [grades, setGrades] = useState({});
  const [submittingScore, setSubmittingScore] = useState(false);


  const tasks = useMemo(
    () => (Array.isArray(submission?.writing_answers) ? submission.writing_answers : []),
    [submission],
  );

  const currentTask = useMemo(
    () => tasks.find((item) => String(item?.task_id) === String(activeTaskId)) || tasks[0] || null,
    [tasks, activeTaskId],
  );

  const currentTaskId = String(currentTask?.task_id || '');
  const currentText = String(currentTask?.answer_text || '');

  const taskHighlights = useMemo(
    () => normalizeHighlights(
      highlights.filter((item) => String(item?.task_id || '') === currentTaskId),
      currentText.length,
    ),
    [highlights, currentTaskId, currentText.length],
  );

  const textSegments = useMemo(
    () => buildSegments(currentText, taskHighlights),
    [currentText, taskHighlights],
  );

  const activityItems = useMemo(
    () => createActivityItems(taskHighlights, currentText),
    [taskHighlights, currentText],
  );


  const closeSocketConnection = useCallback((reason = 'room_closed') => {
    endedByServerRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      try {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close(1000, reason);
        }
      } catch {
        // Ignore close error.
      }
    }
    setWsState('disconnected');
  }, []);

  const sendSocketEvent = useCallback((type, payload = {}) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ type, payload }));
    return true;
  }, []);

  const initGradesFromSubmission = useCallback((source) => {
    const answers = Array.isArray(source?.writing_answers) ? source.writing_answers : [];
    const next = {};
    answers.forEach((answer) => {
      const taskId = String(answer?.task_id || '');
      const existing = (source?.scores || []).find((item) => String(item?.task_id || '') === taskId);
      next[taskId] = {
        score: Number.isFinite(Number(existing?.score)) ? String(existing?.score) : '',
        feedback: String(existing?.feedback || ''),
      };
    });
    setGrades(next);
  }, []);

  const loadContext = useCallback(async () => {
    if (!roomCode) {
      setError('Invalid room code.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.getWritingLiveRoomContext(roomCode);
      const payload = response?.data || {};
      const incomingSubmission = payload?.submission || null;
      const incomingRoom = payload?.room || {};
      const initialTaskId = incomingRoom?.active_task_id || incomingSubmission?.writing_answers?.[0]?.task_id || '';
      const incomingHighlights = Array.isArray(incomingRoom?.highlights) ? incomingRoom.highlights : [];
      const fastResult = payload?.ai_fast_result || incomingSubmission?.ai_fast_result || null;
      const fastTopIssues = payload?.top_issues || buildTopIssuesFromFastResult(fastResult);

      setSubmission(incomingSubmission);
      setAiFastResult(fastResult);
      setTopIssues(fastTopIssues);
      setAiFastLoading(!fastResult);
      setActiveTaskId(String(initialTaskId || ''));
      setHighlights(incomingHighlights);
      setTeacherOnline(Boolean(incomingRoom?.teacher_online));

      initGradesFromSubmission(incomingSubmission);
    } catch (contextError) {
      setError(contextError?.message || 'Failed to load writing live room.');
      setAiFastLoading(false);
    } finally {
      setLoading(false);
    }
  }, [roomCode, initGradesFromSubmission]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (!roomCode) return undefined;

    let disposed = false;
    socketPathIndexRef.current = 0;
    endedByServerRef.current = false;
    reconnectAttemptsRef.current = 0;

    const connectSocket = () => {
      if (disposed || endedByServerRef.current) return;
      const socketPath = LIVE_SOCKET_PATHS[Math.min(socketPathIndexRef.current, LIVE_SOCKET_PATHS.length - 1)];
      const socketUrl = api.getWritingLiveSocketUrl(roomCode, undefined, socketPath);
      if (!socketUrl) {
        setWsState('error');
        setError('Unable to initialize websocket connection.');
        return;
      }

      setWsState('connecting');
      let hasOpened = false;
      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (disposed) return;
        hasOpened = true;
        reconnectAttemptsRef.current = 0;
        setStatus('');
        setWsState('connected');
        sendSocketEvent('request_snapshot', {});
      };

      socket.onmessage = (event) => {
        if (disposed) return;
        let packet = null;
        try {
          packet = JSON.parse(event?.data || '{}');
        } catch {
          return;
        }

        const type = String(packet?.type || '');
        const data = packet?.data || {};

        if (type === 'room_snapshot') {
          setHighlights(Array.isArray(data?.highlights) ? data.highlights : []);
          if (data?.active_task_id) setActiveTaskId(String(data?.active_task_id));
          setTeacherOnline(Boolean(data?.teacher_online));
          return;
        }

        if (type === 'presence_update') {
          setTeacherOnline(Boolean(data?.teacher_online));
          return;
        }

        if (type === 'task_changed') {
          if (data?.active_task_id) setActiveTaskId(String(data?.active_task_id));
          return;
        }

        if (type === 'highlight_added') {
          const added = data?.highlight;
          if (!added?.id) return;
          setHighlights((prev) => uniqueById([...prev, added]));
          return;
        }

        if (type === 'highlight_removed') {
          const removedId = String(data?.id || '');
          if (!removedId) return;
          setHighlights((prev) => prev.filter((item) => String(item?.id || '') !== removedId));
          return;
        }

        if (type === 'highlights_cleared') {
          const taskId = String(data?.task_id || '');
          setHighlights((prev) => prev.filter((item) => String(item?.task_id || '') !== taskId));
          return;
        }

        if (type === 'room_closed') {
          setRoomClosedMessage('This live room has been closed by teacher or timeout.');
          closeSocketConnection('room_closed');
          onRoomClosed?.();
          return;
        }

        if (type === 'error') {
          setStatus(String(data?.message || 'Realtime error.'));
        }
      };

      socket.onclose = (event) => {
        if (disposed) return;
        setWsState('disconnected');
        if (endedByServerRef.current) return;

        if (!hasOpened && socketPathIndexRef.current < LIVE_SOCKET_PATHS.length - 1) {
          socketPathIndexRef.current += 1;
          reconnectTimerRef.current = setTimeout(connectSocket, 150);
          return;
        }

        if (!hasOpened) {
          const reason = String(event?.reason || '').trim();
          setStatus(reason || 'Realtime connection failed before handshake.');
        }

        reconnectAttemptsRef.current += 1;
        const reconnectDelayMs = Math.min(2000 * (2 ** Math.max(0, reconnectAttemptsRef.current - 1)), 30000);
        reconnectTimerRef.current = setTimeout(connectSocket, reconnectDelayMs);
      };

      socket.onerror = () => {
        if (disposed) return;
        setWsState('error');
      };
    };

    connectSocket();

    return () => {
      disposed = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      const socket = socketRef.current;
      if (socket) {
        try {
          socket.close();
        } catch {
          // Ignore close error.
        }
      }
      socketRef.current = null;
    };
  }, [roomCode, sendSocketEvent, closeSocketConnection, onRoomClosed]);

  useEffect(() => {
    const submissionId = String(submission?._id || '').trim();
    if (!submissionId || aiFastResult) {
      if (aiFastResult) setAiFastLoading(false);
      return undefined;
    }

    let cancelled = false;
    let attempts = 0;
    let intervalId = null;
    setAiFastLoading(true);

    const pollFastResult = async () => {
      attempts += 1;
      try {
        const response = await api.getSubmissionStatus(submissionId);
        if (cancelled) return;
        const payload = response?.data || {};
        if (payload?.is_ai_fast_graded && payload?.ai_fast_result) {
          setAiFastResult(payload.ai_fast_result);
          setTopIssues(buildTopIssuesFromFastResult(payload.ai_fast_result));
          setAiFastLoading(false);
          if (intervalId) clearInterval(intervalId);
          return;
        }
      } catch {
        // Ignore transient polling errors.
      }

      if (attempts >= 30) {
        if (intervalId) clearInterval(intervalId);
        if (!cancelled) setAiFastLoading(false);
      }
    };

    pollFastResult();
    intervalId = setInterval(pollFastResult, 4000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [submission?._id, aiFastResult]);

  const handleTaskChange = useCallback((taskId) => {
    const nextId = String(taskId || '');
    setActiveTaskId(nextId);
    setSelectionDraft(null);
    if (isTeacher && nextId) {
      sendSocketEvent('set_active_task', { task_id: nextId });
    }
  }, [isTeacher, sendSocketEvent]);

  const captureSelection = useCallback((container) => {
    if (!isTeacher || !currentTaskId) return null;
    const offsets = getSelectionOffsets(container);
    setSelectionDraft(offsets);
    return offsets;
  }, [isTeacher, currentTaskId]);

  const clearSelectionDraft = useCallback(() => {
    setSelectionDraft(null);
    setNoteDraft('');
    if (typeof window !== 'undefined') {
      window.getSelection?.()?.removeAllRanges?.();
    }
  }, []);

  const addHighlightFromSelection = useCallback(() => {
    if (!selectionDraft || !currentTaskId) return false;
    const payload = {
      task_id: currentTaskId,
      start: selectionDraft.start,
      end: selectionDraft.end,
      text: selectionDraft.text,
      criterion: selectedCriterion,
      color: toBackendHighlightColor(selectedCriterion),
      note: String(noteDraft || '').trim(),
    };
    const sent = sendSocketEvent('add_highlight', payload);
    if (!sent) {
      setStatus('Unable to send highlight. Reconnecting socket...');
      return false;
    }
    setStatus('');
    clearSelectionDraft();
    return true;
  }, [selectionDraft, currentTaskId, selectedCriterion, noteDraft, sendSocketEvent, clearSelectionDraft]);

  const removeHighlight = useCallback((highlightId) => {
    sendSocketEvent('remove_highlight', { id: highlightId });
  }, [sendSocketEvent]);

  const clearCurrentTaskHighlights = useCallback(() => {
    if (!currentTaskId) return;
    sendSocketEvent('clear_task_highlights', { task_id: currentTaskId });
  }, [currentTaskId, sendSocketEvent]);

  const closeRoomByTeacher = useCallback(async () => {
    if (!isTeacher || !roomCode) return;
    try {
      await api.closeWritingLiveRoom(roomCode);
      return;
    } catch {
      const sent = sendSocketEvent('end_room', {});
      if (!sent) {
        throw new Error('Unable to close live room.');
      }
    }
  }, [isTeacher, roomCode, sendSocketEvent]);

  const endRoom = useCallback(async () => {
    setStatus('');
    await closeRoomByTeacher();
    closeSocketConnection('teacher_ended');
  }, [closeRoomByTeacher, closeSocketConnection]);

  const setGradeValue = useCallback((taskId, field, value) => {
    const taskKey = String(taskId || '');
    const key = field === 'score' ? 'score' : 'feedback';
    setGrades((prev) => ({
      ...prev,
      [taskKey]: {
        ...(prev?.[taskKey] || {}),
        [key]: value,
      },
    }));
  }, []);

  const submitScore = useCallback(async () => {
    if (!isTeacher || !submission?._id) return;
    const payload = tasks.map((task) => ({
      task_id: task?.task_id,
      score: Number(grades?.[task?.task_id]?.score || 0),
      feedback: String(grades?.[task?.task_id]?.feedback || ''),
    }));

    setSubmittingScore(true);
    setStatus('');
    try {
      await api.scoreSubmission(submission._id, { scores: payload });
      setStatus('Scores submitted successfully.');
    } catch (submitError) {
      setStatus(submitError?.message || 'Failed to submit score.');
      throw submitError;
    } finally {
      setSubmittingScore(false);
    }
  }, [isTeacher, submission?._id, tasks, grades]);

  const getScoreProgress = useCallback((scoreValue) => {
    const score = toFiniteNumber(scoreValue, 0);
    const clamped = Math.min(Math.max(score, 0), 9);
    return Math.round((clamped / 9) * 100);
  }, []);

  return {
    loading,
    error,
    status,
    setStatus,
    wsState,
    roomClosedMessage,
    submission,
    tasks,
    currentTask,
    currentTaskId,
    currentText,
    activeTaskId,
    handleTaskChange,
    highlights,
    taskHighlights,
    textSegments,
    activityItems,
    teacherOnline,
    aiFastResult,
    aiFastLoading,
    topIssues,
    selectionDraft,
    selectedCriterion,
    setSelectedCriterion,
    noteDraft,
    setNoteDraft,
    captureSelection,
    clearSelectionDraft,
    addHighlightFromSelection,
    removeHighlight,
    clearCurrentTaskHighlights,
    closeRoomByTeacher,
    endRoom,
    grades,
    setGradeValue,
    submittingScore,
    submitScore,
    getScoreProgress,
    reloadContext: loadContext,
  };
}

