import { useEffect, useRef, useState } from 'react';
import {
  SCORE_CRITERIA,
  TEACHER_HIGHLIGHT_OPTIONS,
  getCriterionMeta,
  toBand,
} from './useWritingLiveRoomSession';

import EditNoteIcon from '@mui/icons-material/EditNote';
import TuneIcon from '@mui/icons-material/Tune';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';


const scrollToElement = (element) => {
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
};

export default function WritingLiveRoomTeacherView({
  roomCode,
  session,
  onLeaveRoom,
  onFinishAndGrade,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeHighlightId, setActiveHighlightId] = useState('');
  const essayRef = useRef(null);
  const textRefMap = useRef(new Map());
  const feedRefMap = useRef(new Map());

  useEffect(() => {
    setActiveHighlightId('');
  }, [session.currentTaskId]);

  const registerTextRef = (highlightId) => (node) => {
    const id = String(highlightId || '');
    if (!id) return;
    if (node) textRefMap.current.set(id, node);
    else textRefMap.current.delete(id);
  };

  const registerFeedRef = (highlightId) => (node) => {
    const id = String(highlightId || '');
    if (!id) return;
    if (node) feedRefMap.current.set(id, node);
    else feedRefMap.current.delete(id);
  };

  const focusFromText = (highlightId) => {
    const id = String(highlightId || '');
    if (!id) return;
    setActiveHighlightId(id);
    scrollToElement(feedRefMap.current.get(id));
  };

  const focusFromFeed = (highlightId) => {
    const id = String(highlightId || '');
    if (!id) return;
    setActiveHighlightId(id);
    scrollToElement(textRefMap.current.get(id));
  };

  const handleSubmitScore = async (event) => {
    event.preventDefault();
    try {
      await session.submitScore();
    } catch {
      // Error state is already surfaced in session.status.
    }
  };

  return (
    <div className="writing-live-ui bg-background-light min-h-[calc(100vh-88px)] flex flex-col overflow-hidden text-slate-900">
      <header className="h-16 flex-none bg-white border-b border-slate-200 px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center justify-center size-10 rounded-lg bg-primary/10 text-primary">
            <EditNoteIcon />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight truncate">
              {session.currentTask?.task_title || 'IELTS Writing Live Room'}
            </h1>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className={`flex size-2 rounded-full ${session.teacherOnline ? 'bg-green-500' : 'bg-amber-500'} animate-pulse`} />
              <span>{session.teacherOnline ? 'Live Session' : 'Waiting Reconnect'}</span>
              <span className="mx-1">|</span>
              <span className="truncate">Student: {session.submission?.student_name || 'Unknown Student'}</span>
              {roomCode ? <span className="hidden md:inline">| Room: {roomCode}</span> : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center justify-center size-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-primary hover:border-primary/30 transition-colors"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open writing room tools"
          >
            <TuneIcon className="text-[20px]" />
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-bold rounded-xl transition-colors"
            onClick={onFinishAndGrade}
          >
            <CheckCircleIcon className="text-[20px]" />
            <span>Kết thúc & Đóng phòng</span>
          </button>
          <div className="size-9 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center border-2 border-white shadow-sm">
            T
          </div>
        </div>
      </header>

      {session.roomClosedMessage ? (
        <div className="px-6 py-3 text-sm bg-amber-50 text-amber-700 border-b border-amber-200">
          {session.roomClosedMessage}
        </div>
      ) : null}
      {session.status ? (
        <div className="px-6 py-3 text-sm bg-blue-50 text-blue-700 border-b border-blue-100">
          {session.status}
        </div>
      ) : null}

      <main className="flex-1 flex overflow-hidden">
        <section className="w-full lg:w-[60%] flex flex-col bg-white border-r border-slate-200 h-full relative">
          <div className="flex items-center gap-3 p-3 border-b border-slate-100 bg-white z-10 overflow-x-auto">
            <label htmlFor="writing-live-task-picker" className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
              Task:
            </label>
            <select
              id="writing-live-task-picker"
              className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white min-w-[180px]"
              value={session.currentTaskId}
              onChange={(event) => session.handleTaskChange(event.target.value)}
            >
              {session.tasks.map((task, index) => (
                <option key={String(task?.task_id || index)} value={String(task?.task_id || '')}>
                  {task?.task_title || `Task ${index + 1}`}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2 pl-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">Highlighters:</span>
              {TEACHER_HIGHLIGHT_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className={`writing-live-ui__chip ${option.chipClass} cursor-default`}
                >
                  <span className={`writing-live-ui__chip-dot ${option.dotClass}`} />
                  <span>{option.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 lg:p-12 relative">
            <div className="max-w-[720px] mx-auto space-y-5">
              {session.currentTask?.task_prompt ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                  {session.currentTask.task_prompt}
                </div>
              ) : null}
              {session.currentTask?.task_image ? (
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <img
                    src={session.currentTask.task_image}
                    alt="Writing task reference"
                    className="w-full max-h-[300px] object-cover"
                  />
                </div>
              ) : null}

              <h2 className="text-2xl font-bold text-slate-900">
                {session.currentTask?.task_title || 'Essay'}
              </h2>
              <article
                ref={essayRef}
                onMouseUp={() => session.captureSelection(essayRef.current)}
                className="prose prose-lg max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap font-display writing-live-ui__essay-content"
              >
                {session.textSegments.map((segment, index) => {
                  const key = segment?.key ? `${segment.key}:${index}` : `segment:${index}`;
                  if (!segment.active || segment.active.length === 0) {
                    return <span key={key}>{segment.text}</span>;
                  }
                  const primary = segment.active[segment.active.length - 1];
                  const meta = getCriterionMeta(primary?.criterion);
                  const isActive = activeHighlightId === String(primary?.id || '');
                  const tooltipText = String(primary?.note || '').trim();
                  return (
                    <mark
                      key={key}
                      ref={registerTextRef(primary?.id)}
                      className={`writing-live-ui__mark ${meta.markClass} ${isActive ? 'is-active' : ''}`}
                      onMouseEnter={() => setActiveHighlightId(String(primary?.id || ''))}
                      onClick={() => focusFromText(primary?.id)}
                      title={tooltipText || `${meta.label} highlight`}
                    >
                      {segment.text}
                      {tooltipText ? <span className="writing-live-ui__mark-tooltip">{tooltipText}</span> : null}
                    </mark>
                  );
                })}
              </article>
            </div>
          </div>

          <div className="absolute bottom-6 right-6 z-20">
            {session.selectionDraft ? (
              <div className="w-[360px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white shadow-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Add Highlight Comment</p>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-700"
                    onClick={session.clearSelectionDraft}
                    aria-label="Close quick annotate popover"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Range {session.selectionDraft.start}-{session.selectionDraft.end}
                </p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 max-h-12 overflow-hidden">
                  {session.selectionDraft.text}
                </p>
                <input
                  type="text"
                  value={session.noteDraft}
                  onChange={(event) => session.setNoteDraft(event.target.value)}
                  placeholder="Comment for student..."
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                />
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {TEACHER_HIGHLIGHT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`writing-live-ui__chip ${option.chipClass} hover:opacity-80 transition-opacity ${
                        session.selectedCriterion === option.value ? 'is-active ring-2 ring-primary ring-offset-1' : ''
                      }`}
                      onClick={() => session.setSelectedCriterion(option.value)}
                      style={{ padding: '2px 8px', fontSize: '11px' }}
                    >
                      <span className={`writing-live-ui__chip-dot ${option.dotClass}`} />
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    onClick={session.clearSelectionDraft}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90"
                    onClick={session.addHighlightFromSelection}
                  >
                    Save Highlight
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 text-white text-xs px-3 py-1.5 rounded-full shadow-lg opacity-80">
                Select text to add feedback
              </div>
            )}
          </div>
        </section>

        <section className="hidden lg:flex flex-col w-[40%] bg-background-light h-full">
          <div className="p-6 bg-white m-4 rounded-2xl border border-slate-200 shadow-sm flex-none">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">analytics</span>
                Projected Band Score
              </h3>
              <span className="text-2xl font-bold text-primary">{toBand(session.aiFastResult?.band_score)}</span>
            </div>
            {session.aiFastLoading ? <p className="text-xs text-slate-500 mb-3">AI is analyzing this essay...</p> : null}
            <div className="grid grid-cols-2 gap-4">
              {SCORE_CRITERIA.map((criterion) => {
                const score = session.aiFastResult?.criteria_scores?.[criterion.value];
                return (
                  <div key={criterion.value} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex justify-between text-xs font-medium text-slate-500 mb-1">
                      <span>{criterion.label}</span>
                      <span className="text-slate-900">{toBand(score)}</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${criterion.colorClass}`}
                        style={{ width: `${session.getScoreProgress(score)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-2 px-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Activity Feed</h4>
              <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                Task only
              </span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2 pb-4">
              {session.activityItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  ref={registerFeedRef(item.highlightId)}
                  className={`w-full text-left flex gap-3 items-start bg-white p-3 rounded-xl shadow-sm border-l-4 transition-all ${item.cardClass} ${
                    activeHighlightId === item.highlightId ? 'is-active' : ''
                  }`}
                  onMouseEnter={() => setActiveHighlightId(item.highlightId)}
                  onClick={() => focusFromFeed(item.highlightId)}
                >
                  <div className="mt-0.5 min-w-[24px]">
                    <span className="material-symbols-outlined writing-live-ui__activity-icon">
                      {item.icon}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800">
                      <span className="font-bold">You</span> highlighted{' '}
                      <span className="font-mono px-1 rounded bg-slate-100 truncate inline-block max-w-[180px] align-bottom">
                        "{item.excerpt}"
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {item.comment ? `Comment: "${item.comment}"` : `${item.label} feedback`}
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-400 ml-auto whitespace-nowrap">
                    {item.timeLabel || item.label}
                  </span>
                </button>
              ))}
              {session.activityItems.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                  No activity yet for this task.
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <div className={`writing-live-ui__drawer-backdrop ${drawerOpen ? 'is-open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <aside className={`writing-live-ui__drawer ${drawerOpen ? 'is-open' : ''}`} aria-hidden={!drawerOpen}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900">Live Room Tools</h3>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-700"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close drawer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <section className="writing-live-ui__drawer-section">
          <h4>Realtime Status</h4>
          <p>Socket: <strong>{session.wsState}</strong></p>
          <p>Teacher Presence: <strong>{session.teacherOnline ? 'Online' : 'Offline'}</strong></p>
        </section>

        <section className="writing-live-ui__drawer-section">
          <h4>Manual Scoring</h4>
          <form className="space-y-3" onSubmit={handleSubmitScore}>
            {session.tasks.map((task, index) => (
              <div key={String(task?.task_id || index)} className="border border-slate-200 rounded-xl p-3 space-y-2">
                <p className="text-sm font-semibold text-slate-700">{task?.task_title || `Task ${index + 1}`}</p>
                <input
                  type="number"
                  min="0"
                  max="9"
                  step="0.5"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  value={session.grades?.[task?.task_id]?.score || ''}
                  onChange={(event) => session.setGradeValue(task?.task_id, 'score', event.target.value)}
                  placeholder="Band score"
                />
                <textarea
                  rows={3}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-y"
                  value={session.grades?.[task?.task_id]?.feedback || ''}
                  onChange={(event) => session.setGradeValue(task?.task_id, 'feedback', event.target.value)}
                  placeholder="Teacher feedback..."
                />
              </div>
            ))}
            <button
              type="submit"
              className="w-full rounded-lg bg-primary text-white text-sm font-semibold py-2 hover:bg-primary/90"
              disabled={session.submittingScore}
            >
              {session.submittingScore ? 'Submitting...' : 'Submit Score'}
            </button>
          </form>
        </section>

        <section className="writing-live-ui__drawer-section">
          <h4>Highlights for Active Task</h4>
          <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
            {session.taskHighlights.map((item) => {
              const meta = getCriterionMeta(item?.criterion);
              return (
                <div key={item.id} className="border border-slate-200 rounded-lg px-3 py-2 text-sm">
                  <p className="text-slate-700 max-h-10 overflow-hidden">{item?.text || '(empty highlight)'}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {meta.label} | {item.start}-{item.end}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-red-600 hover:text-red-700"
                    onClick={() => session.removeHighlight(item.id)}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
            {session.taskHighlights.length === 0 ? (
              <p className="text-sm text-slate-500">No highlights in current task.</p>
            ) : null}
          </div>
          <button
            type="button"
            className="mt-3 w-full rounded-lg border border-slate-200 text-sm py-2 hover:bg-slate-50"
            onClick={session.clearCurrentTaskHighlights}
          >
            Clear Current Task Highlights
          </button>
        </section>

        <section className="writing-live-ui__drawer-section">
          <h4>AI Top Issues</h4>
          <div className="space-y-2">
            {(session.topIssues?.grammatical_range_accuracy || []).slice(0, 3).map((issue, index) => (
              <div key={`g-${index}`} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">{issue.text_snippet}</p>
                <p className="text-xs text-slate-500 mt-1">{issue.explanation}</p>
              </div>
            ))}
            {(session.topIssues?.lexical_resource || []).slice(0, 2).map((issue, index) => (
              <div key={`l-${index}`} className="rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-xs font-semibold text-slate-700">{issue.text_snippet}</p>
                <p className="text-xs text-slate-500 mt-1">{issue.explanation}</p>
              </div>
            ))}
            {(session.topIssues?.grammatical_range_accuracy || []).length === 0
              && (session.topIssues?.lexical_resource || []).length === 0 ? (
                <p className="text-sm text-slate-500">{session.aiFastLoading ? 'Analyzing...' : 'No AI issues yet.'}</p>
              ) : null}
          </div>
        </section>

        <section className="writing-live-ui__drawer-section">
          <h4>Room Actions</h4>
          <button
            type="button"
            className="w-full rounded-lg border border-slate-200 text-sm py-2 hover:bg-slate-50"
            onClick={onLeaveRoom}
          >
            Back to Grading
          </button>
          <button
            type="button"
            className="mt-2 w-full rounded-lg bg-red-600 text-white text-sm py-2 hover:bg-red-700"
            onClick={onFinishAndGrade}
          >
            Kết thúc & Đóng phòng
          </button>
        </section>
      </aside>
    </div>
  );
}
