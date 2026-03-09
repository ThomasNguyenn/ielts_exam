import { motion } from 'framer-motion';

export default function DuolingoStyleHomework() {
  const lessons = [
    {
      id: 1,
      title: 'Reading Vocabulary Builder',
      type: 'Reading',
      icon: '📖',
      xp: 25,
      hearts: 3,
      status: 'done',
      subtitle: 'Learn new words and finish the reading passages',
      bubble: 'Nice work!',
      color: 'from-emerald-400 to-green-500',
      offset: 'self-center',
      kind: 'lesson'
    },
    {
      id: 2,
      title: 'Listening Dictation',
      type: 'Listening',
      icon: '🎧',
      xp: 20,
      hearts: 3,
      status: 'continue',
      subtitle: 'Listen carefully and type what you hear',
      bubble: 'Keep going!',
      color: 'from-amber-400 to-orange-500',
      offset: 'self-end mr-6 md:mr-16',
      kind: 'lesson'
    },

    {
      id: 'reward-1',
      icon: '🎁',
      bubble: 'Reward chest',

  const actionLabel = {
    done: 'Review',
    continue: 'Continue',
    current: 'Start Lesson',
    locked: 'Locked',
  };

  const actionStyle = {
    done: 'bg-sky-500 hover:bg-sky-600 text-white',
    continue: 'bg-amber-500 hover:bg-amber-600 text-white',
    current: 'bg-emerald-500 hover:bg-emerald-600 text-white',
    locked: 'bg-slate-200 text-slate-500 cursor-not-allowed',
  };

  const nodeRing = {
    done: 'ring-sky-200',
    continue: 'ring-amber-200',
    current: 'ring-emerald-200 ring-4',
    locked: 'ring-slate-200 opacity-70',
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#ffffff,_#eefbf3_30%,_#f5f7fb_70%)] p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.08)] backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500 text-3xl text-white shadow-lg">
              🦉
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Homework Path</h1>
              <p className="text-sm text-slate-500">A playful lesson map inspired by Duolingo</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm font-bold text-slate-700">
            <div className="flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2">
              🔥 <span>4 day streak</span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2">
              ⭐ <span>75 XP</span>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="rounded-[36px] border border-white/80 bg-white/85 p-6 shadow-[0_20px_55px_rgba(15,23,42,0.07)] backdrop-blur md:p-8">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-600">March journey</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">Follow the lesson path</h2>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Progress</p>
                <p className="text-lg font-black text-emerald-600">60%</p>
              </div>
            </div>

            <div className="relative flex flex-col items-center gap-6 py-4">
              <div className="pointer-events-none absolute left-1/2 top-8 h-[calc(100%-5rem)] w-[6px] -translate-x-1/2 rounded-full bg-slate-200" />

              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 800 1200"
                preserveAspectRatio="none"
              >
                <path
                  d="M400 90 C 560 180, 560 280, 400 360 C 240 440, 240 540, 400 630 C 560 720, 560 820, 400 910 C 240 1000, 240 1080, 400 1140"
                  fill="none"
                  stroke="#dbe4ee"
                  strokeWidth="14"
                  strokeLinecap="round"
                />
                <path
                  d="M400 90 C 560 180, 560 280, 400 360 C 240 440, 240 540, 400 630"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="14"
                  strokeLinecap="round"
                />
              </svg>

              {lessons.map((lesson, index) => (
                <motion.div
                  key={lesson.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08 }}
                  className={`relative z-10 flex w-full max-w-md flex-col items-center ${lesson.offset}`}
                >
                  <div className="mb-3 rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-500 shadow-sm ring-1 ring-slate-200">
                    {lesson.bubble}
                  </div>

                  <div className="flex w-full items-center gap-4">
                    <button
                      className={`relative flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] bg-gradient-to-br ${lesson.color} text-4xl shadow-[0_12px_0_0_rgba(15,23,42,0.12)] ring-2 ${nodeRing[lesson.status]} transition hover:scale-105 ${lesson.status === 'locked' ? 'grayscale' : ''}`}
                      disabled={lesson.status === 'locked'}
                    >
                      {lesson.status === 'current' ? (
                        <span className="absolute -top-3 -right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl shadow-md ring-2 ring-emerald-100">
                          ⭐
                        </span>
                      ) : null}
                      <span>{lesson.icon}</span>
                    </button>

                    <div className="flex-1 rounded-[28px] border border-slate-100 bg-white p-4 shadow-md">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                        <span className="rounded-full bg-slate-100 px-3 py-1">{lesson.type}</span>
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">+{lesson.xp} XP</span>
                      </div>

                      <h3 className="text-lg font-black text-slate-900">{lesson.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{lesson.subtitle}</p>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <div className="flex gap-1">
                          {Array.from({ length: lesson.hearts }).map((_, i) => (
                            <span key={i}>❤️</span>
                          ))}
                        </div>

                        <button
                          className={`rounded-2xl px-4 py-2 text-sm font-black shadow-sm transition ${actionStyle[lesson.status]}`}
                          disabled={lesson.status === 'locked'}
                        >
                          {actionLabel[lesson.status]}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[30px] border border-white/80 bg-white/90 p-5 shadow-[0_14px_35px_rgba(15,23,42,0.07)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-emerald-100 text-3xl">🎯</div>
                <div>
                  <h3 className="text-lg font-black">Today’s quest</h3>
                  <p className="text-sm text-slate-500">Complete one lesson to grow your streak.</p>
                </div>
              </div>
              <div className="rounded-[24px] bg-gradient-to-br from-emerald-50 to-white p-4 ring-1 ring-emerald-100">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Current mission</p>
                <p className="mt-2 text-lg font-black text-slate-900">Reading Passage Review</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">A playful path helps students immediately understand what to do next.</p>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/80 bg-white/90 p-5 shadow-[0_14px_35px_rgba(15,23,42,0.07)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-amber-100 text-3xl">💛</div>
                <div>
                  <h3 className="text-lg font-black">Why this feels more Duolingo</h3>
                  <p className="text-sm text-slate-500">More playful, more visual, more rewarding.</p>
                </div>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <div className="rounded-[22px] bg-slate-50 p-4">
                  <p className="font-black text-slate-800">Curved path map</p>
                  <p className="mt-1 leading-6">Students follow a visible route instead of scanning a flat admin list.</p>
                </div>
                <div className="rounded-[22px] bg-slate-50 p-4">
                  <p className="font-black text-slate-800">Big lesson nodes</p>
                  <p className="mt-1 leading-6">Every lesson feels like a level with progress, reward, and personality.</p>
                </div>
                <div className="rounded-[22px] bg-slate-50 p-4">
                  <p className="font-black text-slate-800">Friendly momentum</p>
                  <p className="mt-1 leading-6">XP, streaks, mascot tone, and microcopy make homework feel more motivating.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
