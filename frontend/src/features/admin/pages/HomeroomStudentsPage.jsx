import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  ChevronDown,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import PaginationControls from '@/shared/components/PaginationControls';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';

const PAGE_SIZE = 20;
const MAX_FETCH_PAGES = 50;

const formatDate = (dateStr) => {
  const date = new Date(String(dateStr || ''));
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

const getAvatarColor = (seed) => {
  const palette = [
    'bg-violet-500',
    'bg-blue-500',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-amber-500',
    'bg-fuchsia-500',
  ];
  const input = String(seed || 'student');
  const hash = Array.from(input).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[hash % palette.length];
};

const normalizeGender = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'male') return 'Male';
  if (normalized === 'female') return 'Female';
  return 'Other';
};

const normalizeLevel = (role) => {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'studentaca') return 'ACA';
  return 'IELTS';
};

const normalizeOverallStatus = (student) => {
  const hasTeacher = Boolean(student?.homeroom_teacher_id);
  return hasTeacher ? 'on_track' : 'needs_attention';
};

const completionFor = () => 0;

const resolveCompletionBarColor = (percentage) => {
  if (percentage === 100) return 'bg-emerald-500';
  if (percentage >= 50) return 'bg-violet-500';
  return 'bg-amber-500';
};

const resolveLevelBadgeClass = (level) =>
  level === 'IELTS' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700';

const toUiStudent = (user) => ({
  id: String(user?._id || ''),
  name: user?.name || 'Unnamed student',
  email: user?.email || '--',
  phone: user?.phone || '--',
  address: user?.address || '--',
  dateOfBirth: user?.dob || user?.dateOfBirth || '',
  gender: normalizeGender(user?.gender),
  level: normalizeLevel(user?.role),
  parentName: user?.parentName || '--',
  parentPhone: user?.parentPhone || '--',
  enrolledDate: user?.createdAt || '',
  note: user?.notes || '',
  avatarColor: getAvatarColor(user?._id || user?.email || user?.name),
  overallStatus: normalizeOverallStatus(user),
  assignments: [],
  homeroom_teacher_id: user?.homeroom_teacher_id ? String(user.homeroom_teacher_id) : null,
});

const normalizeTeacherRoleLabel = (role) => {
  const normalized = String(role || '').toLowerCase();
  if (normalized === 'admin') return 'Admin';
  return 'Teacher';
};

const fetchAllUsersByRole = async (role, limit = 100) => {
  const allUsers = [];
  let page = 1;

  while (page <= MAX_FETCH_PAGES) {
    const response = await api.getUsers({
      role,
      page,
      limit,
      include_total: false,
    });
    const rows = Array.isArray(response?.data) ? response.data : [];
    allUsers.push(...rows);

    const hasNextPage = Boolean(response?.pagination?.hasNextPage);
    if (!hasNextPage || rows.length === 0) break;
    page += 1;
  }

  const dedupMap = new Map();
  allUsers.forEach((user) => {
    const id = String(user?._id || '');
    if (!id) return;
    dedupMap.set(id, user);
  });

  return Array.from(dedupMap.values());
};

