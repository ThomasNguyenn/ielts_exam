import React from "react";
import {
    GraduationCap,
    MessageCircleMore,
    FileText,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Pen,
    BookOpenCheck,
} from "lucide-react";

const features = {
    free: [
        "Bộ đề Actual Reading & Listening với tỷ lệ trúng đề thi máy cực cao",
        "Có đáp án chi tiết ",
        "Cập nhật xu hướng Cambridge mới nhất",
        "Thực hành đúng cấu trúc đề thật",
    ],
    paid: [
        "Forecast Speaking theo xu hướng đề thi mới",
        "Mẫu các bài Speaking hay với giải thích chi tiết",
        "Tổng hợp Part 1 – Part 2 – Part 3 trọng tâm thường gặp",
        "Các đi ý hay trong đề thi",
    ],
    pdf: [
        "Writing Task 1 & 2",
        "Mẫu bài viết chất lượng",
        "Tips và chiến thuật",
        "Chiến ngay lập tức",
    ],
};

function Badge({
    children,
    className = "",
}) {
    return (
        <div
            className={
                "inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-black shadow-sm tracking-wider uppercase " +
                className
            }
        >
            {children}
        </div>
    );
}

function FeatureList({ items }) {
    return (
        <ul className="mt-8 space-y-5 text-base font-semibold leading-relaxed text-slate-600">
            {items.map((t) => (
                <li key={t} className="flex gap-4">
                    <span className="mt-[2px] shrink-0">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-500/20" />
                    </span>
                    <span>{t}</span>
                </li>
            ))}
        </ul>
    );
}

function CtaButton({
    icon,
    children,
}) {
    return (
        <button
            type="button"
            className="group mt-auto mb-2 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#d03939] px-5 py-4 text-base font-extrabold text-white shadow-lg transition-all duration-300 hover:bg-[#FF4747] hover:scale-[1.02] active:scale-95"
        >
            <span className="opacity-95 transition-transform duration-300 group-hover:scale-110">{icon}</span>
            <span>{children}</span>
        </button>
    );
}

function CardShell({
    children,
    accent = "emerald",
}) {
    const borderMap = {
        emerald: "border-emerald-700/80 shadow-emerald-900/10",
        amber: "border-amber-400 shadow-amber-900/10",
        rose: "border-rose-500/80 shadow-rose-900/10",
    };

    return (
        <div
            className={
                "relative w-full rounded-[40px] border-2 bg-white flex flex-col p-10 min-h-[620px] transition-all duration-500 hover:shadow-2xl " +
                borderMap[accent]
            }
        >
            {children}
        </div>
    );
}

function IconTile({
    children,
    accent = "emerald",
}) {
    const bgMap = {
        emerald: "bg-[#365314]",
        amber: "bg-[#556b2f]",
        rose: "bg-[#FFF9F1]",
    };

    return (
        <div className={`mx-auto inline-flex h-16 w-16 items-center justify-center rounded-[24px] shadow-lg ${bgMap[accent]}`}>
            <div className="text-white scale-110">{children}</div>
        </div>
    );
}

export default function Banner() {
    return (
        <div className="w-full bg-slate-50 relative py-20 overflow-hidden">
            {/* Background elements */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(52,211,153,0.05),transparent_50%)]" />
            </div>

            <div className="relative mx-auto max-w-[1600px] px-10">
                {/* Header */}
                <div className="text-center mb-20 animate-in fade-in slide-in-from-top-4 duration-1000">
                    <div className="flex flex-col items-center justify-center gap-4">
                        <div className="flex items-center gap-4">
                            <span className="text-3xl inline-block animate-[bounce_2s_infinite]">📚</span>
                            <h1 className="text-4xl font-black tracking-tight text-black md:text-5xl">
                                Các Vol Test &amp; Tài Liệu IELTS
                            </h1>
                        </div>
                        <p className="text-lg font-bold text-slate-500 max-w-3xl">
                            Luyện tập và ôn luyện với các tài liệu phù hợp với nhu cầu học tập của bạn
                        </p>
                    </div>
                </div>

                {/* Cards */}
                <div className="grid items-stretch gap-10 md:grid-cols-3">
                    {/* Card 1 */}
                    <CardShell accent="emerald">
                        <div className="absolute -top-6 right-10">
                            <Badge className="bg-emerald-500 text-white border-2 border-emerald-500 text-[1rem]">
                                🎁 MIỄN PHÍ
                            </Badge>
                        </div>

                        <IconTile accent="rose">
                            <GraduationCap color="black" className="h-8 w-8" />
                        </IconTile>

                        <h2 className="mt-8 text-center text-2xl font-black text-[#1e293b] leading-tight">
                            Tài Liệu Reading Miễn Phí
                        </h2>

                        <div className="flex-grow">
                            <FeatureList items={features.free} />
                        </div>

                        <CtaButton icon={<BookOpenCheck className="h-5 w-5" />}>
                            Thử ngay
                        </CtaButton>
                    </CardShell>

                    {/* Card 2 (Highlight) */}
                    <CardShell accent="amber">
                        <div className="absolute -top-6 right-10">
                            <Badge className="bg-amber-400 text-slate-900 border-2 border-amber-400 text-[1rem]">
                                ⚡ THỰC CHIẾN
                            </Badge>
                        </div>

                        <IconTile accent="rose">
                            <MessageCircleMore color="black" className="h-8 w-8" />
                        </IconTile>

                        <h2 className="mt-8 text-center text-2xl font-black text-[#1e293b] leading-tight">
                            Speaking 2026
                        </h2>

                        <div className="flex-grow p-4">
                            <FeatureList items={features.paid} />
                        </div>

                        <CtaButton >
                            Xem thêm
                        </CtaButton>
                    </CardShell>

                    {/* Card 3 */}
                    <CardShell accent="rose">
                        <div className="absolute -top-6 right-10">
                            <Badge className="bg-rose-500 text-white border-2 border-rose-500 text-[1rem]">
                                📄 TÀI LIỆU
                            </Badge>
                        </div>

                        <IconTile accent="rose">
                            <FileText color="black" className="h-8 w-8" />
                        </IconTile>

                        <h2 className="mt-8 text-center text-2xl font-black text-[#1e293b] leading-tight">
                            Luyện tập Writing Chất Lượng
                        </h2>

                        <div className="flex-grow">
                            <FeatureList items={features.pdf} />
                        </div>

                        <CtaButton icon={<Pen className="h-5 w-5" />}>
                            Luyện ngay
                        </CtaButton>
                    </CardShell>
                </div>

                {/* Navigation */}
                {/* <div className="mt-20 flex items-center justify-center gap-10">
                    <button className="h-14 w-14 flex items-center justify-center rounded-full bg-[#365314] text-white shadow-xl transition-all hover:scale-110 active:scale-90">
                        <ChevronLeft className="h-7 w-7" />
                    </button>
                    <div className="flex gap-4">
                        <div className="h-3 w-3 rounded-full bg-[#365314]" />
                        <div className="h-3 w-3 rounded-full bg-slate-300" />
                        <div className="h-3 w-3 rounded-full bg-slate-300" />
                    </div>
                    <button className="h-14 w-14 flex items-center justify-center rounded-full bg-[#365314] text-white shadow-xl transition-all hover:scale-110 active:scale-90">
                        <ChevronRight className="h-7 w-7" />
                    </button>
                </div> */}
            </div>
        </div>
    );
}
