import { BookOpen, FileText, Link as LinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const resolveResourceIcon = (blockType) => {
  if (blockType === "passage") return BookOpen;
  if (blockType === "video") return FileText;
  return LinkIcon;
};

export default function LessonMissionCard({
  lessonTitle,
  statusLabel,
  checklistItems = [],
  resources = [],
  onOpenResource,
  disabled = false,
}) {
  return (
    <Card className="overflow-hidden rounded-[28px] border-2 border-slate-900 bg-white shadow-[0_10px_0_0_rgba(15,23,42,0.12)]">
      <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-white to-sky-50 px-6 py-5 md:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 shadow-inner">
              <BookOpen className="h-7 w-7 text-sky-700" />
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white hover:bg-slate-900">
                  Today's mission
                </Badge>
                <Badge variant="outline" className="rounded-full border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                  {checklistItems.length || 0} Yêu cầu
                </Badge>
              </div>
              <h2 className="text-xl font-black md:text-2xl">Hoàn thành bài học: {lessonTitle || "Reading"}</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600 md:text-base">
                Trải nghiệm giao diện mới, rõ ràng hơn và thân thiện với học viên.
              </p>
            </div>
          </div>

          <div className="hidden rounded-2xl border border-emerald-200 bg-white/90 px-4 py-3 text-right shadow-sm md:block">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Trạng thái</p>
            <p className="text-lg font-black text-emerald-600">{statusLabel}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 px-6 py-6 md:px-7">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black">Mở bài làm thêm</h3>
              <p className="text-sm text-slate-500">Mở từng tài nguyên trước khi nộp bài.</p>
            </div>
          </div>

          <div className="grid gap-4">
            {resources.length === 0 ? (
              <Card className="rounded-2xl border border-dashed border-slate-200 bg-slate-50">
                <CardContent className="p-4 text-sm text-slate-500">
                  Chưa có bài làm thêm cho ngày hôm nay.
                </CardContent>
              </Card>
            ) : null}

            {resources.map((resource, index) => {
              const Icon = resolveResourceIcon(resource.blockType);
              return (
                <Card
                  key={resource.key || `resource-${index}`}
                  className="group rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-start gap-4">
                        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl ${index % 2 === 0 ? "bg-emerald-100" : "bg-amber-100"
                          }`}>
                          <Icon className="h-6 w-6 text-slate-700" />
                        </div>
                        <div>
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-bold text-slate-700">
                              {resource.title}
                            </Badge>
                            <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                              {resource.tag || "Required"}
                            </Badge>
                          </div>
                          <h4 className="text-base font-black text-slate-900 md:text-lg">Mở {resource.title}</h4>
                          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-600">{resource.subtitle}</p>
                        </div>
                      </div>

                      <div className="flex flex-col items-stretch gap-2 md:items-end">
                        <Button
                          type="button"
                          className="min-w-[180px] rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white shadow-[0_6px_0_0_rgba(5,150,105,0.28)] hover:bg-emerald-600"
                          onClick={() => onOpenResource?.(resource)}
                          disabled={disabled || resource.disabled}
                        >
                          {resource.actionLabel || "Open Resource"}
                        </Button>
                        <p className="text-center text-xs font-semibold text-slate-500 md:text-right">
                          Opens the correct content only
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
