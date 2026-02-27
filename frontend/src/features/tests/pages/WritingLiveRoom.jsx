import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '@/shared/api/client';
import './WritingLiveRoom.css';

const CRITERION_OPTIONS = [
  { value: 'task_response', label: 'Task Response' },
  { value: 'coherence_cohesion', label: 'Coherence & Cohesion' },
  { value: 'lexical_resource', label: 'Lexical Resource' },
  { value: 'grammatical_range_accuracy', label: 'Grammar' },
];
const HIGHLIGHT_COLOR_OPTIONS = [
  { value: 'highlight-yellow', label: 'Yellow' },
  { value: 'highlight-pink', label: 'Pink' },
  { value: 'highlight-blue', label: 'Blue' },
];
const HIGHLIGHT_COLOR_SET = new Set(HIGHLIGHT_COLOR_OPTIONS.map((item) => item.value));
const CRITERION_COLOR_FALLBACK = {
  task_response: 'highlight-yellow',
  coherence_cohesion: 'highlight-blue',
  lexical_resource: 'highlight-pink',
  grammatical_range_accuracy: 'highlight-blue',
};

const normalizeHighlightColor = (value = '', criterion = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'yellow') return 'highlight-yellow';
  if (normalized === 'pink') return 'highlight-pink';
  if (normalized === 'blue') return 'highlight-blue';
  if (HIGHLIGHT_COLOR_SET.has(normalized)) return normalized;
  return CRITERION_COLOR_FALLBACK[String(criterion || '').trim()] || 'highlight-yellow';
};

const toHighlightColorLabel = (value = '') => {
  if (value === 'highlight-pink') return 'Pink';
  if (value === 'highlight-blue') return 'Blue';
  return 'Yellow';
};

const toBand = (value) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return '--';
  return numberValue.toFixed(1);
};

