import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DetailProgressCard({
  progressPercent = 0,
  completedLessons = 0,
  totalLessons = 0,
  claimedChestCount = 0,
  totalChestCount = 0,
}) {
  return (
    <Card className="rounded-[28px] border border-white/80 bg-white/95 shadow-[0_14px_30px_rgba(15,23,42,0.07)]">
      <CardHeader className="space-y-2 pb-3">
        <CardTitle className="text-lg font-black text-slate-900">Progress</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-full">
            Lessons {completedLessons}/{totalLessons}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            Chests {claimedChestCount}/{totalChestCount}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-2.5 rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-sm font-semibold text-emerald-700">{progressPercent}% complete</p>
      </CardContent>
    </Card>
  );
}
