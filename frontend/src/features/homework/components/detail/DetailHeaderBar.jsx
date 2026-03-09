import { ArrowLeft, BookOpen, Flame, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function DetailHeaderBar({
  assignmentTitle = "Assignment",
  subtitle = "",
  earnedXp = 0,
  streakLabel = "",
  onBack,
}) {
  return (
    <div className="rounded-[32px] border border-white/80 bg-white/95 p-5 shadow-[0_14px_35px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <Button type="button" variant="ghost" size="icon" className="shrink-0 rounded-2xl border" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-700">
              <BookOpen className="h-4 w-4" />
              <p className="text-xs font-bold uppercase tracking-[0.12em]">Homework Journey</p>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">{assignmentTitle}</h1>
            {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {streakLabel ? (
            <Badge variant="secondary" className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
              <Flame className="mr-1 h-3.5 w-3.5" />
              {streakLabel}
            </Badge>
          ) : null}
          <Badge variant="secondary" className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
            <Star className="mr-1 h-3.5 w-3.5" />
            {earnedXp} XP
          </Badge>
        </div>
      </div>
    </div>
  );
}
