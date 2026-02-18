import React from "react";
import {
    Book,
    Volume2,
    PenTool,
    CheckCircle2,
    ShoppingCart,
} from "lucide-react";

const pricingData = {
    reading: [
        "10 đề thi lấy từ hội đồng thi",
        "Xác suất trúng thi máy 30%",
        "Đáp án chuẩn Cambridge",
        "Giải thích chi tiết",
    ],
    listening: [
        "10 đề thi lấy từ hội đồng thi",
        "Xác suất trúng thi máy 30%",
        "Đáp án chuẩn Cambridge",
        "Audio + Transcript",
    ],
    writing: [
        "10 đề thi lấy từ hội đồng thi",
        "Task 1 và Task 2",
        "Có sample đầy đủ",
        "Xác suất trúng thi máy 30%",
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
    onClick,
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="group mt-auto mb-2 inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-[#6366F1] px-5 py-4 text-base font-extrabold text-white shadow-lg transition-all duration-300 hover:bg-[#4F46E5] hover:scale-[1.02] active:scale-95"
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
        rose: "bg-[#4a5f2a]",
    };

    return (
        <div className={`mx-auto inline-flex h-16 w-16 items-center justify-center rounded-[24px] shadow-lg ${bgMap[accent]}`}>
            <div className="text-white scale-110">{children}</div>
        </div>
    );
}

export default function BannerTwo() {
    const showPricingModal = (type) => {
        console.log(`Open pricing modal for ${type}`);
        // Add your modal logic here if needed
    };

    return (
        <div className="w-full bg-white relative py-20 overflow-hidden">
            <div className="relative mx-auto max-w-[1600px] px-10">
                {/* Header */}
                <div className="text-center mb-20 animate-in fade-in slide-in-from-top-4 duration-1000">
                    <div className="flex flex-col items-center justify-center gap-4">
                        <div className="flex items-center gap-4">
                            <span className="text-4xl inline-block animate-[bounce_2s_infinite]">💰</span>
                            <h1 className="text-4xl font-black tracking-tight text-black">
                                Bộ Đề Dự Đoán IELTS
                            </h1>
                        </div>
                        {/* <p className="text-lg font-bold text-slate-500 max-w-3xl">
                            Chọn gói đề thi phù hợp với mục tiêu của bạn
                        </p> */}
                    </div>
                </div>

                {/* Cards */}
                <div className="grid items-stretch gap-10 md:grid-cols-3">
                    {/* Reading */}
                    <CardShell accent="grey">
                        <div className="absolute -top-6 right-10">
                            <Badge className="bg-emerald-500 text-white border-2 border-emerald-500 text-[1rem]">
                                PHỔ BIẾN
                            </Badge>
                        </div>

                        <IconTile accent="">
                            📖
                        </IconTile>

                        <h2 className="mt-8 text-center text-2xl font-black text-[#1e293b] leading-tight">
                            10 Test Reading
                        </h2>



                        <div className="flex-grow">
                            <FeatureList items={pricingData.reading} />
                        </div>

                        <CtaButton icon={<ShoppingCart className="h-5 w-5" />} onClick={() => showPricingModal('Reading')}>
                            Thử Ngay
                        </CtaButton>
                    </CardShell>

                    {/* Listening */}
                    <CardShell accent="grey">
                        <div className="absolute -top-6 right-10">
                            <Badge className="bg-amber-400 text-slate-900 border-2 border-amber-400 text-[1rem]">
                                🔥 HOT
                            </Badge>
                        </div>

                        <IconTile accent="light">
                            🎧
                        </IconTile>

                        <h2 className="mt-8 text-center text-2xl font-black text-[#1e293b] leading-tight">
                            10 Test Listening
                        </h2>

                        {/* <div className="mt-4 text-center">
                            <span className="text-3xl font-black text-[#365314]">800.000₫</span>
                            <span className="text-slate-500 font-bold ml-1">/bộ</span>
                        </div> */}

                        <div className="flex-grow">
                            <FeatureList items={pricingData.listening} />
                        </div>

                        <CtaButton icon={<ShoppingCart className="h-5 w-5" />} onClick={() => showPricingModal('Listening')}>
                            Thử Ngay
                        </CtaButton>
                    </CardShell>

                    {/* Writing */}
                    <CardShell accent="grey">
                        <div className="absolute -top-6 right-10">
                            <Badge className="bg-rose-500 text-white border-2 border-rose-500 text-[1rem]">
                                CAO CẤP
                            </Badge>
                        </div>

                        <IconTile accent="light">
                            ✍️
                        </IconTile>

                        <h2 className="mt-8 text-center text-2xl font-black text-[#1e293b] leading-tight">
                            10 Test Writing
                        </h2>



                        <div className="flex-grow p-5">
                            <FeatureList items={pricingData.writing} />
                        </div>

                        <CtaButton icon={<ShoppingCart className="h-5 w-5" />} onClick={() => showPricingModal('Writing')}>
                            Thử Ngay
                        </CtaButton>
                    </CardShell>
                </div>
            </div>
        </div>
    );
}