import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target } from "lucide-react";

export default function DetailQuestCard({
  currentLessonTitle = "",
  sectionTitle = "",
  onOpenCurrentLesson,
  canOpen = true,
}) {
  return (
    <Card className="rounded-[28px] border border-white/80 bg-white/95 shadow-[0_14px_30px_rgba(15,23,42,0.07)]">
      <CardHeader className="pb-3">
        <div className="mb-1 flex items-center gap-2 text-emerald-700">
          <Target className="h-4 w-4" />
          <p className="text-xs font-bold uppercase tracking-[0.12em]">Today's quest</p>
        </div>
        <CardTitle className="text-lg font-black text-slate-900">
          {currentLessonTitle || "Complete your next lesson"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sectionTitle ? (
          <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700">
            {sectionTitle}
          </Badge>
        ) : null}
        <p className="text-sm text-slate-600">
          Follow the path, finish your active lesson, and unlock the next reward chest.
        </p>
        <Button type="button" className="w-full rounded-2xl" onClick={onOpenCurrentLesson} disabled={!canOpen}>
          Open current lesson
        </Button>
      </CardContent>
    </Card>
  );
}
