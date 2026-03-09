import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const toneClassMap = {
  default: "text-slate-700",
  danger: "text-red-700",
  warn: "text-amber-700",
};

export default function LessonStateCard({
  message,
  tone = "default",
  actionLabel,
  onAction,
}) {
  return (
    <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-3 p-4">
        <p className={cn("text-sm", toneClassMap[tone] || toneClassMap.default)}>{message}</p>
        {actionLabel ? (
          <Button type="button" variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}


