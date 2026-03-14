import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Loader2, Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { sanitizeActiveUIRoleForUser } from '@/app/activeUIRole';
import { USER_ROLE_SUPERVISOR } from '@/app/roleRouting';
import { api } from '@/shared/api/client';
import { TODAY, loadHomeroomHomeworkProgress, loadHomeroomStudentsQuick } from '../data/homeworkProgress.data';
import { DailyProgressBadge, StatusBadge } from '../components/status-badge';

const toDateLabel = (isoDate) => {
  if (isoDate === TODAY) return 'Today';
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const resolveLevelTone = (level) =>
  String(level || '').toUpperCase() === 'IELTS'
    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
    : 'border-teal-200 bg-teal-50 text-teal-700';

/** Inline skeleton for a single cell while progress data loads */
const CellSkeleton = () => <Skeleton className="h-5 w-20 rounded-full" />;

export default function HomeworkProgressPage() {
  const navigate = useNavigate();
  const activeUIRole = sanitizeActiveUIRoleForUser(api.getUser(), '');
  const isAllStudentsScope = activeUIRole === USER_ROLE_SUPERVISOR;
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [progressFilter, setProgressFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(TODAY);

  // Phase 1: quick student list (names + levels only)
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [students, setStudents] = useState([]);

  // Phase 2: assignment dashboards (progress data)
  const [progressLoading, setProgressLoading] = useState(true);
  const [dateOptions, setDateOptions] = useState([TODAY]);
  const [error, setError] = useState('');

  // Track which phase-2 load is current to avoid stale updates
  const progressSeqRef = useRef(0);

  // Phase 1: load student list immediately
  useEffect(() => {
    let isActive = true;

    const loadQuick = async () => {
      try {
        setStudentsLoading(true);
        const quickStudents = await loadHomeroomStudentsQuick();
        if (!isActive) return;
        setStudents(quickStudents);
      } catch (_err) {
        if (!isActive) return;
        setStudents([]);
      } finally {
        if (isActive) setStudentsLoading(false);
      }
    };

    void loadQuick();
    return () => {
      isActive = false;
    };
  }, []); // only once on mount

  // Phase 2: load full progress data (can re-run when date changes)
  useEffect(() => {
    progressSeqRef.current += 1;
    const currentSeq = progressSeqRef.current;

    const loadProgress = async () => {
      try {
        setProgressLoading(true);
        setError('');
        const response = await loadHomeroomHomeworkProgress({ selectedDate });
        if (currentSeq !== progressSeqRef.current) return; // stale

        const fullStudents = Array.isArray(response?.students) ? response.students : [];
        const nextDateOptions =
          Array.isArray(response?.dateOptions) && response.dateOptions.length > 0
            ? response.dateOptions
            : [selectedDate];

        setStudents(fullStudents);
        setDateOptions(nextDateOptions);
      } catch (loadError) {
        if (currentSeq !== progressSeqRef.current) return;
        setError(loadError?.message || 'Failed to load homework progress.');
      } finally {
        if (currentSeq === progressSeqRef.current) {
          setProgressLoading(false);
        }
      }
    };

    void loadProgress();
    return () => {
      // bump seq on cleanup to ignore stale results
      progressSeqRef.current += 1;
    };
  }, [selectedDate]);

  const preparedStudents = useMemo(
    () =>
      students.map((student) => {
        const dailyProgress = Array.isArray(student?.dailyProgress) ? student.dailyProgress : [];
        const selectedProgress = dailyProgress.find((entry) => entry?.date === selectedDate);
        // missing === -1 means progress hasn't loaded yet
        const missing = student?.missing === -1 ? -1 : Number(selectedProgress?.missing || 0);
        const pending = student?.pending === -1 ? -1 : Number(selectedProgress?.pending || 0);
        const completed = missing === -1 || pending === -1
          ? false
          : Boolean(selectedProgress?.completed ?? student?.completed);
        const assignments = Array.isArray(student?.assignments) ? student.assignments : [];
        const hasSubmissionActivity = assignments.some((assignment) =>
            Number(assignment?.submittedTasks || 0) > 0
            || Number(assignment?.doneCount || 0) > 0,
          );
        const completedForDisplay = completed
          || (hasSubmissionActivity && missing <= 0 && pending <= 0);
        const progressStatus = missing === -1 || pending === -1
          ? '_loading'
          : missing > 0
            ? 'missing'
            : pending > 0
              ? 'not_submitted'
              : completedForDisplay
                ? 'completed'
                : 'not_opened';
        return {
          ...student,
          missing,
          pending,
          completed: completedForDisplay,
          progressStatus,
          statusDisplay:
            progressStatus === 'not_opened' && !hasSubmissionActivity
              ? 'not_opened'
              : (student?.overallStatus || 'on_track'),
          overallStatus: student?.overallStatus || 'on_track',
        };
      }),
    [selectedDate, students],
  );

  const filteredStudents = useMemo(
    () =>
      preparedStudents.filter((student) => {
        if (search && !String(student?.name || '').toLowerCase().includes(search.toLowerCase())) return false;
        if (levelFilter !== 'all' && String(student?.level || '') !== levelFilter) return false;
        // When progress is still loading, skip progress-based filters
        if (student.progressStatus !== '_loading') {
          if (progressFilter === 'not_opened' && student.progressStatus !== 'not_opened') return false;
          if (progressFilter === 'completed' && student.progressStatus !== 'completed') return false;
          if (progressFilter === 'pending' && student.progressStatus !== 'not_submitted') return false;
          if (progressFilter === 'missing' && student.progressStatus !== 'missing') return false;
        }
        return true;
      }),
    [preparedStudents, search, levelFilter, progressFilter],
  );

  const isInitialLoading = studentsLoading && students.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[1300px] flex-col gap-6 p-4 md:p-6">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl tracking-tight">Homework Progress</CardTitle>
          <CardDescription>Track unopened, completed, pending, and missing submissions by date.</CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="space-y-4 p-4 md:p-6">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search student..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full lg:w-[160px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="IELTS">IELTS</SelectItem>
                <SelectItem value="ACA">ACA</SelectItem>
              </SelectContent>
            </Select>

            <Select value={progressFilter} onValueChange={setProgressFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Progress" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Progress</SelectItem>
                <SelectItem value="not_opened">Chưa mở bài tập</SelectItem>
                <SelectItem value="completed">Đã hoàn thành</SelectItem>
                <SelectItem value="pending">Đang làm</SelectItem>
                <SelectItem value="missing">Sắp hết hạn</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger className="w-full lg:w-[170px]">
                <div className="inline-flex items-center gap-2">
                  <CalendarDays className="size-4" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {dateOptions.map((date) => (
                  <SelectItem key={date} value={date}>
                    {toDateLabel(date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="size-4" />
            <span>
              {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
            </span>
            <span className="text-border">|</span>
            <span>{toDateLabel(selectedDate)}</span>
            {progressLoading && students.length > 0 ? (
              <>
                <span className="text-border">|</span>
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                <span className="text-xs">Loading progress...</span>
              </>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {/* Phase 1 skeleton: only while we don't have ANY students yet */}
          {isInitialLoading ? (
            <div className="rounded-lg border">
              <div className="space-y-4 p-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-4">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="ml-auto h-8 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!isInitialLoading && !error && students.length === 0 ? (
            <div className="rounded-lg border p-12 text-center">
              <Users className="mx-auto mb-3 size-10 text-muted-foreground" />
              <p className="text-muted-foreground">
                {isAllStudentsScope ? 'No students yet' : 'No homeroom students yet'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {isAllStudentsScope
                  ? 'No student data is available in this scope yet.'
                  : 'This teacher/admin does not have homeroom students assigned.'}
              </p>
            </div>
          ) : null}

          {!isInitialLoading && students.length > 0 && filteredStudents.length === 0 ? (
            <div className="rounded-lg border p-12 text-center">
              <Users className="mx-auto mb-3 size-10 text-muted-foreground" />
              <p className="text-muted-foreground">No students found</p>
              <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or filters.</p>
            </div>
          ) : null}

          {!isInitialLoading && filteredStudents.length > 0 ? (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-lg border md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Student Name</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Homework Progress</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => {
                      const isProgressPending = student.progressStatus === '_loading';
                      return (
                        <TableRow key={student.id}>
                          <TableCell className="font-medium">{student.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={resolveLevelTone(student.level)}>
                              {student.level}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {isProgressPending ? <CellSkeleton /> : <StatusBadge status={student.statusDisplay} />}
                          </TableCell>
                          <TableCell>
                            {isProgressPending ? (
                              <CellSkeleton />
                            ) : (
                              <DailyProgressBadge
                                missing={student.missing}
                                pending={student.pending}
                                completed={student.completed}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isProgressPending}
                              onClick={() =>
                                navigate(`/dashboard/homework-progress/${student.id}`, {
                                  state: { studentSnapshot: student, selectedDate },
                                })}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 md:hidden">
                {filteredStudents.map((student) => {
                  const isProgressPending = student.progressStatus === '_loading';
                  return (
                    <Card key={student.id} className="border-border/70 shadow-sm">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-medium text-foreground">{student.name}</p>
                            <Badge variant="outline" className={resolveLevelTone(student.level)}>
                              {student.level}
                            </Badge>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isProgressPending}
                            onClick={() =>
                              navigate(`/dashboard/homework-progress/${student.id}`, {
                                state: { studentSnapshot: student, selectedDate },
                              })}
                          >
                            View
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          {isProgressPending ? (
                            <>
                              <CellSkeleton />
                              <CellSkeleton />
                            </>
                          ) : (
                            <>
                              <StatusBadge status={student.statusDisplay} />
                              <DailyProgressBadge
                                missing={student.missing}
                                pending={student.pending}
                                completed={student.completed}
                              />
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
