import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function BlockSurfaceCard({ className, contentClassName, children }) {
  return (
    <Card className={cn("rounded-3xl border border-slate-200 bg-white shadow-sm", className)}>
      <CardContent className={cn("space-y-4 p-4 md:p-5", contentClassName)}>{children}</CardContent>
    </Card>
  );
}


