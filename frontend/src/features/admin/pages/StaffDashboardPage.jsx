import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  ClipboardList,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { USER_ROLE_ADMIN, normalizeUserRole } from '@/app/roleRouting';
import { api } from '@/shared/api/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { loadStaffDashboardData } from '../data/homeworkProgress.data';

const AVATAR_TONES = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
];

const EVENT_STATUS_STYLES = {
  Submitted: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Late: 'border-red-200 bg-red-50 text-red-600',
  Resubmitted: 'border-blue-200 bg-blue-50 text-blue-600',
};

const EMPTY_DASHBOARD_DATA = {
  stats: {
    totalStudents: 0,
    totalSubmitted: 0,
    onTimeToday: 0,
    completionRate: 0,
    totalAssignments: 0,
    totalPendingReviews: 0,
  },
  submissionStackedSeries: [],
  submissionEvents: [],
  newStudents: [],
  activeStudents: [],
  students: [],
};

const toInitials = (name) =>
  String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'ST';

const toneByName = (name) => {
  const raw = String(name || '');
  const score = raw.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_TONES[score % AVATAR_TONES.length];
};

const formatChartDay = (isoDate) => {
  const date = new Date(`${String(isoDate || '').slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(isoDate || '');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const toJoinedLabel = (value) => (value === 'today' ? 'Joined today' : `${value} ago`);

function MetricItem({ icon, label, value, toneClass }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${toneClass}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold leading-tight text-foreground tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function EventBadge({ status }) {
  const styleClass = EVENT_STATUS_STYLES[status] || 'border-muted bg-muted text-foreground';
  return (
    <Badge variant="outline" className={`rounded-md px-1.5 py-0 text-[10px] ${styleClass}`}>
      {status}
    </Badge>
  );
}

const resolveSubmissionGradePath = (event = {}) => {
  const submissionId = String(event?.submissionId || '').trim();
  if (!submissionId) return '/homework';
  return `/homework/submissions/${encodeURIComponent(submissionId)}`;
};

export default function StaffDashboardPage() {
  const navigate = useNavigate();
  const user = api.getUser();
  const isAdminUser = normalizeUserRole(user?.role) === USER_ROLE_ADMIN;

  const [rangeDays, setRangeDays] = useState(7);
  const [scope, setScope] = useState('homeroom');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState(EMPTY_DASHBOARD_DATA);

  const effectiveScope = isAdminUser ? scope : 'homeroom';

  useEffect(() => {
    let isActive = true;

    const loadData = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await loadStaffDashboardData({
          rangeDays,
          scope: effectiveScope,
        });
        if (!isActive) return;
        setDashboardData(response || EMPTY_DASHBOARD_DATA);
      } catch (loadError) {
        if (!isActive) return;
        setDashboardData(EMPTY_DASHBOARD_DATA);
        setError(loadError?.message || 'Failed to load dashboard data.');
      } finally {
        if (isActive) setLoading(false);
      }
    };

    void loadData();

    return () => {
      isActive = false;
    };
  }, [effectiveScope, rangeDays]);

  const stats = dashboardData?.stats || EMPTY_DASHBOARD_DATA.stats;
  const submissionStackedSeries = Array.isArray(dashboardData?.submissionStackedSeries)
    ? dashboardData.submissionStackedSeries
    : [];
  const submissionEvents = Array.isArray(dashboardData?.submissionEvents)
    ? dashboardData.submissionEvents
    : [];
  const newStudents = Array.isArray(dashboardData?.newStudents)
    ? dashboardData.newStudents
    : [];
  const activeStudents = Array.isArray(dashboardData?.activeStudents)
    ? dashboardData.activeStudents
    : [];

  const hasChartActivity = submissionStackedSeries.some(
    (entry) => Number(entry?.submitted || 0) > 0 || Number(entry?.notSubmitted || 0) > 0,
  );
  const noStudentsInScope = !loading && !error && Number(stats.totalStudents || 0) === 0;

  const submissionTrendText = useMemo(() => {
    if (submissionStackedSeries.length < 2) return 'Submission trend is stable.';
    const last = Number(submissionStackedSeries[submissionStackedSeries.length - 1]?.submitted || 0);
    const prev = Number(submissionStackedSeries[submissionStackedSeries.length - 2]?.submitted || 0);
    if (prev <= 0) return 'Submission trend is stable.';
    const percent = Math.abs(Math.round(((last - prev) / prev) * 100));
    if (last > prev) return `Submitted up ${percent}% vs previous day`;
    if (last < prev) return `Submitted down ${percent}% vs previous day`;
    return 'Submission trend is stable.';
  }, [submissionStackedSeries]);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Gain real-time insights into class analytics and daily learning activity.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => navigate('/dashboard/homework-progress')}>
              Homework Progress
            </Button>
            <Button type="button" onClick={() => navigate('/dashboard/homeroom-students')}>
              View All Students
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border bg-muted/30 p-1">
            <Button
              type="button"
              size="sm"
              variant={rangeDays === 7 ? 'default' : 'ghost'}
              className="h-8 px-3 text-xs"
              onClick={() => setRangeDays(7)}
            >
              7d
            </Button>
            <Button
              type="button"
              size="sm"
              variant={rangeDays === 30 ? 'default' : 'ghost'}
              className="h-8 px-3 text-xs"
              onClick={() => setRangeDays(30)}
            >
              30d
            </Button>
          </div>

          {isAdminUser ? (
            <div className="inline-flex rounded-md border bg-muted/30 p-1">
              <Button
                type="button"
                size="sm"
                variant={effectiveScope === 'homeroom' ? 'default' : 'ghost'}
                className="h-8 px-3 text-xs"
                onClick={() => setScope('homeroom')}
              >
                My Homeroom
              </Button>
              <Button
                type="button"
                size="sm"
                variant={effectiveScope === 'all' ? 'default' : 'ghost'}
                className="h-8 px-3 text-xs"
                onClick={() => setScope('all')}
              >
                All Students
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {noStudentsInScope ? (
        <div className="rounded-lg border border-border/80 bg-card px-4 py-3 text-sm text-muted-foreground">
          No students found in current scope.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Overview Metrics</CardTitle>
              <CardDescription>Snapshot of student activity and teacher workload.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <MetricItem
                  icon={<Users className="h-4 w-4" />}
                  toneClass="bg-violet-100 text-violet-700"
                  label="Students"
                  value={String(stats.totalStudents || 0)}
                />
                <MetricItem
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  toneClass="bg-orange-100 text-orange-600"
                  label="On-time submissions"
                  value={String(stats.totalSubmitted || 0)}
                />
                <MetricItem
                  icon={<ClipboardList className="h-4 w-4" />}
                  toneClass="bg-blue-100 text-blue-600"
                  label="On time today"
                  value={String(stats.onTimeToday || 0)}
                />
                <MetricItem
                  icon={<Clock className="h-4 w-4" />}
                  toneClass="bg-pink-100 text-pink-600"
                  label="Avg Completion"
                  value={`${Number(stats.completionRate || 0)}%`}
                />
                <MetricItem
                  icon={<BookOpen className="h-4 w-4" />}
                  toneClass="bg-emerald-100 text-emerald-600"
                  label="Assignment Slots"
                  value={String(stats.totalAssignments || 0)}
                />
                <MetricItem
                  icon={<AlertCircle className="h-4 w-4" />}
                  toneClass="bg-amber-100 text-amber-700"
                  label="Need Feedback"
                  value={String(stats.totalPendingReviews || 0).padStart(2, '0')}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Submissions by Day</CardTitle>
              <CardDescription>
                Stacked comparison of students who submitted vs not submitted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  Loading chart data...
                </div>
              ) : !hasChartActivity ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  No submission activity in selected range.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={submissionStackedSeries}
                      barSize={Math.max(10, Math.floor(300 / Math.max(1, submissionStackedSeries.length)))}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        tickMargin={10}
                        axisLine={false}
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        tickFormatter={formatChartDay}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                        width={32}
                      />
                      <RechartsTooltip
                        cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
                        labelFormatter={(value) => formatChartDay(value)}
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid hsl(var(--border))',
                          background: 'hsl(var(--background))',
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="submitted"
                        name="Submitted"
                        stackId="submission"
                        fill="var(--staff-dashboard-chart-submitted, #2B7FFF)"
                        radius={[0, 0, 4, 4]}
                      />
                      <Bar
                        dataKey="notSubmitted"
                        name="Not submitted"
                        stackId="submission"
                        fill="var(--staff-dashboard-chart-not-submitted, #8EC5FF)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex-col items-start gap-1 text-sm">
              <div className="inline-flex items-center gap-2 font-medium text-foreground">
                {submissionTrendText}
                <TrendingUp className="h-4 w-4" />
              </div>
              <p className="text-xs text-muted-foreground">
                Showing submission status for the last {rangeDays} days.
              </p>
            </CardFooter>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Events Log</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/dashboard/homework-progress')}>
                See All
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {loading ? (
                  <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading events...</div>
                ) : submissionEvents.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No events in selected range.
                  </div>
                ) : (
                  submissionEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40"
                      onClick={() => navigate(resolveSubmissionGradePath(event))}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className={`text-xs font-semibold ${toneByName(event.studentName)}`}>
                          {toInitials(event.studentName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {event.studentName}
                          </span>
                          <EventBadge status={event.status} />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{event.assignmentName}</p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {event.timeAgo}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {isAdminUser ? (
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Admin Quick Actions</CardTitle>
                <CardDescription>Shortcuts to administration areas.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start"
                  onClick={() => navigate('/admin/manage')}
                >
                  Manage Content
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start"
                  onClick={() => navigate('/admin/people')}
                >
                  People
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="justify-start"
                  onClick={() => navigate('/admin/manage/passages')}
                >
                  Open Passages
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="justify-start"
                  onClick={() => navigate('/admin/people/request')}
                >
                  Approve Students
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <aside className="w-full xl:w-72">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Students</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/scores')}>
                See All
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <section className="space-y-1">
                <p className="text-xs text-muted-foreground">New Students</p>
                <div className="space-y-1">
                  {loading ? (
                    <p className="px-1 py-2 text-xs text-muted-foreground">Loading...</p>
                  ) : newStudents.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-muted-foreground">No new students in selected range.</p>
                  ) : (
                    newStudents.map((student) => (
                      <div key={student.id} className="flex items-center justify-between gap-2 rounded-md px-1 py-2">
                        <div className="min-w-0 flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className={`text-xs font-semibold ${toneByName(student.name)}`}>
                              {toInitials(student.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{student.name}</p>
                            <p className="text-xs text-muted-foreground">{toJoinedLabel(student.joinedAt)}</p>
                          </div>
                        </div>
                        <Button type="button" size="sm" variant="ghost" onClick={() => navigate('/scores')}>
                          Contact
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <Separator />

              <section className="space-y-1">
                <p className="text-xs text-muted-foreground">Active Students</p>
                <div className="space-y-1">
                  {loading ? (
                    <p className="px-1 py-2 text-xs text-muted-foreground">Loading...</p>
                  ) : activeStudents.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-muted-foreground">No active students today.</p>
                  ) : (
                    activeStudents.map((student) => (
                      <div key={student.id} className="flex items-center justify-between gap-2 rounded-md px-1 py-2">
                        <div className="min-w-0 flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className={`text-xs font-semibold ${toneByName(student.name)}`}>
                              {toInitials(student.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{student.name}</p>
                            <p className="text-xs text-muted-foreground">{toJoinedLabel(student.joinedAt)}</p>
                          </div>
                        </div>
                        <Button type="button" size="sm" variant="ghost" onClick={() => navigate('/scores')}>
                          Contact
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
