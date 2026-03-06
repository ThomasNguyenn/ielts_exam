import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Search, Users } from 'lucide-react';
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
import { TODAY, students } from './staffDashboard.mock';
import { DailyProgressBadge, StatusBadge } from './status-badge';

const toIsoDateOffset = (isoDate, daysOffset) => {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().slice(0, 10);
};

const toDateLabel = (isoDate) => {
  if (isoDate === TODAY) return 'Today';
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const resolveOverallStatus = (student, missingToday) => {
  const assignments = Array.isArray(student?.assignments) ? student.assignments : [];
  const missingAssignments = assignments.filter(
    (item) => String(item?.status || '').toLowerCase() === 'missing',
  ).length;
  if (missingToday > 0 || missingAssignments > 0) return 'needs_attention';
  const hasPendingReview = assignments.some(
    (item) =>
      String(item?.status || '').toLowerCase() === 'submitted'
      && String(item?.gradingStatus || '').toLowerCase() === 'pending',
  );
  if (hasPendingReview) return 'in_review';
  return 'on_track';
};

const resolveLevelTone = (level) =>
  String(level || '').toUpperCase() === 'IELTS'
    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
    : 'border-teal-200 bg-teal-50 text-teal-700';

export default function HomeworkProgressPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [progressFilter, setProgressFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [loading] = useState(false);

  const dateOptions = useMemo(() => {
    const values = new Set([TODAY, toIsoDateOffset(TODAY, -1), toIsoDateOffset(TODAY, -2)]);
    students.forEach((student) => {
      (Array.isArray(student?.dailyProgress) ? student.dailyProgress : []).forEach((entry) => {
        const date = String(entry?.date || '').trim();
        if (date) values.add(date);
      });
    });
    return Array.from(values).sort((a, b) => (a < b ? 1 : -1));
  }, []);

  const preparedStudents = useMemo(
    () =>
      students.map((student) => {
        const dailyProgress = Array.isArray(student?.dailyProgress) ? student.dailyProgress : [];
        const selectedProgress = dailyProgress.find((entry) => entry?.date === selectedDate);
        const missing = Number(selectedProgress?.missing || 0);
        return {
          ...student,
          missing,
          overallStatus: resolveOverallStatus(student, missing),
        };
      }),
    [selectedDate],
  );

  const filteredStudents = useMemo(
    () =>
      preparedStudents.filter((student) => {
        if (search && !String(student?.name || '').toLowerCase().includes(search.toLowerCase())) return false;
        if (levelFilter !== 'all' && String(student?.level || '') !== levelFilter) return false;
        if (progressFilter === 'ontime' && student.missing > 0) return false;
        if (progressFilter === 'missing' && student.missing === 0) return false;
        return true;
      }),
    [preparedStudents, search, levelFilter, progressFilter],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1300px] flex-col gap-6 p-4 md:p-6">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl tracking-tight">Homework Progress</CardTitle>
          <CardDescription>Track student completion and missing submissions by date.</CardDescription>
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
                <SelectItem value="ontime">On time</SelectItem>
                <SelectItem value="missing">Missing</SelectItem>
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
          </div>

          {loading ? (
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

          {!loading && filteredStudents.length === 0 ? (
            <div className="rounded-lg border p-12 text-center">
              <Users className="mx-auto mb-3 size-10 text-muted-foreground" />
              <p className="text-muted-foreground">No students found</p>
              <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or filters.</p>
            </div>
          ) : null}

          {!loading && filteredStudents.length > 0 ? (
            <>
              <div className="hidden overflow-hidden rounded-lg border md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Student Name</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Overall Status</TableHead>
                      <TableHead>Daily Progress</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={resolveLevelTone(student.level)}>
                            {student.level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={student.overallStatus} />
                        </TableCell>
                        <TableCell>
                          <DailyProgressBadge missing={student.missing} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/dashboard/homework-progress/${student.id}`)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 md:hidden">
                {filteredStudents.map((student) => (
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
                          onClick={() => navigate(`/dashboard/homework-progress/${student.id}`)}
                        >
                          View
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={student.overallStatus} />
                        <DailyProgressBadge missing={student.missing} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

