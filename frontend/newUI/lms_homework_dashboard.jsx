export default function LMSHomeworkDashboard() {
  const metrics = [
    { label: 'Students', value: '22', hint: 'Active in homeroom' },
    { label: 'Assignments', value: '9', hint: 'Open this week' },
    { label: 'Submission Rate', value: '68%', hint: 'Across all homework' },
    { label: 'Need Feedback', value: '8', hint: 'Waiting for grading' },
  ];

  const actionItems = [
    { title: '8 submissions need grading', detail: 'Review and leave feedback for newly submitted homework.' },
    { title: '3 students missing homework', detail: 'Reach out before tomorrow\'s deadline window closes.' },
    { title: '2 late submissions', detail: 'Check whether they should still count for full credit.' },
  ];

  const trend = [15, 18, 12, 21, 19, 24, 16];
  const trendLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const students = [
    { name: 'Bùi Bích Ngọc', submitted: 8, late: 0, missing: 1, score: '92%', status: 'On track' },
    { name: 'Đặng Dương', submitted: 6, late: 1, missing: 2, score: '85%', status: 'At risk' },
    { name: 'Lê Hữu Kiệt', submitted: 9, late: 0, missing: 0, score: '96%', status: 'Excellent' },
    { name: 'Trần Minh Anh', submitted: 7, late: 1, missing: 1, score: '88%', status: 'Watchlist' },
    { name: 'Nguyễn Gia Hân', submitted: 9, late: 0, missing: 0, score: '94%', status: 'Excellent' },
  ];

  const activities = [
    { name: 'Bùi Bích Ngọc', action: 'submitted Reading Homework T3', time: '4 min ago' },
    { name: 'Đặng Dương', action: 'submitted Writing Exercise', time: '1 hour ago' },
    { name: 'Lê Hữu Kiệt', action: 'viewed Grammar Practice', time: '2 hours ago' },
    { name: 'Trần Minh Anh', action: 'left a comment on Homework 4', time: '3 hours ago' },
  ];

  const deadlines = [
    { title: 'Writing Homework T4', due: 'Due tomorrow', cls: 'Grade 8A' },
    { title: 'Grammar Exercise Unit 6', due: 'Due in 3 days', cls: 'Grade 8A' },
    { title: 'Reading Reflection', due: 'Due this Friday', cls: 'Grade 8A' },
  ];

  const statusClasses = {
    'On track': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    'At risk': 'bg-rose-50 text-rose-700 ring-rose-200',
    'Excellent': 'bg-sky-50 text-sky-700 ring-sky-200',
    'Watchlist': 'bg-amber-50 text-amber-700 ring-amber-200',
  };

  const maxTrend = Math.max(...trend);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto max-w-7xl p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-600">Teacher Dashboard</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Homework Overview</h1>
            <p className="mt-2 text-sm text-slate-500">Monitor submissions, identify at-risk students, and act on grading faster.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm outline-none transition focus:border-indigo-400">
              <option>Grade 8A</option>
              <option>Grade 8B</option>
              <option>All Classes</option>
            </select>
            <select className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm outline-none transition focus:border-indigo-400">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>This semester</option>
            </select>
            <button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">Export Report</button>
            <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800">Create Homework</button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((item) => (
            <div key={item.label} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <p className="text-sm text-slate-500">{item.label}</p>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-3xl font-semibold tracking-tight">{item.value}</p>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Live</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{item.hint}</p>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Submission Trend</h2>
                <p className="mt-1 text-sm text-slate-500">Submitted homework count for the last 7 days.</p>
              </div>
              <button className="text-sm font-medium text-indigo-600">View detailed analytics</button>
            </div>

            <div className="mt-8 flex h-72 items-end gap-3">
              {trend.map((value, index) => (
                <div key={trendLabels[index]} className="flex flex-1 flex-col items-center gap-3">
                  <div className="flex h-56 w-full items-end">
                    <div
                      className="w-full rounded-t-2xl bg-gradient-to-t from-indigo-600 to-sky-400"
                      style={{ height: `${(value / maxTrend) * 100}%` }}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-700">{value}</p>
                    <p className="text-xs text-slate-400">{trendLabels[index]}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Action Needed</h2>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">Priority</span>
            </div>
            <div className="mt-6 space-y-4">
              {actionItems.map((item) => (
                <div key={item.title} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-300">{item.detail}</p>
                </div>
              ))}
            </div>
            <button className="mt-6 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100">
              Review submissions
            </button>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Students Progress</h2>
                <p className="mt-1 text-sm text-slate-500">Track submission behavior and quickly spot learners who need support.</p>
              </div>
              <div className="flex gap-2">
                <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">Sort by Missing</button>
                <button className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">View all students</button>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Student</th>
                    <th className="px-4 py-3 font-medium">Submitted</th>
                    <th className="px-4 py-3 font-medium">Late</th>
                    <th className="px-4 py-3 font-medium">Missing</th>
                    <th className="px-4 py-3 font-medium">Avg Score</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {students.map((student) => (
                    <tr key={student.name} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                            {student.name
                              .split(' ')
                              .slice(-2)
                              .map((part) => part[0])
                              .join('')}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{student.name}</p>
                            <p className="text-xs text-slate-500">Grade 8A</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-700">{student.submitted}</td>
                      <td className="px-4 py-4 text-slate-700">{student.late}</td>
                      <td className="px-4 py-4 text-slate-700">{student.missing}</td>
                      <td className="px-4 py-4 text-slate-700">{student.score}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${statusClasses[student.status]}`}>
                          {student.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Recent Activity</h2>
                <button className="text-sm font-medium text-indigo-600">See all</button>
              </div>
              <div className="mt-5 space-y-4">
                {activities.map((activity) => (
                  <div key={`${activity.name}-${activity.time}`} className="flex gap-3">
                    <div className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    <div>
                      <p className="text-sm text-slate-700">
                        <span className="font-medium text-slate-900">{activity.name}</span> {activity.action}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Upcoming Deadlines</h2>
                <button className="text-sm font-medium text-indigo-600">Open calendar</button>
              </div>
              <div className="mt-5 space-y-3">
                {deadlines.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-slate-200 p-4">
                    <p className="font-medium text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.cls}</p>
                    <p className="mt-3 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                      {item.due}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
