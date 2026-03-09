export default function DuolingoIeltsHomeworkRedesign() {
  const resources = [
    {
      id: 1,
      title: 'Reading Passage 1',
      subtitle: 'Skim the text, note new words, then complete the task.',
      tag: 'Required',
      status: 'ready',
    },
    {
      id: 2,
      title: 'Reading Passage 2',
      subtitle: 'Continue with the second passage before uploading your work.',
      tag: 'Required',
      status: 'ready',
    },
  ];

  const checklist = [
    'Take note of the new vocabulary you find.',
    'Write the words and meanings in your notebook, then upload a photo below.',
    'Finish both reading passages before submitting.',
  ];

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow">
              <span className="text-lg">←</span>
            </button>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">Homework lesson</p>
              <h1 className="text-2xl font-black tracking-tight md:text-3xl">9/3/2026 Reading</h1>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
              In progress
            </div>
            <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm">
              2 resources
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.72fr]">
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[28px] border-2 border-slate-900 bg-white shadow-[0_10px_0_0_rgba(15,23,42,0.12)]">
              <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-white to-sky-50 px-6 py-5 md:px-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-2xl shadow-inner">
                      📘
                    </div>
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                          Reading mission
                        </span>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                          3 steps
                        </span>
                      </div>
                      <h2 className="text-xl font-black md:text-2xl">Complete the reading activity</h2>
                      <p className="mt-1 max-w-2xl text-sm text-slate-600 md:text-base">
                        A cleaner, friendlier student experience inspired by Duolingo cards and IELTS practice dashboards.
                      </p>
                    </div>
                  </div>

                  <div className="hidden rounded-2xl border border-emerald-200 bg-white/90 px-4 py-3 text-right shadow-sm md:block">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Progress</p>
                    <p className="text-lg font-black text-emerald-600">1 / 3 done</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 md:px-7">
                <div className="mb-6 grid gap-3">
                  {checklist.map((item, index) => (
                    <div
                      key={item}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4"
                    >
                      <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${index === 0 ? 'bg-emerald-500 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
                        {index === 0 ? '✓' : index + 1}
                      </div>
                      <p className="text-sm leading-6 text-slate-700 md:text-base">{item}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black">Launch resources</h3>
                      <p className="text-sm text-slate-500">Open each passage before you submit your homework.</p>
                    </div>
                    <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">Tap-friendly</div>
                  </div>

                  <div className="grid gap-4">
                    {resources.map((resource, index) => (
                      <div
                        key={resource.id}
                        className="group rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-start gap-4">
                            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl ${index === 0 ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                              {index === 0 ? '📖' : '📝'}
                            </div>
                            <div>
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                                  {resource.title}
                                </span>
                                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                                  {resource.tag}
                                </span>
                              </div>
                              <h4 className="text-lg font-black text-slate-900">Open {resource.title}</h4>
                              <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">{resource.subtitle}</p>
                            </div>
                          </div>

                          <div className="flex flex-col items-stretch gap-2 md:items-end">
                            <button className="min-w-[180px] rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-[0_6px_0_0_rgba(5,150,105,0.28)] transition hover:bg-emerald-600 active:translate-y-[2px] active:shadow-[0_3px_0_0_rgba(5,150,105,0.28)]">
                              Open Resource
                            </button>
                            <p className="text-center text-xs font-semibold text-slate-500 md:text-right">Opens the correct content only</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black">Submit your work</h3>
                  <p className="text-sm text-slate-500">Upload a notebook photo or short video of your completed vocabulary notes.</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                  Not uploaded
                </span>
              </div>

              <div className="rounded-[24px] border-2 border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm">
                  ☁️
                </div>
                <p className="text-lg font-black">Upload image / video</p>
                <p className="mt-2 text-sm text-slate-500">Clearer hierarchy, larger tap targets, and a more student-friendly tone.</p>
                <button className="mt-5 rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-100">
                  Choose file
                </button>
              </div>

              <button className="mt-5 w-full rounded-[20px] bg-slate-900 px-6 py-4 text-base font-black text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-slate-800">
                Submit task
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
