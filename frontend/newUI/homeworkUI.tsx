import {
    BookOpen,
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    CircleUserRound,
    Clock3,
    FileText,
    Filter,
    Headphones,
    HelpCircle,
    Home,
    ListChecks,
    Mic,
    NotebookPen,
    PauseCircle,
    PenSquare,
    PlayCircle,
    RotateCcw,
    Search,
    SkipBack,
    SkipForward,
    Sparkles,
    Trophy,
    Video,
    Volume2,
    Waves,
    Captions,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Drawer,
    DrawerContent,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AssignmentStatus = "Chưa làm" | "Đang làm" | "Đã nộp" | "Quá hạn";
type Assignment = {
    id: number;
    title: string;
    type: string;
    dueTime: string;
    duration: string;
    questions: number;
    status: AssignmentStatus;
    teacher: string;
    progress: number;
};

type TestType = "Reading" | "Listening" | "Writing" | "Speaking";
type IeltsTest = {
    id: number;
    title: string;
    type: TestType;
    part: string;
    duration: string;
    questions: number;
    level: "Academic" | "General";
    status: string;
};

const assignments: Assignment[] = [
    {
        id: 1,
        title: "Reading Test 12 - Matching Headings",
        type: "Reading",
        dueTime: "Hôm nay • 20:00",
        duration: "35 phút",
        questions: 14,
        status: "Chưa làm",
        teacher: "Ms. Lan",
        progress: 0,
    },
    {
        id: 2,
        title: "Reading Passage 3 - True/False/Not Given",
        type: "Reading",
        dueTime: "Hôm nay • 22:00",
        duration: "25 phút",
        questions: 13,
        status: "Đang làm",
        teacher: "Mr. Minh",
        progress: 62,
    },
    {
        id: 3,
        title: "Vocabulary Booster - Environment",
        type: "Từ vựng",
        dueTime: "Ngày mai • 18:00",
        duration: "15 phút",
        questions: 20,
        status: "Đã nộp",
        teacher: "Ms. Hoa",
        progress: 100,
    },
    {
        id: 4,
        title: "Reading Mini Test - Multiple Choice",
        type: "Reading",
        dueTime: "Ngày mai • 21:00",
        duration: "30 phút",
        questions: 10,
        status: "Quá hạn",
        teacher: "Mr. An",
        progress: 10,
    },
];

const ieltsTests: IeltsTest[] = [
    {
        id: 1,
        title: "Cambridge IELTS 18 - Test 1",
        type: "Reading",
        part: "Part 1",
        duration: "60 phút",
        questions: 40,
        level: "Academic",
        status: "Mới",
    },
    {
        id: 2,
        title: "Cambridge IELTS 17 - Test 3",
        type: "Listening",
        part: "Part 2",
        duration: "30 phút",
        questions: 10,
        level: "General",
        status: "Phổ biến",
    },
    {
        id: 3,
        title: "IELTS Writing Task Bank - Opinion Essay",
        type: "Writing",
        part: "Part 2",
        duration: "40 phút",
        questions: 1,
        level: "Academic",
        status: "Đề mới",
    },
    {
        id: 4,
        title: "Speaking Mock Test - Hometown & Work",
        type: "Speaking",
        part: "Part 1",
        duration: "15 phút",
        questions: 12,
        level: "General",
        status: "Luyện nhanh",
    },
    {
        id: 5,
        title: "Cambridge IELTS 16 - Passage Review",
        type: "Reading",
        part: "Part 3",
        duration: "20 phút",
        questions: 14,
        level: "Academic",
        status: "Đang hot",
    },
    {
        id: 6,
        title: "Listening Section Drill - Map Labeling",
        type: "Listening",
        part: "Part 4",
        duration: "12 phút",
        questions: 10,
        level: "Academic",
        status: "Đề mới",
    },
];

const statusMap: Record<AssignmentStatus, "secondary" | "default" | "outline" | "destructive"> = {
    "Chưa làm": "secondary",
    "Đang làm": "default",
    "Đã nộp": "outline",
    "Quá hạn": "destructive",
};

const actionLabel: Record<AssignmentStatus, string> = {
    "Chưa làm": "Bắt đầu",
    "Đang làm": "Tiếp tục",
    "Đã nộp": "Xem kết quả",
    "Quá hạn": "Xem chi tiết",
};

const typeFilters = ["Tất cả", "Reading", "Listening", "Writing", "Speaking"];
const partFilters = ["Tất cả part", "Part 1", "Part 2", "Part 3", "Part 4"];
const levelFilters = ["Tất cả level", "Academic", "General"];

function DailyAssignmentsList() {
    return (
        <div className="space-y-4">
            <header className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm text-muted-foreground">Xin chào, Ducc</p>
                        <h1 className="text-2xl font-bold tracking-tight">Bài tập hằng ngày</h1>
                    </div>
                    <Button variant="outline" className="rounded-2xl">
                        <CalendarDays className="mr-2 h-4 w-4" />
                        Lịch học
                    </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                        { label: "Hôm nay", value: "4", note: "bài cần xử lý" },
                        { label: "Đang làm", value: "1", note: "bài chưa hoàn tất" },
                        { label: "Đã nộp", value: "1", note: "trong hôm nay" },
                        { label: "Điểm danh", value: "95%", note: "tuần này" },
                    ].map((item) => (
                        <Card key={item.label} className="rounded-3xl shadow-sm">
                            <CardContent className="p-4">
                                <p className="text-xs text-muted-foreground">{item.label}</p>
                                <p className="mt-1 text-2xl font-bold">{item.value}</p>
                                <p className="text-xs text-muted-foreground">{item.note}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </header>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <Tabs defaultValue="all" className="w-full md:w-auto">
                    <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-2xl bg-transparent p-0 md:w-auto">
                        <TabsTrigger value="all" className="rounded-full px-4 py-2">
                            Tất cả
                        </TabsTrigger>
                        <TabsTrigger value="reading" className="rounded-full px-4 py-2">
                            Reading
                        </TabsTrigger>
                        <TabsTrigger value="todo" className="rounded-full px-4 py-2">
                            Chưa làm
                        </TabsTrigger>
                        <TabsTrigger value="progress" className="rounded-full px-4 py-2">
                            Đang làm
                        </TabsTrigger>
                        <TabsTrigger value="done" className="rounded-full px-4 py-2">
                            Đã nộp
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <Card className="rounded-2xl shadow-sm md:min-w-[280px]">
                    <CardContent className="p-4">
                        <p className="text-xs font-medium text-muted-foreground">Nhắc nhở gần nhất</p>
                        <p className="mt-1 text-sm font-semibold">1 bài Reading sẽ hết hạn sau 2 giờ nữa</p>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-3">
                {assignments.map((item) => (
                    <Card key={item.id} className="rounded-3xl border shadow-sm">
                        <CardContent className="p-4">
                            <div className="min-w-0 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                                        {item.type}
                                    </Badge>
                                    <Badge variant={statusMap[item.status]} className="rounded-full px-3 py-1">
                                        {item.status}
                                    </Badge>
                                </div>

                                <div>
                                    <h2 className="line-clamp-2 text-base font-bold leading-6 md:text-lg">{item.title}</h2>
                                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                                        <p className="flex items-center gap-1.5">
                                            <Clock3 className="h-4 w-4" /> {item.dueTime}
                                        </p>
                                        <p className="flex items-center gap-1.5">
                                            <PlayCircle className="h-4 w-4" /> {item.duration}
                                        </p>
                                        <p className="flex items-center gap-1.5">
                                            <FileText className="h-4 w-4" /> {item.questions} câu
                                        </p>
                                        <p className="flex items-center gap-1.5">
                                            <CircleUserRound className="h-4 w-4" /> {item.teacher}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium text-muted-foreground">Tiến độ</span>
                                        <span className="font-semibold">{item.progress}%</span>
                                    </div>
                                    <Progress value={item.progress} className="h-2" />
                                </div>

                                <div className="flex items-center gap-3">
                                    <Button className="h-11 flex-1 rounded-2xl">{actionLabel[item.status]}</Button>
                                    <Button variant="outline" className="h-11 rounded-2xl">
                                        Chi tiết
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

function StartAssignmentPreview() {
    const questions = ["Questions 1–5", "Questions 6–9", "Questions 10–14"];

    return (
        <div className="space-y-4">
            <header className="flex items-center justify-between gap-3 rounded-3xl border bg-background/95 p-3 shadow-sm backdrop-blur">
                <Button variant="ghost" size="icon" className="rounded-2xl">
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0 flex-1 text-center">
                    <p className="truncate text-sm font-semibold">Reading Test 12</p>
                    <p className="text-xs text-muted-foreground">Matching Headings</p>
                </div>
                <Badge className="rounded-full px-3 py-1">35:00</Badge>
            </header>

            <Card className="rounded-3xl border shadow-sm">
                <CardHeader className="space-y-3 pb-3">
                    <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">
                        Reading
                    </Badge>
                    <div>
                        <CardTitle className="text-xl">Bắt đầu bài làm</CardTitle>
                        <CardDescription className="mt-1 leading-6">
                            Hãy đọc kỹ hướng dẫn trước khi bắt đầu. Khi bấm “Bắt đầu ngay”, hệ thống sẽ ghi nhận trạng thái started và bắt đầu đếm giờ.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <Card className="rounded-2xl bg-muted/40 shadow-none">
                            <CardContent className="flex items-center gap-3 p-4">
                                <Clock3 className="h-5 w-5" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Thời gian</p>
                                    <p className="font-semibold">35 phút</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl bg-muted/40 shadow-none">
                            <CardContent className="flex items-center gap-3 p-4">
                                <ListChecks className="h-5 w-5" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Số câu</p>
                                    <p className="font-semibold">14 câu</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="rounded-2xl bg-muted/40 shadow-none">
                        <CardContent className="p-4">
                            <p className="mb-3 text-sm font-semibold">Cấu trúc bài</p>
                            <div className="flex flex-wrap gap-2">
                                {questions.map((item) => (
                                    <Badge key={item} variant="outline" className="rounded-full px-3 py-1">
                                        {item}
                                    </Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-dashed shadow-none">
                        <CardContent className="space-y-3 p-4 text-sm text-muted-foreground">
                            <p className="font-medium text-foreground">Lưu ý trước khi làm</p>
                            <ul className="space-y-2">
                                <li>• Không thoát màn hình trong lúc làm để tránh gián đoạn.</li>
                                <li>• Hệ thống tự lưu đáp án mỗi vài giây.</li>
                                <li>• Bạn có thể tiếp tục nếu lỡ refresh hoặc mất kết nối ngắn.</li>
                            </ul>
                        </CardContent>
                    </Card>

                    <div className="space-y-3">
                        <Button className="h-12 w-full rounded-2xl text-base font-semibold">
                            <PlayCircle className="mr-2 h-5 w-5" />
                            Bắt đầu ngay
                        </Button>
                        <Button variant="outline" className="h-11 w-full rounded-2xl">
                            Xem hướng dẫn chi tiết
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="rounded-3xl border shadow-sm">
                <CardContent className="flex items-center justify-between p-4">
                    <div>
                        <p className="text-sm font-semibold">Mục tiêu hôm nay</p>
                        <p className="text-sm text-muted-foreground">Hoàn thành 2 bài Reading trước 22:00</p>
                    </div>
                    <Trophy className="h-5 w-5 text-muted-foreground" />
                </CardContent>
            </Card>
        </div>
    );
}

function DictationPreview() {
    return (
        <div className="space-y-4">
            <header className="flex items-center justify-between gap-3 rounded-3xl border bg-background/95 p-3 shadow-sm backdrop-blur">
                <Button variant="ghost" size="icon" className="rounded-2xl">
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0 flex-1 text-center">
                    <p className="truncate text-sm font-semibold">Dictation Practice 05</p>
                    <p className="text-xs text-muted-foreground">Travel & Airport Announcements</p>
                </div>
                <Badge className="rounded-full px-3 py-1">12:40</Badge>
            </header>

            <Card className="rounded-3xl border shadow-sm">
                <CardHeader className="space-y-3 pb-3">
                    <div className="flex items-center justify-between gap-3">
                        <Badge variant="secondary" className="rounded-full px-3 py-1">
                            Dictation
                        </Badge>
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                            Lượt nghe 2/3
                        </Badge>
                    </div>
                    <div>
                        <CardTitle className="text-xl">Nghe và điền lại nội dung</CardTitle>
                        <CardDescription className="mt-1 leading-6">
                            Nghe audio, sau đó nhập lại đúng câu bạn nghe được. Hệ thống sẽ tự lưu theo từng đoạn để học sinh có thể tiếp tục nếu bị gián đoạn.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Card className="rounded-2xl bg-muted/40 shadow-none">
                        <CardContent className="space-y-4 p-4">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Volume2 className="h-4 w-4" />
                                    <span>Tốc độ phát: 0.9x</span>
                                </div>
                                <span className="font-medium text-foreground">00:48 / 01:30</span>
                            </div>

                            <Progress value={53} className="h-2" />

                            <div className="grid grid-cols-5 gap-2">
                                <Button variant="outline" size="icon" className="h-11 w-full rounded-2xl">
                                    <SkipBack className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-11 w-full rounded-2xl">
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                                <Button className="h-11 w-full rounded-2xl" size="icon">
                                    <PauseCircle className="h-5 w-5" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-11 w-full rounded-2xl">
                                    <SkipForward className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-11 w-full rounded-2xl">
                                    <Volume2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 gap-3">
                        <Card className="rounded-2xl bg-muted/40 shadow-none">
                            <CardContent className="flex items-center gap-3 p-4">
                                <Waves className="h-5 w-5" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Đoạn hiện tại</p>
                                    <p className="font-semibold">Sentence 3 / 6</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl bg-muted/40 shadow-none">
                            <CardContent className="flex items-center gap-3 p-4">
                                <Clock3 className="h-5 w-5" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Thời gian còn lại</p>
                                    <p className="font-semibold">12 phút</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="rounded-2xl border-dashed shadow-none">
                        <CardContent className="p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold">Transcript của bạn</p>
                                    <p className="text-xs text-muted-foreground">Autosave 5 giây trước</p>
                                </div>
                                <Badge variant="outline" className="rounded-full px-3 py-1">
                                    Đã lưu
                                </Badge>
                            </div>

                            <div className="min-h-[180px] rounded-2xl border bg-background p-4 text-sm leading-7 text-foreground">
                                Passengers travelling to Singapore are advised to proceed to gate number twelve immediately. Final boarding will begin in approximately ten minutes.
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl bg-muted/40 shadow-none">
                        <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
                            <p className="font-medium text-foreground">Gợi ý thao tác</p>
                            <ul className="space-y-2">
                                <li>• Dùng tua lại 5 giây nếu cần nghe lại cụm khó.</li>
                                <li>• Sau mỗi đoạn, hệ thống tự lưu để tránh mất dữ liệu.</li>
                                <li>• Bạn có thể nộp từng phần hoặc hoàn tất toàn bộ bài.</li>
                            </ul>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="h-11 rounded-2xl">
                            Lưu nháp
                        </Button>
                        <Button className="h-11 rounded-2xl">Nộp đoạn này</Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function QuizPreview() {
    const options = [
        {
            key: "A",
            label: "The writer believes online learning is always more effective than classroom learning.",
            selected: false,
        },
        {
            key: "B",
            label: "The writer suggests online learning can be effective when paired with strong self-discipline.",
            selected: true,
        },
        {
            key: "C",
            label: "The writer thinks students should avoid digital tools during exam preparation.",
            selected: false,
        },
        {
            key: "D",
            label: "The writer argues teachers are no longer necessary in modern education.",
            selected: false,
        },
    ];

    return (
        <div className="space-y-4">
            <header className="flex items-center justify-between gap-3 rounded-3xl border bg-background/95 p-3 shadow-sm backdrop-blur">
                <Button variant="ghost" size="icon" className="rounded-2xl">
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0 flex-1 text-center">
                    <p className="truncate text-sm font-semibold">Quiz Practice 03</p>
                    <p className="text-xs text-muted-foreground">Education & Technology</p>
                </div>
                <Badge className="rounded-full px-3 py-1">09:25</Badge>
            </header>

            <Card className="rounded-3xl border shadow-sm">
                <CardHeader className="space-y-3 pb-3">
                    <div className="flex items-center justify-between gap-3">
                        <Badge variant="secondary" className="rounded-full px-3 py-1">
                            Quiz
                        </Badge>
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                            Câu 3 / 8
                        </Badge>
                    </div>
                    <div>
                        <CardTitle className="text-xl">Chọn đáp án đúng nhất</CardTitle>
                        <CardDescription className="mt-1 leading-6">
                            Đọc câu hỏi và chọn một đáp án phù hợp nhất. Hệ thống sẽ tự lưu lựa chọn của học sinh ngay khi bấm chọn.
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <Card className="rounded-2xl bg-muted/40 shadow-none">
                            <CardContent className="flex items-center gap-3 p-4">
                                <Clock3 className="h-5 w-5" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Thời gian còn lại</p>
                                    <p className="font-semibold">9 phút 25 giây</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl bg-muted/40 shadow-none">
                            <CardContent className="flex items-center gap-3 p-4">
                                <HelpCircle className="h-5 w-5" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Đã trả lời</p>
                                    <p className="font-semibold">2 / 8 câu</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-muted-foreground">Tiến độ làm bài</span>
                            <span className="font-semibold">25%</span>
                        </div>
                        <Progress value={25} className="h-2" />
                    </div>

                    <Card className="rounded-2xl border-dashed shadow-none">
                        <CardContent className="space-y-3 p-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <FileText className="h-4 w-4" />
                                <span>Question 3</span>
                            </div>
                            <p className="text-base font-semibold leading-7 text-foreground">
                                According to the passage, what is the main condition for online learning to be successful?
                            </p>
                        </CardContent>
                    </Card>

                    <div className="space-y-3">
                        {options.map((option) => (
                            <button
                                key={option.key}
                                className={`w-full rounded-2xl border p-4 text-left transition ${option.selected ? "border-primary bg-primary/5 shadow-sm" : "bg-background hover:bg-muted/40"
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${option.selected
                                            ? "border-primary bg-primary text-primary-foreground"
                                            : "border-border bg-background text-foreground"
                                            }`}
                                    >
                                        {option.selected ? <CheckCircle2 className="h-4 w-4" /> : option.key}
                                    </div>
                                    <p className="text-sm leading-6 text-foreground">{option.label}</p>
                                </div>
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="h-11 rounded-2xl">
                            Đánh dấu xem lại
                        </Button>
                        <Button className="h-11 rounded-2xl">
                            Câu tiếp theo
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>

                    <Button variant="secondary" className="h-11 w-full rounded-2xl">
                        Nộp bài Quiz
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

function QuizPassageDrawerPreview() {
    const options = [
        {
            key: "A",
            label: "Because students need strong self-discipline and consistent routines.",
            selected: true,
        },
        {
            key: "B",
            label: "Because digital platforms completely replace teachers in all cases.",
            selected: false,
        },
        {
            key: "C",
            label: "Because classroom interaction is no longer useful in modern education.",
            selected: false,
        },
        {
            key: "D",
            label: "Because exam preparation should focus only on independent study.",
            selected: false,
        },
    ];

    const palette = [1, 2, 3, 4, 5, 6, 7, 8];

    return (
        <div className="space-y-4 pb-24">
            <header className="sticky top-0 z-20 flex items-center justify-between gap-3 rounded-3xl border bg-background/95 p-3 shadow-sm backdrop-blur">
                <Button variant="ghost" size="icon" className="rounded-2xl">
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0 flex-1 text-center">
                    <p className="truncate text-sm font-semibold">Reading Quiz With Passage</p>
                    <p className="text-xs text-muted-foreground">Education & Technology</p>
                </div>
                <Badge className="rounded-full px-3 py-1">11:10</Badge>
            </header>

            <Card className="rounded-3xl border shadow-sm">
                <CardHeader className="space-y-3 pb-3">
                    <div className="flex items-center justify-between gap-3">
                        <Badge variant="secondary" className="rounded-full px-3 py-1">
                            Quiz + Passage
                        </Badge>
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                            Câu 3 / 8
                        </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <Card className="rounded-2xl bg-muted/40 shadow-none">
                            <CardContent className="flex items-center gap-3 p-4">
                                <Clock3 className="h-5 w-5" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Thời gian còn lại</p>
                                    <p className="font-semibold">11 phút 10 giây</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl bg-muted/40 shadow-none">
                            <CardContent className="flex items-center gap-3 p-4">
                                <HelpCircle className="h-5 w-5" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Đã trả lời</p>
                                    <p className="font-semibold">2 / 8 câu</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-muted-foreground">Tiến độ</span>
                            <span className="font-semibold">25%</span>
                        </div>
                        <Progress value={25} className="h-2" />
                    </div>
                </CardHeader>
            </Card>

            <Card className="rounded-3xl border shadow-sm">
                <CardContent className="space-y-4 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold">Passage</p>
                            <p className="text-xs text-muted-foreground">Đọc đoạn văn rồi mở drawer để trả lời câu hỏi</p>
                        </div>
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                            Autosave bật
                        </Badge>
                    </div>

                    <div className="rounded-2xl border bg-background p-4 text-sm leading-7 text-foreground">
                        <p>
                            Online learning has transformed the way students prepare for exams, offering flexibility and access to a wide range of resources. However, educational researchers note that flexibility alone does not guarantee success. Learners who manage their time carefully, follow structured study plans, and review feedback consistently tend to perform better than those who rely only on convenience.
                        </p>
                        <p className="mt-4">
                            In many cases, digital tools are most effective when combined with clear goals and teacher guidance. Students may benefit from recorded lessons, practice quizzes, and progress tracking, but these advantages become meaningful only when learners are able to stay disciplined and engage actively with the material.
                        </p>
                        <p className="mt-4 text-muted-foreground">
                            Tip: Trên điện thoại, passage nên chiếm phần lớn màn hình để học sinh tập trung đọc. Câu hỏi sẽ được mở ở drawer phía dưới.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="fixed bottom-20 left-0 right-0 z-30 px-4 sm:bottom-24 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-md sm:max-w-2xl lg:max-w-5xl">
                    <Drawer>
                        <DrawerTrigger asChild>
                            <Button className="h-14 w-full rounded-2xl text-base font-semibold shadow-lg">
                                Mở câu hỏi
                                <Badge variant="secondary" className="ml-2 rounded-full px-2.5 py-1 text-xs">
                                    Câu 3/8
                                </Badge>
                            </Button>
                        </DrawerTrigger>
                        <DrawerContent className="mx-auto max-w-md rounded-t-3xl sm:max-w-2xl">
                            <DrawerHeader className="text-left">
                                <DrawerTitle>Question 3</DrawerTitle>
                                <p className="text-sm text-muted-foreground">
                                    According to the passage, what is the main condition for online learning to be successful?
                                </p>
                            </DrawerHeader>

                            <div className="max-h-[65vh] space-y-4 overflow-y-auto px-4 pb-2">
                                <div className="space-y-3">
                                    {options.map((option) => (
                                        <button
                                            key={option.key}
                                            className={`w-full rounded-2xl border p-4 text-left transition ${option.selected ? "border-primary bg-primary/5 shadow-sm" : "bg-background hover:bg-muted/40"
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${option.selected
                                                        ? "border-primary bg-primary text-primary-foreground"
                                                        : "border-border bg-background text-foreground"
                                                        }`}
                                                >
                                                    {option.selected ? <CheckCircle2 className="h-4 w-4" /> : option.key}
                                                </div>
                                                <p className="text-sm leading-6 text-foreground">{option.label}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                <Card className="rounded-2xl bg-muted/40 shadow-none">
                                    <CardContent className="p-4">
                                        <div className="mb-3 flex items-center justify-between">
                                            <p className="text-sm font-semibold">Bảng câu hỏi</p>
                                            <Badge variant="outline" className="rounded-full px-3 py-1">
                                                Đã lưu
                                            </Badge>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                            {palette.map((item) => {
                                                const isCurrent = item === 3;
                                                const isDone = item < 3;
                                                return (
                                                    <Button
                                                        key={item}
                                                        variant={isCurrent ? "default" : "outline"}
                                                        className={`h-11 rounded-2xl ${isDone ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50" : ""
                                                            }`}
                                                    >
                                                        {item}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            <DrawerFooter className="grid grid-cols-2 gap-3">
                                <Button variant="outline" className="rounded-2xl">
                                    Đánh dấu xem lại
                                </Button>
                                <Button className="rounded-2xl">
                                    Câu tiếp theo
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            </DrawerFooter>
                        </DrawerContent>
                    </Drawer>
                </div>
            </div>
        </div>
    );
}

function VideoSummaryPreview() {
    const keyMoments = [
        {
            time: "00:45",
            title: "Ý chính của video",
            note: "Giảng viên giới thiệu chiến lược nghe để nắm từ khóa trước khi ghi chú.",
        },
        {
            time: "02:10",
            title: "Ví dụ minh họa",
            note: "Phân tích một đoạn hội thoại ngắn và cách nhận diện main idea.",
        },
        {
            time: "04:25",
            title: "Kết luận nhanh",
            note: "Nhấn mạnh việc nghe theo cụm ý thay vì cố chép từng từ.",
        },
    ];

    return (
        <div className="space-y-4 pb-6">
            <header className="flex items-center justify-between gap-3 rounded-3xl border bg-background/95 p-3 shadow-sm backdrop-blur">
                <Button variant="ghost" size="icon" className="rounded-2xl">
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="min-w-0 flex-1 text-center">
                    <p className="truncate text-sm font-semibold">Video Lesson 07</p>
                    <p className="text-xs text-muted-foreground">Listening Strategy - Main Ideas</p>
                </div>
                <Badge className="rounded-full px-3 py-1">08:20</Badge>
            </header>

            <Card className="overflow-hidden rounded-3xl border shadow-sm">
                <div className="relative aspect-video bg-slate-900">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
                        <Badge variant="secondary" className="rounded-full px-3 py-1">
                            Video
                        </Badge>
                        <Badge variant="outline" className="rounded-full border-white/20 bg-white/10 px-3 py-1 text-white">
                            720p
                        </Badge>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Button size="icon" className="h-14 w-14 rounded-full shadow-xl">
                            <PlayCircle className="h-7 w-7" />
                        </Button>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                        <div className="mb-3 flex items-center justify-between text-xs">
                            <span>03:12</span>
                            <span>08:20</span>
                        </div>
                        <Progress value={38} className="h-2 bg-white/20" />
                    </div>
                </div>

                <CardContent className="space-y-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold">Watch & Summarize</h2>
                            <p className="text-sm text-muted-foreground">
                                Học sinh xem video, hệ thống hỗ trợ transcript, tóm tắt ngắn và đánh dấu các mốc quan trọng.
                            </p>
                        </div>
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                            Đang xem
                        </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <Card className="rounded-2xl bg-muted/40 shadow-none">
                            <CardContent className="flex items-center gap-3 p-4">
                                <Video className="h-5 w-5" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Thời lượng</p>
                                    <p className="font-semibold">8 phút 20 giây</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="rounded-2xl bg-muted/40 shadow-none">
                            <CardContent className="flex items-center gap-3 p-4">
                                <Captions className="h-5 w-5" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Transcript</p>
                                    <p className="font-semibold">Đã bật</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="rounded-2xl border-dashed shadow-none">
                        <CardContent className="space-y-3 p-4">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                                <Sparkles className="h-4 w-4" />
                                Tóm tắt ngắn
                            </div>
                            <p className="text-sm leading-7 text-muted-foreground">
                                Video này hướng dẫn học sinh cách xác định ý chính khi nghe tiếng Anh học thuật. Trọng tâm là nghe theo cụm ý, phát hiện từ khóa lặp lại và ghi chú nhanh thay vì cố chép nguyên văn.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl bg-muted/40 shadow-none">
                        <CardContent className="p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <p className="text-sm font-semibold">Mốc nội dung nổi bật</p>
                                <Badge variant="outline" className="rounded-full px-3 py-1">
                                    3 highlights
                                </Badge>
                            </div>
                            <div className="space-y-3">
                                {keyMoments.map((item) => (
                                    <button
                                        key={item.time}
                                        className="w-full rounded-2xl border bg-background p-4 text-left transition hover:bg-muted/40"
                                    >
                                        <div className="mb-1 flex items-center justify-between gap-3">
                                            <span className="text-sm font-semibold">{item.title}</span>
                                            <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs">
                                                {item.time}
                                            </Badge>
                                        </div>
                                        <p className="text-sm leading-6 text-muted-foreground">{item.note}</p>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl shadow-none">
                        <CardContent className="space-y-3 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold">Ghi chú của học sinh</p>
                                    <p className="text-xs text-muted-foreground">Autosave 10 giây trước</p>
                                </div>
                                <Badge variant="outline" className="rounded-full px-3 py-1">
                                    Đã lưu
                                </Badge>
                            </div>
                            <div className="min-h-[140px] rounded-2xl border bg-background p-4 text-sm leading-7 text-foreground">
                                Main idea thường xuất hiện ở phần mở đầu và được nhắc lại bằng từ đồng nghĩa. Khi nghe nên chú ý các từ chuyển ý như however, therefore, in conclusion.
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 gap-3">
                        <Button variant="outline" className="h-11 rounded-2xl">
                            <NotebookPen className="mr-2 h-4 w-4" />
                            Mở ghi chú
                        </Button>
                        <Button className="h-11 rounded-2xl">
                            <Sparkles className="mr-2 h-4 w-4" />
                            Tóm tắt lại
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function IeltsTestsCatalogPreview() {
    const typeIcons: Record<TestType, typeof BookOpen> = {
        Reading: BookOpen,
        Listening: Headphones,
        Writing: PenSquare,
        Speaking: Mic,
    };

    const typeBadgeClass: Record<TestType, string> = {
        Reading: "bg-blue-50 text-blue-700 border-blue-200",
        Listening: "bg-emerald-50 text-emerald-700 border-emerald-200",
        Writing: "bg-violet-50 text-violet-700 border-violet-200",
        Speaking: "bg-amber-50 text-amber-700 border-amber-200",
    };

    return (
        <div className="space-y-4 pb-6">
            <header className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-sm text-muted-foreground">Kho đề luyện tập</p>
                        <h1 className="text-2xl font-bold tracking-tight">IELTS Tests</h1>
                    </div>
                    <Button variant="outline" className="rounded-2xl lg:hidden">
                        <Filter className="mr-2 h-4 w-4" />
                        Bộ lọc
                    </Button>
                </div>
            </header>

            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start xl:grid-cols-[320px_minmax(0,1fr)]">
                <aside className="hidden lg:sticky lg:top-4 lg:block">
                    <Card className="rounded-3xl shadow-sm">
                        <CardContent className="space-y-5 p-5">
                            <div>
                                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                                    <Filter className="h-4 w-4" />
                                    Bộ lọc
                                </div>
                                <div className="flex items-center gap-2 rounded-2xl border bg-background px-3 py-2.5 text-sm text-muted-foreground">
                                    <Search className="h-4 w-4" />
                                    <span>Tìm theo tên test, bộ Cambridge...</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-sm font-semibold">Dạng bài</p>
                                <div className="space-y-2">
                                    {typeFilters.map((item, index) => (
                                        <Button
                                            key={item}
                                            variant={index === 0 ? "default" : "ghost"}
                                            className="h-11 w-full justify-start rounded-2xl"
                                        >
                                            {item}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-sm font-semibold">Part</p>
                                <div className="space-y-2">
                                    {partFilters.map((item, index) => (
                                        <Button
                                            key={item}
                                            variant={index === 0 ? "secondary" : "ghost"}
                                            className="h-11 w-full justify-start rounded-2xl"
                                        >
                                            {item}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-sm font-semibold">Level</p>
                                <div className="space-y-2">
                                    {levelFilters.map((item, index) => (
                                        <Button
                                            key={item}
                                            variant={index === 0 ? "outline" : "ghost"}
                                            className="h-11 w-full justify-start rounded-2xl"
                                        >
                                            {item}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </aside>

                <div className="space-y-4">
                    <Card className="rounded-3xl shadow-sm lg:hidden">
                        <CardContent className="space-y-3 p-4">
                            <div className="flex items-center gap-2 rounded-2xl border bg-background px-3 py-2.5 text-sm text-muted-foreground">
                                <Search className="h-4 w-4" />
                                <span>Tìm theo tên test, bộ Cambridge, chủ đề...</span>
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Filter theo dạng</p>
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {typeFilters.map((item, index) => (
                                        <Button key={item} variant={index === 0 ? "default" : "outline"} className="rounded-full">
                                            {item}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Filter theo part</p>
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                    {partFilters.map((item, index) => (
                                        <Button key={item} variant={index === 0 ? "secondary" : "outline"} className="rounded-full">
                                            {item}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-4 py-3 text-sm">
                        <p className="text-muted-foreground">Hiển thị 24 đề phù hợp với bộ lọc hiện tại</p>
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                            Academic
                        </Badge>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                        {ieltsTests.map((test) => {
                            const Icon = typeIcons[test.type];
                            const badgeClass = typeBadgeClass[test.type];

                            return (
                                <Card key={test.id} className="rounded-3xl border shadow-sm transition hover:shadow-md">
                                    <CardContent className="space-y-4 p-4">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span
                                                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${badgeClass}`}
                                                    >
                                                        <Icon className="h-3.5 w-3.5" />
                                                        {test.type}
                                                    </span>
                                                    <Badge variant="outline" className="rounded-full px-3 py-1">
                                                        {test.part}
                                                    </Badge>
                                                </div>
                                                <h2 className="line-clamp-2 text-base font-bold leading-6 md:text-lg">{test.title}</h2>
                                            </div>
                                            <Badge variant="secondary" className="rounded-full px-3 py-1">
                                                {test.status}
                                            </Badge>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                                            <p className="flex items-center gap-1.5">
                                                <Clock3 className="h-4 w-4" /> {test.duration}
                                            </p>
                                            <p className="flex items-center gap-1.5">
                                                <FileText className="h-4 w-4" /> {test.questions} câu
                                            </p>
                                            <div className="col-span-2">
                                                <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[11px]">
                                                    {test.level}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Button className="h-11 flex-1 rounded-2xl">Làm test</Button>
                                            <Button variant="outline" className="h-11 rounded-2xl">
                                                Chi tiết
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

function BottomNav() {
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t bg-background/95 backdrop-blur">
            <div className="mx-auto grid max-w-md grid-cols-4 px-4 py-3 text-center text-xs text-muted-foreground sm:max-w-2xl lg:max-w-5xl">
                <button className="flex flex-col items-center gap-1">
                    <Home className="h-4 w-4" />
                    <span>Trang chủ</span>
                </button>
                <button className="flex flex-col items-center gap-1 font-semibold text-foreground">
                    <BookOpen className="h-4 w-4" />
                    <span>Bài tập</span>
                </button>
                <button className="flex flex-col items-center gap-1">
                    <Search className="h-4 w-4" />
                    <span>Khám phá</span>
                </button>
                <button className="flex flex-col items-center gap-1">
                    <CircleUserRound className="h-4 w-4" />
                    <span>Tài khoản</span>
                </button>
            </div>
        </nav>
    );
}

export default function DailyStudentAssignmentsPage() {
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-24 pt-4 sm:max-w-2xl sm:px-6 lg:max-w-5xl lg:px-8">
                <Tabs defaultValue="list" className="w-full">
                    <TabsList className="mb-4 grid h-auto w-full grid-cols-2 gap-1 rounded-2xl bg-white p-1 shadow-sm sm:grid-cols-3 xl:grid-cols-7">
                        <TabsTrigger value="list" className="rounded-xl">Danh sách bài tập</TabsTrigger>
                        <TabsTrigger value="start" className="rounded-xl">Khi bắt đầu làm</TabsTrigger>
                        <TabsTrigger value="dictation" className="rounded-xl">Dictation</TabsTrigger>
                        <TabsTrigger value="quiz" className="rounded-xl">Quiz</TabsTrigger>
                        <TabsTrigger value="quiz-passage" className="rounded-xl">Quiz Passage</TabsTrigger>
                        <TabsTrigger value="video-summary" className="rounded-xl">Video</TabsTrigger>
                        <TabsTrigger value="ielts-tests" className="rounded-xl">IELTS Tests</TabsTrigger>
                    </TabsList>

                    <TabsContent value="list" className="mt-0">
                        <DailyAssignmentsList />
                    </TabsContent>
                    <TabsContent value="start" className="mt-0">
                        <StartAssignmentPreview />
                    </TabsContent>
                    <TabsContent value="dictation" className="mt-0">
                        <DictationPreview />
                    </TabsContent>
                    <TabsContent value="quiz" className="mt-0">
                        <QuizPreview />
                    </TabsContent>
                    <TabsContent value="quiz-passage" className="mt-0">
                        <QuizPassageDrawerPreview />
                    </TabsContent>
                    <TabsContent value="video-summary" className="mt-0">
                        <VideoSummaryPreview />
                    </TabsContent>
                    <TabsContent value="ielts-tests" className="mt-0">
                        <IeltsTestsCatalogPreview />
                    </TabsContent>
                </Tabs>

                <BottomNav />
            </div>
        </div>
    );
}

export const __uiSmokeTests = {
    assignmentsCount: assignments.length === 4,
    ieltsTestsCount: ieltsTests.length === 6,
    hasAllTabs: [
        "list",
        "start",
        "dictation",
        "quiz",
        "quiz-passage",
        "video-summary",
        "ielts-tests",
    ].length === 7,
};
