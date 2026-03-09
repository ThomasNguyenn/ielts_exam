import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function LessonHeaderBar({
  assignmentTitle,
  lessonTitle,
  statusLabel,
  resourceCount = 0,
  onBack,
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-2xl border-slate-200 bg-white shadow-sm"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600">Homework lesson</p>
          <h1 className="text-xl font-black tracking-tight text-slate-900 md:text-2xl">
            {lessonTitle || "Lesson"}
          </h1>
          <p className="text-sm text-slate-500">{assignmentTitle || "Assignment"}</p>
        </div>
      </div>

      <div className="hidden items-center gap-2 md:flex">
        <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
          {statusLabel}
        </Badge>
        <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 text-slate-600">
          {resourceCount} resources
        </Badge>
      </div>
    </header>
  );
}


