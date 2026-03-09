import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TONE_CLASS = {
  default: "text-slate-700",
  danger: "text-rose-700",
  warn: "text-amber-700",
};

export default function DetailStateCard({
  message = "",
  tone = "default",
  actionLabel = "",
  onAction,
}) {
  return (
    <Card className="rounded-3xl border border-slate-200 bg-white/95 shadow-sm">
      <CardContent className="space-y-4 p-6">
        <p className={`text-sm font-medium ${TONE_CLASS[tone] || TONE_CLASS.default}`}>{message}</p>
        {actionLabel ? (
          <Button type="button" variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