export default function HomeroomStudentsPage() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const currentUser = api.getUser();
  const isAdminUser = currentUser?.role === 'admin';

  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [studentScopeTab, setStudentScopeTab] = useState('my-homeroom');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignTeacherId, setAssignTeacherId] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [studentRows, teacherRows, adminRows] = await Promise.all([
        fetchAllUsersByRole('student', 100),
        fetchAllUsersByRole('teacher', 100),
        fetchAllUsersByRole('admin', 100),
      ]);

      setStudents(studentRows.map(toUiStudent));
      setTeachers(
        [...teacherRows, ...adminRows].map((user) => ({
          id: String(user?._id || ''),
          name: user?.name || 'Unknown',
          email: user?.email || '',
          role: user?.role || 'teacher',
        })),
      );
    } catch (error) {
      showNotification(error?.message || 'Không thể tải danh sách học sinh.', 'error');
      setStudents([]);
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, levelFilter, genderFilter, studentScopeTab]);

  const filteredStudents = useMemo(
    () =>
      students.filter((student) => {
        if (studentScopeTab === 'my-homeroom') {
          const currentUserId = String(currentUser?._id || '');
          const studentTeacherId = String(student?.homeroom_teacher_id || '');
          if (!currentUserId || !studentTeacherId || studentTeacherId !== currentUserId) {
            return false;
          }
        }

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
    [students, search, levelFilter, genderFilter, studentScopeTab, currentUser?._id],
  );

  const totalFilteredStudents = filteredStudents.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredStudents / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageOffset = (safeCurrentPage - 1) * PAGE_SIZE;

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  const paginatedStudents = useMemo(
    () => filteredStudents.slice(pageOffset, pageOffset + PAGE_SIZE),
    [filteredStudents, pageOffset],
  );

  const paginationMeta = useMemo(
    () => ({
      page: safeCurrentPage,
      limit: PAGE_SIZE,
      totalItems: totalFilteredStudents,
      totalPages,
      hasPrevPage: safeCurrentPage > 1,
      hasNextPage: safeCurrentPage < totalPages,
    }),
    [safeCurrentPage, totalFilteredStudents, totalPages],
  );

  const unassignedStudents = useMemo(
    () => students.filter((student) => !student.homeroom_teacher_id),
    [students],
  );

  const teacherNameById = useMemo(() => {
    const map = new Map();
    teachers.forEach((teacher) => {
      map.set(teacher.id, teacher.name || '--');
    });
    return map;
  }, [teachers]);

  const totalIelts = students.filter((student) => student.level === 'IELTS').length;
  const totalAca = students.filter((student) => student.level === 'ACA').length;

  const openProfile = (student) => {
    setSelectedStudent(student);
    setSheetOpen(true);
  };

  const openAssignDialog = (student = null) => {
    const firstUnassignedStudentId = unassignedStudents[0]?.id || '';
    const canPrefillStudent = student && !student.homeroom_teacher_id;
    setAssignStudentId(canPrefillStudent ? student.id : firstUnassignedStudentId);
    setAssignTeacherId('');
    setAssignDialogOpen(true);
  };

  const handleAssign = async () => {
    if (!assignStudentId) {
      showNotification('Không còn học sinh chưa gán giáo viên.', 'error');
      return;
    }

    if (!assignTeacherId) {
      showNotification('Vui lòng chọn giáo viên hoặc admin.', 'error');
      return;
    }

    try {
      setAssigning(true);
      await api.setStudentHomeroomTeacher(assignStudentId, assignTeacherId);
      showNotification('Gán giáo viên/chủ nhiệm cho học sinh thành công.', 'success');
      setAssignDialogOpen(false);
      await fetchData();
    } catch (error) {
      showNotification(error?.message || 'Không thể gán học sinh.', 'error');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground">Homeroom Students</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage and view all students in your homeroom class.
          </p>
        </div>
        <Button onClick={() => openAssignDialog()} disabled={!isAdminUser || unassignedStudents.length === 0}>
          Assign học sinh
        </Button>
      </div>

      <div className="mb-4">
        <Tabs value={studentScopeTab} onValueChange={setStudentScopeTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value='my-homeroom'>Học sinh mình chủ nhiệm</TabsTrigger>
            <TabsTrigger value='all-students'>Tất cả học sinh</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={<Users className="size-4" />}
          iconBg="bg-violet-100 text-violet-600"
          label="Total Students"
          value={students.length}
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

      <div className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Accounts</h2>
              <p className="text-sm text-muted-foreground">Manage user access to your homeroom workspace</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <div className="relative min-w-0 sm:w-64">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
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
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Loading students...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto mb-3 size-10 text-muted-foreground" />
            <p className="text-muted-foreground">No students found</p>
            <p className="mt-1 text-sm text-muted-foreground">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-b bg-muted/20 hover:bg-muted/20">
                    <TableHead className="font-semibold text-foreground">User</TableHead>
                    <TableHead className="font-semibold text-foreground">Role</TableHead>
                    <TableHead className="font-semibold text-foreground">Account created</TableHead>
                    <TableHead className="w-14 pr-6 text-right font-semibold text-foreground" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStudents.map((student) => (
                    <TableRow
                      key={student.id}
                      className="cursor-pointer border-b last:border-b-0 hover:bg-muted/20"
                      onClick={() => openProfile(student)}
                    >
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
                            {getInitials(student.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{student.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{student.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-foreground">{student.level} Student</p>
                        <p className="text-xs text-muted-foreground">
                          {student.homeroom_teacher_id
                            ? teacherNameById.get(student.homeroom_teacher_id) || 'Homeroom assigned'
                            : 'No homeroom teacher'}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(student.enrolledDate)}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-muted-foreground"
                          title="Open student details"
                          onClick={(event) => {
                            event.stopPropagation();
                            openProfile(student);
                          }}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-3 p-4 md:hidden sm:p-6">
              {paginatedStudents.map((student) => {
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
                          openAssignDialog(student);
                        }}
                        disabled={!isAdminUser}
                      >
                        Assign
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!loading && filteredStudents.length > 0 ? (
          <PaginationControls
            pagination={paginationMeta}
            onPageChange={setCurrentPage}
            loading={loading}
            itemLabel="students"
            variant="compact-admin"
            className="m-4 mt-0 sm:m-6 sm:mt-0"
          />
        ) : null}
      </div>

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

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign học sinh</DialogTitle>
            <DialogDescription>
              Chỉ hiển thị học sinh chưa gán giáo viên để gán nhanh.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <p className='text-sm font-medium'>Học sinh</p>
              <Select value={assignStudentId} onValueChange={setAssignStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder='Chọn học sinh' />
                </SelectTrigger>
                <SelectContent>
                  {unassignedStudents.length > 0 ? (
                    unassignedStudents.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.name} ({student.email})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__no_unassigned_student__" disabled>
                      Tất cả học sinh đã được gán giáo viên.
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className='text-sm font-medium'>Giáo viên / Admin</p>
              <Select value={assignTeacherId} onValueChange={setAssignTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder='Chọn người phụ trách' />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name} ({String(teacher.role || '').toLowerCase() === 'admin' ? 'Admin' : 'Teacher'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleAssign} disabled={assigning || !isAdminUser || !assignStudentId || !assignTeacherId}>
              {assigning ? 'Đang lưu...' : 'Lưu gán'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        <InfoRow icon={<User className='size-4' />} label='Gender' value={student.gender === 'Male' ? 'Nam' : student.gender === 'Female' ? 'Nữ' : '--'} />
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