const normalizeCode = (value = '') =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const LIVE_SOCKET_PATHS = ['/ws/writing-live', '/api/ws/writing-live'];

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
    .map((item) => ({
      ...item,
      start: Number(item?.start),
      end: Number(item?.end),
      color: normalizeHighlightColor(item?.color, item?.criterion),
      note: String(item?.note || ''),
      note_index: Number(item?.note_index),
    }))
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
    return [{
      key: '0:0',
      text: '',
      active: [],
      start: 0,
      end: 0,
    }];
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
    const partText = sourceText.slice(start, end);
    const active = validHighlights.filter((item) => item.start < end && item.end > start);
    output.push({
      key: `${start}:${end}`,
      text: partText,
      active,
      start,
      end,
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

  return {
    start,
    end,
    text,
  };
};

export default function WritingLiveRoom() {
  const { roomCode: rawRoomCode } = useParams();
  const roomCode = normalizeCode(rawRoomCode);
  const navigate = useNavigate();

  const user = api.getUser() || {};
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
  const roomEndRedirectPath = isTeacher ? '/scores' : '/profile';

  const essayRef = useRef(null);
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const socketPathIndexRef = useRef(0);
  const endedByServerRef = useRef(false);
  const chatFeedRef = useRef(null);

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
  const [expiresAt, setExpiresAt] = useState('');

  const [selectionDraft, setSelectionDraft] = useState(null);
  const [highlightColor, setHighlightColor] = useState('highlight-yellow');
  const [note, setNote] = useState('');

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
  const textSegments = useMemo(() => buildSegments(currentText, taskHighlights), [currentText, taskHighlights]);
  const studentChatMessages = useMemo(
    () =>
      taskHighlights
        .filter((item) => {
          const text = String(item?.note || '').trim();
          const noteIndex = Number(item?.note_index);
          return Boolean(text) && Number.isFinite(noteIndex) && noteIndex > 0;
        })
        .sort((a, b) => {
          const noteDiff = Number(a.note_index) - Number(b.note_index);
          if (noteDiff !== 0) return noteDiff;
          return String(a?.id || '').localeCompare(String(b?.id || ''));
        })
        .map((item) => ({
          id: String(item?.id || ''),
          noteIndex: Number(item.note_index),
          message: String(item?.note || '').trim(),
          taskId: String(item?.task_id || ''),
        })),
    [taskHighlights],
  );

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
      const existing = (source?.scores || []).find((item) => String(item?.task_id) === String(answer?.task_id));
      next[String(answer?.task_id || '')] = {
        score: Number.isFinite(Number(existing?.score)) ? String(existing.score) : '',
        feedback: String(existing?.feedback || ''),
      };
    });
    setGrades(next);
  }, []);

  const loadContext = useCallback(async () => {
    if (!roomCode) return;
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
      setExpiresAt(String(payload?.expiresAt || ''));
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

    const connectSocket = () => {
      if (disposed || endedByServerRef.current) return;
      const socketPath = LIVE_SOCKET_PATHS[
        Math.min(socketPathIndexRef.current, LIVE_SOCKET_PATHS.length - 1)
      ];
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
          if (data?.active_task_id) setActiveTaskId(String(data.active_task_id));
          setTeacherOnline(Boolean(data?.teacher_online));
          return;
        }

        if (type === 'presence_update') {
          setTeacherOnline(Boolean(data?.teacher_online));
          return;
        }

        if (type === 'task_changed') {
          if (data?.active_task_id) setActiveTaskId(String(data.active_task_id));
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
          endedByServerRef.current = true;
          setRoomClosedMessage('This live room has been closed by teacher or timeout.');
          setWsState('disconnected');
          try {
            socket.close();
          } catch {
            // ignore close error
          }
          navigate(roomEndRedirectPath, { replace: true });
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
          reconnectTimerRef.current = setTimeout(() => {
            connectSocket();
          }, 150);
          return;
        }

        if (!hasOpened) {
          const reason = String(event?.reason || '').trim();
          setStatus(reason || 'Realtime connection failed before handshake.');
        }

        reconnectTimerRef.current = setTimeout(() => {
          connectSocket();
        }, 2000);
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
      }
      const socket = socketRef.current;
      if (socket) {
        try {
          socket.close();
        } catch {
          // ignore close error
        }
      }
    };
  }, [roomCode, sendSocketEvent, navigate, roomEndRedirectPath]);

  useEffect(() => {
    const submissionId = String(submission?._id || '').trim();
    if (!submissionId || aiFastResult) {
      if (aiFastResult) setAiFastLoading(false);
      return undefined;
    }

    let cancelled = false;
    let intervalId = null;
    let attempts = 0;

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

  useEffect(() => {
    if (isTeacher) return;
    const container = chatFeedRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [isTeacher, studentChatMessages]);

  const handleTextSelection = () => {
    if (!isTeacher || !currentTaskId) return;
    const offsets = getSelectionOffsets(essayRef.current);
    setSelectionDraft(offsets);
  };

  const handleAddHighlight = () => {
    if (!selectionDraft || !currentTaskId) return;

    const ok = sendSocketEvent('add_highlight', {
      task_id: currentTaskId,
      start: selectionDraft.start,
      end: selectionDraft.end,
      text: selectionDraft.text,
      color: highlightColor,
      note,
    });
    if (!ok) {
      setStatus('Unable to send highlight. Reconnecting socket...');
      return;
    }

    setStatus('');
    setSelectionDraft(null);
    setNote('');
    if (typeof window !== 'undefined') {
      window.getSelection?.()?.removeAllRanges?.();
    }
  };

  const handleTaskChange = (taskId) => {
    const nextId = String(taskId || '');
    setActiveTaskId(nextId);
    setSelectionDraft(null);
    if (nextId) {
      sendSocketEvent('set_active_task', { task_id: nextId });
    }
  };

  const handleRemoveHighlight = (highlightId) => {
    sendSocketEvent('remove_highlight', { id: highlightId });
  };

  const handleClearTaskHighlights = () => {
    if (!currentTaskId) return;
    sendSocketEvent('clear_task_highlights', { task_id: currentTaskId });
  };

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

  const handleEndRoom = async () => {
    setStatus('');
    try {
      await closeRoomByTeacher();
      navigate('/scores', { replace: true });
    } catch (closeError) {
      setStatus(closeError?.message || 'Failed to close room.');
    }
  };

  const handleLeaveRoom = async () => {
    if (isTeacher) {
      try {
        await closeRoomByTeacher();
      } catch {
        // Continue navigation even if close request fails.
      }
    }
    navigate(isTeacher ? '/scores' : '/profile');
  };

  const handleSubmitScore = async (event) => {
    event.preventDefault();
    if (!isTeacher || !submission?._id) return;

    const payload = tasks.map((task) => ({
      task_id: task.task_id,
      score: Number(grades?.[task.task_id]?.score || 0),
      feedback: String(grades?.[task.task_id]?.feedback || ''),
    }));

    setSubmittingScore(true);
    setStatus('');
    try {
      await api.scoreSubmission(submission._id, { scores: payload });
      setStatus('Scores submitted successfully.');
    } catch (submitError) {
      setStatus(submitError?.message || 'Failed to submit score.');
    } finally {
      setSubmittingScore(false);
    }
  };

  if (loading) {
    return <div className="page"><p className="muted">Loading live room...</p></div>;
  }

  if (error) {
    return (
      <div className="page">
        <p className="error">{error}</p>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/writing-live/join')}>
          Back to join
        </button>
      </div>
    );
  }

  if (!submission) {
    return <div className="page"><p className="muted">Submission not found.</p></div>;
  }

  return (
    <div className="writing-live">
      <div className="writing-live__header">
        <div>
          <h1>Writing Live Room {roomCode ? `(${roomCode})` : ''}</h1>
          <p className="muted">
            Teacher: {teacherOnline ? 'Online' : 'Offline'} | Socket: {wsState}
            {expiresAt ? ` | Code expires: ${new Date(expiresAt).toLocaleTimeString()}` : ''}
          </p>
        </div>
        <div className="writing-live__header-actions">
          <button type="button" className="btn btn-ghost" onClick={handleLeaveRoom}>Back</button>
          {isTeacher ? (
            <button type="button" className="btn btn-primary" onClick={handleEndRoom}>End Room</button>
          ) : null}
        </div>
      </div>

      {roomClosedMessage ? <div className="writing-live__banner writing-live__banner--warn">{roomClosedMessage}</div> : null}
      {!isTeacher && !teacherOnline ? (
        <div className="writing-live__banner">Teacher is offline. You can stay in lobby and wait.</div>
      ) : null}
      {status ? <div className="writing-live__banner">{status}</div> : null}

      <div className="writing-live__layout">
        <section className="writing-live__essay">
          <div className="writing-live__essay-toolbar">
            <label htmlFor="writing-live-task">Task</label>
            <select
              id="writing-live-task"
              value={currentTaskId}
              onChange={(event) => handleTaskChange(event.target.value)}
              disabled={tasks.length === 0}
            >
              {tasks.map((task, index) => (
                <option key={String(task?.task_id || index)} value={String(task?.task_id || '')}>
                  {task?.task_title || `Task ${index + 1}`}
                </option>
              ))}
            </select>
            {isTeacher ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleClearTaskHighlights}>
                Clear Current Task
              </button>
            ) : null}
          </div>

          {currentTask?.task_prompt ? (
            <div className="writing-live__prompt">{currentTask.task_prompt}</div>
          ) : null}

          <div
            ref={essayRef}
            className={`writing-live__essay-text ${isTeacher ? 'is-teacher' : 'is-student'}`}
            onMouseUp={handleTextSelection}
          >
            {textSegments.map((segment, index) => {
              const segmentKey = segment?.key ? `${segment.key}:${index}` : `segment:${index}`;
              if (!segment.active || segment.active.length === 0) {
                return <span key={segmentKey}>{segment.text}</span>;
              }
              const primary = segment.active[segment.active.length - 1];
              const title = segment.active
                .map((item) => {
                  const colorLabel = toHighlightColorLabel(normalizeHighlightColor(item?.color, item?.criterion));
                  const noteText = String(item?.note || item?.text || '').trim();
                  const noteIndex = Number(item?.note_index);
                  const notePrefix = Number.isFinite(noteIndex) && noteIndex > 0 ? `[${noteIndex}] ` : '';
                  return `${colorLabel} ${notePrefix}${noteText}`.trim();
                })
                .filter(Boolean)
                .join('\n');
              return (
                <mark
                  key={segmentKey}
                  className={`writing-live-mark ielts-highlight ${normalizeHighlightColor(primary?.color, primary?.criterion)}`}
                  title={title}
                >
                  {segment.text}
                </mark>
              );
            })}
          </div>

          {isTeacher ? (
            <div className="writing-live__selection">
              <h4>Add highlight</h4>
              {selectionDraft ? (
                <div className="writing-live__selection-box">
                  <p>
                    <strong>Range:</strong> {selectionDraft.start} - {selectionDraft.end}
                  </p>
                  <p className="writing-live__selection-text">{selectionDraft.text}</p>
                </div>
              ) : (
                <p className="muted">Select a text range in the essay to create highlight.</p>
              )}
              <div className="writing-live__selection-controls">
                <div className="writing-live__color-palette" role="radiogroup" aria-label="Highlight color">
                  {HIGHLIGHT_COLOR_OPTIONS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      role="radio"
                      aria-checked={highlightColor === item.value}
                      className={`writing-live__color-chip ${item.value} ${highlightColor === item.value ? 'is-active' : ''}`}
                      onClick={() => setHighlightColor(item.value)}
                    >
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Optional note..."
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={handleAddHighlight} disabled={!selectionDraft}>
                  Add
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {isTeacher ? (
          <aside className="writing-live__side">
            <section className="writing-live__card">
              <h3>AI Fast Suggestion</h3>
              <p className="writing-live__score">
                Band: <strong>{toBand(aiFastResult?.band_score)}</strong>
              </p>
              {aiFastLoading ? <p className="muted">AI is analyzing this essay...</p> : null}
              <div className="writing-live__criteria">
                {CRITERION_OPTIONS.map((item) => (
                  <div key={item.value}>
                    <span>{item.label}</span>
                    <strong>{toBand(aiFastResult?.criteria_scores?.[item.value])}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="writing-live__card">
              <h3>Top Grammar Issues</h3>
              <ul className="writing-live__issues">
                {(topIssues?.grammatical_range_accuracy || []).slice(0, 5).map((item, index) => (
                  <li key={`grammar-${index}`}>
                    <strong>{item?.text_snippet}</strong>
                    <p>{item?.explanation}</p>
                  </li>
                ))}
                {(topIssues?.grammatical_range_accuracy || []).length === 0
                  ? <li className="muted">{aiFastLoading ? 'Analyzing...' : 'No data'}</li>
                  : null}
              </ul>
            </section>

            <section className="writing-live__card">
              <h3>Top Vocabulary Issues</h3>
              <ul className="writing-live__issues">
                {(topIssues?.lexical_resource || []).slice(0, 5).map((item, index) => (
                  <li key={`lexical-${index}`}>
                    <strong>{item?.text_snippet}</strong>
                    <p>{item?.explanation}</p>
                  </li>
                ))}
                {(topIssues?.lexical_resource || []).length === 0
                  ? <li className="muted">{aiFastLoading ? 'Analyzing...' : 'No data'}</li>
                  : null}
              </ul>
            </section>

            <section className="writing-live__card">
              <h3>Teacher Scoring</h3>
              <form onSubmit={handleSubmitScore} className="writing-live__score-form">
                {tasks.map((task, index) => (
                  <div key={task.task_id || index} className="writing-live__score-item">
                    <label>{task.task_title || `Task ${index + 1}`}</label>
                    <input
                      type="number"
                      min="0"
                      max="9"
                      step="0.5"
                      value={grades?.[task.task_id]?.score || ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setGrades((prev) => ({
                          ...prev,
                          [task.task_id]: {
                            ...(prev?.[task.task_id] || {}),
                            score: value,
                          },
                        }));
                      }}
                    />
                    <textarea
                      rows={3}
                      placeholder="Feedback..."
                      value={grades?.[task.task_id]?.feedback || ''}
                      onChange={(event) => {
                        const value = event.target.value;
                        setGrades((prev) => ({
                          ...prev,
                          [task.task_id]: {
                            ...(prev?.[task.task_id] || {}),
                            feedback: value,
                          },
                        }));
                      }}
                    />
                  </div>
                ))}
                <button type="submit" className="btn btn-primary" disabled={submittingScore}>
                  {submittingScore ? 'Submitting...' : 'Submit Score'}
                </button>
              </form>
            </section>

            <section className="writing-live__card">
              <h3>Highlights ({taskHighlights.length})</h3>
              <div className="writing-live__highlight-list">
                {taskHighlights.map((item) => {
                  const normalizedColor = normalizeHighlightColor(item?.color, item?.criterion);
                  const noteIndex = Number(item?.note_index);
                  return (
                    <div key={item.id} className="writing-live__highlight-row">
                      <div>
                        <p>{item.text || '(empty)'}</p>
                        <small>
                          {toHighlightColorLabel(normalizedColor)}
                          {Number.isFinite(noteIndex) && noteIndex > 0 ? ` [${noteIndex}]` : ''}
                          {' | '}
                          {item.start}-{item.end}
                        </small>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleRemoveHighlight(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
                {taskHighlights.length === 0 ? <p className="muted">No highlights yet.</p> : null}
              </div>
            </section>
          </aside>
        ) : (
          <aside className="writing-live__chatbox">
            <div className="writing-live__chatbox-header">
              <h3>Realtime Highlight Notes</h3>
              <p className="muted">{currentTask?.task_title || 'Current task'}</p>
            </div>
            <div className="writing-live__chatbox-feed" ref={chatFeedRef}>
              {studentChatMessages.map((item) => (
                <div key={item.id} className="writing-live__chatbox-item">
                  <p>
                    <strong>[{item.noteIndex}] Highlight:</strong> {item.message}
                  </p>
                </div>
              ))}
              {studentChatMessages.length === 0 ? (
                <p className="muted writing-live__chatbox-empty">Chưa có nhận xét</p>
              ) : null}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
