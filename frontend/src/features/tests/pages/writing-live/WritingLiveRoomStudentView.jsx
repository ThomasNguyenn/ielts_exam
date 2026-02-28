import { useEffect, useRef, useState } from 'react';
import { getCriterionMeta } from './useWritingLiveRoomSession';

const scrollToElement = (element) => {
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
};

export default function WritingLiveRoomStudentView({
  roomCode,
  session,
  onLeaveRoom,
}) {
  const [activeHighlightId, setActiveHighlightId] = useState('');
  const textRefMap = useRef(new Map());
  const feedRefMap = useRef(new Map());
  const feedScrollRef = useRef(null);

  useEffect(() => {
    setActiveHighlightId('');
  }, [session.currentTaskId]);

  useEffect(() => {
    const container = feedScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [session.activityItems.length]);

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

  return (
    <div className="writing-live-ui bg-background-light min-h-[calc(100vh-88px)] text-slate-900 flex flex-col overflow-hidden">
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 bg-white px-6 py-3 h-16 shrink-0 z-20">
        <div className="flex items-center gap-4 text-slate-900 min-w-0">
          <div className="size-8 flex items-center justify-center bg-primary/10 rounded-lg text-primary">
            <span className="material-symbols-outlined">school</span>
          </div>
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] truncate">Live Writing Score</h2>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-100">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">Live</span>
          </div>
        </div>
        <div className="flex flex-1 justify-end gap-4 items-center min-w-0">
          <div className="h-6 w-px bg-slate-200" />
          <button
            type="button"
            className="flex items-center justify-center rounded-xl h-9 px-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors text-sm font-semibold"
            onClick={onLeaveRoom}
          >
            Back
          </button>
          <div className="size-9 rounded-full bg-primary text-white text-sm font-semibold flex items-center justify-center ring-2 ring-white shadow-sm">
            S
          </div>
        </div>
      </header>

      {session.roomClosedMessage ? (
        <div className="px-6 py-3 text-sm bg-amber-50 text-amber-700 border-b border-amber-200">
          {session.roomClosedMessage}
        </div>
      ) : null}
      {!session.teacherOnline ? (
        <div className="px-6 py-3 text-sm bg-amber-50 text-amber-700 border-b border-amber-200">
          Teacher is offline. Feedback may be delayed.
        </div>
      ) : null}
      {session.status ? (
        <div className="px-6 py-3 text-sm bg-blue-50 text-blue-700 border-b border-blue-100">
          {session.status}
        </div>
      ) : null}

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        <section className="lg:col-span-8 bg-background-light overflow-y-auto custom-scrollbar p-6 md:p-10 flex justify-center">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-sm border border-slate-200 min-h-[800px] p-8 md:p-12">
            <div className="mb-8 border-b border-slate-100 pb-6 space-y-3">
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
                {session.currentTask?.task_title || 'IELTS Writing Task'}
              </h1>
              {session.currentTask?.task_prompt ? (
                <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg whitespace-pre-wrap">
                  <span className="font-semibold text-primary">Topic:</span> {session.currentTask.task_prompt}
                </p>
              ) : null}
              {session.currentTask?.task_image ? (
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <img
                    src={session.currentTask.task_image}
                    alt="Writing task illustration"
                    className="w-full max-h-[280px] object-cover"
                  />
                </div>
              ) : null}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-slate-500">Student: {session.submission?.student_name || 'Anonymous'}</p>
                {roomCode ? <p className="text-xs text-slate-400">Room {roomCode}</p> : null}
              </div>
            </div>

            <article className="prose prose-slate max-w-none font-serif text-lg leading-loose text-slate-700 writing-live-ui__essay-content">
              {session.textSegments.map((segment, index) => {
                const key = segment?.key ? `${segment.key}:${index}` : `segment:${index}`;
                if (!segment.active || segment.active.length === 0) {
                  return <span key={key}>{segment.text}</span>;
                }
                const primary = segment.active[segment.active.length - 1];
                const meta = getCriterionMeta(primary?.criterion);
                const note = String(primary?.note || '').trim();
                const isActive = activeHighlightId === String(primary?.id || '');
                return (
                  <mark
                    key={key}
                    ref={registerTextRef(primary?.id)}
                    className={`writing-live-ui__mark ${meta.markClass} ${isActive ? 'is-active' : ''}`}
                    onMouseEnter={() => setActiveHighlightId(String(primary?.id || ''))}
                    onClick={() => focusFromText(primary?.id)}
                    title={note || `${meta.label} feedback`}
                  >
                    {segment.text}
                    {note ? <span className="writing-live-ui__mark-tooltip">{note}</span> : null}
                  </mark>
                );
              })}
            </article>

            <p className="text-slate-400 italic text-base mt-8 border-t border-slate-100 pt-4">
              Feedback updates in real-time. Click highlight text or a feed card to sync focus.
            </p>
          </div>
        </section>

        <aside className="lg:col-span-4 bg-white border-l border-slate-200 flex flex-col h-[calc(100vh-64px)]">
          <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-10">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">forum</span>
              Live Feedback Feed
            </h3>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              Active task
            </div>
          </div>

          <div ref={feedScrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6 bg-slate-50/50">
            {session.activityItems.map((item) => (
              <div
                key={item.id}
                ref={registerFeedRef(item.highlightId)}
                className={`flex gap-3 writing-live-ui__feed-row ${
                  activeHighlightId === item.highlightId ? 'is-active' : ''
                }`}
                onMouseEnter={() => setActiveHighlightId(item.highlightId)}
              >
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-sm ${item.dotClass}`}>
                    {Number.isFinite(item.noteIndex) && item.noteIndex > 0 ? item.noteIndex : '#'}
                  </div>
                  <div className="w-0.5 h-full bg-slate-200 mt-2" />
                </div>
                <button
                  type="button"
                  className="flex-1 pb-4 text-left"
                  onClick={() => focusFromFeed(item.highlightId)}
                >
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <span className="text-xs font-semibold text-slate-500">{item.timeLabel || item.label}</span>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${item.badgeClass}`}>
                      {item.label}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                    <p className="text-sm text-slate-600 mb-2">
                      Highlighted <span className="font-bold text-slate-800">"{item.excerpt}"</span>
                    </p>
                    <div className="text-sm text-slate-800 pl-2 border-l-2 border-slate-300">
                      {item.comment || `${item.label} feedback`}
                    </div>
                  </div>
                </button>
              </div>
            ))}

            {session.activityItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
                No live feedback yet for this task.
              </div>
            ) : null}
          </div>
        </aside>
      </main>
    </div>
  );
}
