import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  ClipboardList,
  Info,
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
import { TODAY, students, submissionEvents, submissionStackedSeries } from './staffDashboard.mock';

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

export default function StaffDashboardPage() {
  const navigate = useNavigate();
  const user = api.getUser();
  const isAdminUser = normalizeUserRole(user?.role) === USER_ROLE_ADMIN;

  const stats = useMemo(() => {
    const totalStudents = students.length;
    const totalAssignments = students.reduce((sum, student) => sum + student.assignments.length, 0);
    const totalSubmitted = students.reduce(
      (sum, student) => sum + student.assignments.filter((item) => item.status === 'Submitted').length,
      0,
    );
    const completionRate = totalAssignments === 0
      ? 0
      : Math.round((totalSubmitted / totalAssignments) * 100);
    const onTimeToday = students.filter((student) => {
      const todayProgress = student.dailyProgress.find((entry) => entry.date === TODAY);
      return todayProgress && todayProgress.missing === 0;
    }).length;
    const totalPendingReviews = students.reduce(
      (sum, student) => (
        sum
        + student.assignments.filter(
          (assignment) => assignment.status === 'Submitted' && assignment.gradingStatus === 'Pending',
        ).length
      ),
      0,
    );

    return {
      totalStudents,
      totalSubmitted,
      onTimeToday,
      completionRate,
      totalAssignments,
      totalPendingReviews,
    };
  }, []);

  const newStudents = useMemo(
    () => students.filter((student) => student.joinedAt.includes('day')).slice(0, 4),
    [],
  );
  const activeStudents = useMemo(
    () => students.filter((student) => {
      const todayProgress = student.dailyProgress.find((entry) => entry.date === TODAY);
      return todayProgress && todayProgress.missing === 0;
    }),
    [],
  );

  const submissionTrendText = useMemo(() => {
    const values = submissionStackedSeries;
    if (values.length < 2) return 'Submission trend is stable this week.';
    const last = values[values.length - 1]?.submitted || 0;
    const prev = values[values.length - 2]?.submitted || 0;
    if (prev <= 0) return 'Submission trend is stable this week.';
    const percent = Math.abs(Math.round(((last - prev) / prev) * 100));
    if (last > prev) return `Submitted up ${percent}% vs previous day`;
    if (last < prev) return `Submitted down ${percent}% vs previous day`;
    return 'Submission trend is stable this week.';
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Home</span>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Dashboard</span>
      </div>

      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Learn more <Info className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Gain real-time insights into class analytics and daily learning activity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/dashboard/homework-progress')}>
            Homework Progress
          </Button>
          <Button type="button" onClick={() => navigate('/scores')}>
            View All Students
          </Button>
        </div>
      </section>

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
                  label="All Students"
                  value={String(stats.totalStudents)}
                />
                <MetricItem
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  toneClass="bg-orange-100 text-orange-600"
                  label="Submissions"
                  value={String(stats.totalSubmitted)}
                />
                <MetricItem
                  icon={<ClipboardList className="h-4 w-4" />}
                  toneClass="bg-blue-100 text-blue-600"
                  label="On time today"
                  value={String(stats.onTimeToday)}
                />
                <MetricItem
                  icon={<Clock className="h-4 w-4" />}
                  toneClass="bg-pink-100 text-pink-600"
                  label="Avg Completion"
                  value={`${stats.completionRate}%`}
                />
                <MetricItem
                  icon={<BookOpen className="h-4 w-4" />}
                  toneClass="bg-emerald-100 text-emerald-600"
                  label="Assignments"
                  value={String(stats.totalAssignments)}
                />
                <MetricItem
                  icon={<AlertCircle className="h-4 w-4" />}
                  toneClass="bg-amber-100 text-amber-700"
                  label="Need Feedback"
                  value={String(stats.totalPendingReviews).padStart(2, '0')}
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
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={submissionStackedSeries} barSize={60}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      tickMargin={10}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => String(value).slice(0, 3)}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                    />
                    <RechartsTooltip
                      cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
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
            </CardContent>
            <CardFooter className="flex-col items-start gap-1 text-sm">
              <div className="inline-flex items-center gap-2 font-medium text-foreground">
                {submissionTrendText}
                <TrendingUp className="h-4 w-4" />
              </div>
              <p className="text-xs text-muted-foreground">
                Showing submission status for the last 7 days.
              </p>
            </CardFooter>
          </Card>

          <Card className="border-border/70 shadow-sm">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Events Log</CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => navigate('/homework')}>
                See All
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {submissionEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40"
                    onClick={() => navigate('/homework')}
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
                ))}
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
                  {newStudents.map((student) => (
                    <div key={student.id} className="flex items-center justify-between gap-2 rounded-md px-1 py-2">
                      <div className="min-w-0 flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className={`text-xs font-semibold ${toneByName(student.name)}`}>
                            {toInitials(student.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{student.name}</p>
                          <p className="text-xs text-muted-foreground">{student.joinedAt} ago</p>
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="ghost" onClick={() => navigate('/scores')}>
                        Contact
                      </Button>
                    </div>
                  ))}
                </div>
              </section>

              <Separator />

              <section className="space-y-1">
                <p className="text-xs text-muted-foreground">Active Students</p>
                <div className="space-y-1">
                  {activeStudents.map((student) => (
                    <div key={student.id} className="flex items-center justify-between gap-2 rounded-md px-1 py-2">
                      <div className="min-w-0 flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className={`text-xs font-semibold ${toneByName(student.name)}`}>
                            {toInitials(student.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{student.name}</p>
                          <p className="text-xs text-muted-foreground">Joined {student.joinedAt} ago</p>
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="ghost" onClick={() => navigate('/scores')}>
                        Contact
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
