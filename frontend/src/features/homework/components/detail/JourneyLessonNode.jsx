import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, CheckCircle2 } from "lucide-react";

const STATUS_STYLE = {
  done: {
    ring: "ring-sky-200",
    iconBg: "from-sky-400 to-blue-500",
    actionClass: "bg-sky-500 hover:bg-sky-600",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  current: {
    ring: "ring-emerald-200 ring-4",
    iconBg: "from-emerald-400 to-green-500",
    actionClass: "bg-emerald-500 hover:bg-emerald-600",
    icon: <BookOpen className="h-4 w-4" />,
  },
  open: {
    ring: "ring-sky-200",
    iconBg: "from-sky-400 to-blue-500",
    actionClass: "bg-sky-500 hover:bg-sky-600",
    icon: <BookOpen className="h-4 w-4" />,
  },
};

export default function JourneyLessonNode({
  node,
  onOpenLesson,
  reducedMotion = false,
}) {
  const style = STATUS_STYLE[node?.status] || STATUS_STYLE.current;
  const canOpen = Boolean(node?.taskId);

  const handleOpen = () => {
    if (!canOpen) return;
    onOpenLesson?.(node);
  };

  return (
    <motion.article
      initial={reducedMotion ? false : { opacity: 0, y: 18 }}
      animate={reducedMotion ? false : { opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`relative z-10 flex w-full max-w-xl flex-col items-center ${node?.offsetClass || ""}`}
    >
      <Card
        className="homework-task-card is-link w-[92%] sm:w-full rounded-[28px] border border-slate-100 bg-white p-0 shadow-md"
        onClick={handleOpen}
        role="button"
        tabIndex={canOpen ? 0 : -1}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          handleOpen();
        }}
      >
        <CardContent className="flex items-center gap-4 p-4">
          <div
            className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-gradient-to-br ${style.iconBg} text-white shadow-[0_8px_0_0_rgba(15,23,42,0.10)] ring-2 ${style.ring}`}
          >
            {style.icon}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-700">
                {node?.sectionTitle || "Lesson"}
              </Badge>
              <Badge variant="secondary" className="rounded-full bg-amber-50 text-amber-700">
                +{node?.xp || 0} XP
              </Badge>
            </div>
            <h3 className="truncate text-base font-black text-slate-900">{node?.title || "Lesson"}</h3>
            <Button
              type="button"
              size="sm"
              className={`h-8 rounded-xl px-3 text-xs font-bold text-white ${style.actionClass}`}
              disabled={!canOpen}
              onClick={(event) => {
                event.stopPropagation();
                handleOpen();
              }}
            >
              {node?.actionLabel || "Open"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.article>
  );
}
