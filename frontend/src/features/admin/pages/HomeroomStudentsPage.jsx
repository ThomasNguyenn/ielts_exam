import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  ChevronRight,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  User,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { homeroomStudents } from './homeroomStudents.mock';
import { StatusBadge } from './status-badge';

const formatDate = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const getInitials = (name) =>
  String(name || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const completionFor = (student) => {
  const assignments = Array.isArray(student?.assignments) ? student.assignments : [];
  if (!assignments.length) return 0;
  const done = assignments.filter((assignment) => assignment.status === 'Submitted').length;
  return Math.round((done / assignments.length) * 100);
};

const resolveCompletionBarColor = (percentage) => {
  if (percentage === 100) return 'bg-emerald-500';
  if (percentage >= 50) return 'bg-violet-500';
  return 'bg-amber-500';
};

const resolveLevelBadgeClass = (level) =>
  level === 'IELTS' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700';

export default function HomeroomStudentsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const filteredStudents = useMemo(
    () =>
      homeroomStudents.filter((student) => {
        const normalizedSearch = search.trim().toLowerCase();
        if (
          normalizedSearch
          && !String(student.name || '').toLowerCase().includes(normalizedSearch)
          && !String(student.email || '').toLowerCase().includes(normalizedSearch)
          && !String(student.phone || '').includes(normalizedSearch)
        ) {
          return false;
        }
        if (levelFilter !== 'all' && student.level !== levelFilter) return false;
        if (genderFilter !== 'all' && student.gender !== genderFilter) return false;
        return true;
      }),
    [search, levelFilter, genderFilter],
  );

  const totalMale = homeroomStudents.filter((student) => student.gender === 'Male').length;
  const totalFemale = homeroomStudents.filter((student) => student.gender === 'Female').length;
  const totalIelts = homeroomStudents.filter((student) => student.level === 'IELTS').length;
  const totalAca = homeroomStudents.filter((student) => student.level === 'ACA').length;

  const openProfile = (student) => {
    setSelectedStudent(student);
    setSheetOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <span>Home</span>
        <ChevronRight className="size-3" />
        <span className="text-foreground">Homeroom Students</span>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground">Homeroom 3A</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage and view all students in your homeroom class.
          </p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard
          icon={<Users className="size-4" />}
          iconBg="bg-violet-100 text-violet-600"
          label="Total Students"
          value={homeroomStudents.length}
        />
        <SummaryCard
          icon={<User className="size-4" />}
          iconBg="bg-blue-100 text-blue-600"
          label="Male / Female"
          value={`${totalMale} / ${totalFemale}`}
        />
        <SummaryCard
          icon={<FileText className="size-4" />}
          iconBg="bg-indigo-100 text-indigo-600"
          label="IELTS"
          value={totalIelts}
        />
        <SummaryCard
          icon={<FileText className="size-4" />}
          iconBg="bg-teal-100 text-teal-600"
          label="ACA"
          value={totalAca}
        />
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="IELTS">IELTS</SelectItem>
            <SelectItem value="ACA">ACA</SelectItem>
          </SelectContent>
        </Select>
        <Select value={genderFilter} onValueChange={setGenderFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genders</SelectItem>
            <SelectItem value="Male">Male</SelectItem>
            <SelectItem value="Female">Female</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="size-4" />
        <span>
          {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {filteredStudents.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Users className="mx-auto mb-3 size-10 text-muted-foreground" />
          <p className="text-muted-foreground">No students found</p>
          <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Date of Birth</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Completion</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student, index) => {
                  const percentage = completionFor(student);
                  return (
                    <TableRow
                      key={student.id}
                      className="cursor-pointer hover:bg-muted/20"
                      onClick={() => openProfile(student)}
                    >
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${student.avatarColor}`}
                          >
                            <span className="text-xs font-medium text-white">{getInitials(student.name)}</span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{student.name}</p>
                            <p className="text-xs text-muted-foreground">{student.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{student.gender === 'Male' ? 'Nam' : 'Nu'}</TableCell>
                      <TableCell className="text-sm">{formatDate(student.dateOfBirth)}</TableCell>
                      <TableCell>
                        <LevelBadge level={student.level} />
                      </TableCell>
                      <TableCell className="text-sm">{student.phone}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full ${resolveCompletionBarColor(percentage)}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="w-8 text-xs tabular-nums text-muted-foreground">{percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title="View homework"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/dashboard/homework-progress/${student.id}`);
                            }}
                          >
                            <ExternalLink className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(event) => {
                              event.stopPropagation();
                              openProfile(student);
                            }}
                          >
                            Profile
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {filteredStudents.map((student) => {
              const percentage = completionFor(student);
              return (
                <div
                  key={student.id}
                  className="cursor-pointer rounded-xl border bg-card p-4 transition-colors hover:bg-muted/20"
                  onClick={() => openProfile(student)}
                >
                  <div className="mb-3 flex items-start gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${student.avatarColor}`}
                    >
                      <span className="text-sm font-medium text-white">{getInitials(student.name)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{student.name}</p>
                      <p className="text-xs text-muted-foreground">{student.email}</p>
                    </div>
                    <LevelBadge level={student.level} />
                  </div>
                  <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="size-3" />
                      <span className="truncate">{student.phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="size-3" />
                      <span>{formatDate(student.dateOfBirth)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${resolveCompletionBarColor(percentage)}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{percentage}%</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/dashboard/homework-progress/${student.id}`);
                      }}
                    >
                      Homework
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {selectedStudent ? (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="sr-only">Student Profile</SheetTitle>
              </SheetHeader>
              <StudentProfile
                student={selectedStudent}
                onViewHomework={() => {
                  setSheetOpen(false);
                  navigate(`/dashboard/homework-progress/${selectedStudent.id}`);
                }}
              />
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StudentProfile({ student, onViewHomework }) {
  const completed = student.assignments.filter((assignment) => assignment.status === 'Submitted').length;
  const total = student.assignments.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full ${student.avatarColor}`}
        >
          <span className="text-xl font-semibold text-white">{getInitials(student.name)}</span>
        </div>
        <div>
          <h2 className="text-foreground">{student.name}</h2>
          <div className="mt-1 flex items-center gap-2">
            <LevelBadge level={student.level} />
            <StatusBadge status={student.overallStatus} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Homework Progress</span>
          <span className="text-sm tabular-nums text-muted-foreground">
            {completed}/{total}
          </span>
        </div>
        <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${resolveCompletionBarColor(percentage)}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{percentage}% complete</span>
          <Button size="sm" variant="outline" onClick={onViewHomework}>
            View details
            <ExternalLink className="ml-1 size-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="mb-3 text-sm font-medium text-foreground">Contact Information</h3>
        <InfoRow icon={<Mail className="size-4" />} label="Email" value={student.email} />
        <InfoRow icon={<Phone className="size-4" />} label="Phone" value={student.phone} />
        <InfoRow icon={<MapPin className="size-4" />} label="Address" value={student.address} />
        <InfoRow icon={<Calendar className="size-4" />} label="Date of Birth" value={formatDate(student.dateOfBirth)} />
        <InfoRow icon={<User className="size-4" />} label="Gender" value={student.gender === 'Male' ? 'Nam' : 'Nu'} />
      </div>

      <div className="space-y-1">
        <h3 className="mb-3 text-sm font-medium text-foreground">Parent / Guardian</h3>
        <InfoRow icon={<User className="size-4" />} label="Name" value={student.parentName} />
        <InfoRow icon={<Phone className="size-4" />} label="Phone" value={student.parentPhone} />
      </div>

      <div className="space-y-1">
        <h3 className="mb-3 text-sm font-medium text-foreground">Enrollment</h3>
        <InfoRow icon={<Calendar className="size-4" />} label="Enrolled" value={formatDate(student.enrolledDate)} />
      </div>

      {student.note ? (
        <div className="space-y-1">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-foreground">
            <MessageSquare className="size-4" />
            Notes
          </h3>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground">{student.note}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

function SummaryCard({ icon, iconBg, label, value }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold leading-tight tabular-nums text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

function LevelBadge({ level }) {
  return (
    <Badge className={resolveLevelBadgeClass(level)} variant="secondary">
      {level}
    </Badge>
  );
}

