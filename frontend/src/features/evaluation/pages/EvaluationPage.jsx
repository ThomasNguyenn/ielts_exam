import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ListPlus,
  Loader2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { api } from '@/shared/api/client';
import { useNotification } from '@/shared/context/NotificationContext';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const STORAGE_KEY = 'scots_evaluation_state';
const STORAGE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const getTodayISO = () => new Date().toISOString().split('T')[0];

const saveToLocal = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }));
  } catch {
    // ignore
  }
};

const loadFromLocal = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    if (Date.now() - parsed.timestamp > STORAGE_TTL) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

const clearLocal = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

const STATUS_MAP = {
  pending: {
    label: 'Chờ xử lý',
    className: 'border-slate-200 bg-slate-100 text-slate-700',
  },
  processing: {
    label: 'Đang viết...',
    className: 'border-blue-200 bg-blue-50 text-blue-700',
    spin: true,
  },
  completed: {
    label: 'Hoàn tất',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    icon: CheckCircle2,
  },
  error: {
    label: 'Lỗi',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
    icon: AlertCircle,
  },
};

export default function EvaluationPage() {
  const { showNotification } = useNotification();
  const [studentNamesInput, setStudentNamesInput] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [date, setDate] = useState(getTodayISO());
  const [students, setStudents] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [pollingActive, setPollingActive] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const studentsRef = useRef(students);
  studentsRef.current = students;

  useEffect(() => {
    const saved = loadFromLocal();
    if (!saved) return;

    setStudentNamesInput(saved.studentNamesInput || '');
    setTeacherName(saved.teacherName || '');
    setDate(saved.date || getTodayISO());
    setStudents(saved.students || []);
    setRequestId(saved.requestId || null);
    if (saved.requestId && saved.pollingActive) setPollingActive(true);
  }, []);

  useEffect(() => {
    saveToLocal({ studentNamesInput, teacherName, date, students, requestId, pollingActive });
  }, [studentNamesInput, teacherName, date, students, requestId, pollingActive]);

  const handleProcessList = () => {
    const names = studentNamesInput
      .split('\n')
      .map((name) => name.trim())
      .filter(Boolean);

    if (names.length === 0) {
      setStudents([]);
      showNotification('Vui lòng nhập ít nhất một học viên.', 'warning');
      return;
    }

    const nextStudents = names.map((name) => {
      const existing = students.find((item) => item.name === name);
      return {
        name,
        lessonInfo: existing?.lessonInfo || '',
        status: existing?.status || 'pending',
        result: existing?.result || null,
      };
    });

    setStudents(nextStudents);
    showNotification(`Đã xử lý ${nextStudents.length} học viên.`, 'success');
  };

  const handleUpdateLessonInfo = (index, value) => {
    setStudents((prev) => prev.map((student, i) => (
      i === index ? { ...student, lessonInfo: value } : student
    )));
  };

  const handleAutoEvaluate = async () => {
    if (!teacherName || !date || students.length === 0) {
      showNotification('Vui lòng điền giáo viên, ngày học và ít nhất một học viên.', 'warning');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await api.submitEvaluation({
        students: students.map((student) => ({ name: student.name, lessonInfo: student.lessonInfo })),
        teacherName,
        date,
      });

      if (response.success) {
        setRequestId(response.requestId);
        setPollingActive(true);
        showNotification('Đã gửi yêu cầu nhận xét. Hệ thống đang xử lý.', 'info');
      } else {
        showNotification('Không thể bắt đầu nhận xét tự động.', 'error');
      }
    } catch (error) {
      console.error('Error submitting evaluations:', error);
      showNotification('Gửi nhận xét thất bại. Vui lòng thử lại.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const pollStatus = useCallback(async () => {
    if (!requestId || !pollingActive) return;

    try {
      const response = await api.getEvaluationStatus(requestId);
      if (!response.success) return;

      const currentStudents = studentsRef.current;
      const updatedStudents = currentStudents.map((student, index) => {
        const task = response.tasks.find((item) => item.id === index);
        return task ? { ...student, status: task.status, result: task.result } : student;
      });

      setStudents(updatedStudents);
      if (response.completedCount >= response.totalCount) {
        setPollingActive(false);
        showNotification('Đã hoàn tất nhận xét cho toàn bộ học viên.', 'success');
      }
    } catch (error) {
      console.error('Polling error:', error);
      setPollingActive(false);
      showNotification('Mất kết nối cập nhật trạng thái. Vui lòng thử lại.', 'error');
    }
  }, [pollingActive, requestId, showNotification]);

  useEffect(() => {
    if (!pollingActive) return undefined;

    const intervalId = setInterval(pollStatus, 3000);
    return () => clearInterval(intervalId);
  }, [pollStatus, pollingActive]);

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification('Đã sao chép nhận xét.', 'success');
    } catch {
      showNotification('Không thể sao chép. Vui lòng thử lại.', 'error');
    }
  };

  const handleReset = () => {
    clearLocal();
    setStudentNamesInput('');
    setTeacherName('');
    setDate(getTodayISO());
    setStudents([]);
    setRequestId(null);
    setPollingActive(false);
    setIsResetDialogOpen(false);
    showNotification('Đã xóa toàn bộ dữ liệu phiên làm việc.', 'success');
  };

  const completedCount = students.filter((student) => student.status === 'completed').length;
  const progressText = useMemo(() => (
    students.length === 0
      ? 'Chưa có học viên'
      : `${completedCount}/${students.length} học viên hoàn tất`
  ), [completedCount, students.length]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl tracking-tight">Nhận Xét Buổi Học</CardTitle>
          <CardDescription>
            Tạo nhận xét tự động bằng AI cho từng học viên theo nội dung buổi học.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Giáo viên</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="evaluation-teacher-name">Tên giáo viên</Label>
            <Input
              id="evaluation-teacher-name"
              value={teacherName}
              onChange={(event) => setTeacherName(event.target.value)}
              placeholder="Nhập tên giáo viên..."
            />
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Ngày học</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="evaluation-date">Chọn ngày</Label>
            <DatePicker
              id="evaluation-date"
              value={date}
              onChange={setDate}
              buttonClassName="h-10 w-full justify-start"
            />
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>Tiến độ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-semibold tracking-tight text-foreground">
              {completedCount}/{students.length}
            </div>
            <Badge variant="outline" className="w-fit rounded-full">
              {progressText}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-border/70 shadow-sm xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Danh Sách Học Viên</CardTitle>
            <CardDescription>Nhập mỗi tên học viên trên một dòng.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              className="min-h-[180px]"
              placeholder={'Nguyễn Văn A\nTrần Thị B\nLê Văn C'}
              value={studentNamesInput}
              onChange={(event) => setStudentNamesInput(event.target.value)}
            />
            <Button type="button" variant="outline" onClick={handleProcessList}>
              <ListPlus className="h-4 w-4" />
              Xử lý danh sách
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Hành Động</CardTitle>
            <CardDescription>Gửi dữ liệu để AI tạo nhận xét tự động.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              type="button"
              className="w-full"
              disabled={isProcessing || pollingActive || students.length === 0}
              onClick={handleAutoEvaluate}
            >
              {isProcessing || pollingActive ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Tự động nhận xét
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="destructive"
              className="w-full"
              onClick={() => setIsResetDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Xóa toàn bộ
            </Button>

            {pollingActive ? (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                AI đang viết nhận xét. Kết quả sẽ cập nhật tự động.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {students.length > 0 ? (
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Bảng Nhận Xét</CardTitle>
              <CardDescription>
                {students.length} học viên - {completedCount} hoàn tất
              </CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full">
              {pollingActive ? 'Đang cập nhật' : 'Sẵn sàng'}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[170px]">Học viên</TableHead>
                    <TableHead className="w-[260px]">Nội dung bài học</TableHead>
                    <TableHead className="w-[140px]">Trạng thái</TableHead>
                    <TableHead>Nhận xét cuối cùng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student, index) => {
                    const statusInfo = STATUS_MAP[student.status] || STATUS_MAP.pending;
                    const StatusIcon = statusInfo.icon;

                    return (
                      <TableRow key={`${student.name}-${index}`}>
                        <TableCell className="font-medium text-foreground">{student.name}</TableCell>
                        <TableCell>
                          <Textarea
                            className="min-h-[84px]"
                            value={student.lessonInfo}
                            onChange={(event) => handleUpdateLessonInfo(index, event.target.value)}
                            placeholder="Nội dung đã dạy..."
                          />
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn('gap-1.5 rounded-full px-2.5 py-1', statusInfo.className)}
                          >
                            {statusInfo.spin ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            {StatusIcon ? <StatusIcon className="h-3 w-3" /> : null}
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {student.result ? (
                            <div className="relative rounded-md border bg-muted/30 p-3 pr-12">
                              <pre className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/90">
                                {student.result}
                              </pre>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="absolute right-2 top-2 h-7 w-7"
                                onClick={() => handleCopy(student.result)}
                                title="Sao chép"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Chưa có kết quả</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa toàn bộ dữ liệu?</AlertDialogTitle>
            <AlertDialogDescription>
              Hành động này sẽ xóa danh sách học viên, trạng thái và toàn bộ kết quả hiện tại.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleReset}
            >
              Xóa toàn bộ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
