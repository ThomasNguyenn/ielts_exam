import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import JourneyLessonNode from "./JourneyLessonNode";
import JourneyChestNode from "./JourneyChestNode";

export default function DetailJourneyBoard({
  nodes = [],
  progressPercent = 0,
  onOpenLesson,
  onClaimChest,
  canClaimRewards = true,
  claimingChestKeys = {},
  reducedMotion = false,
}) {
  return (
    <Card className="rounded-[32px] border border-white/80 bg-white/90 shadow-[0_20px_55px_rgba(15,23,42,0.08)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-emerald-600">Journey map</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">Lessons</h2>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-2 text-right">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Progress</p>
            <p className="text-lg font-black text-emerald-600">{progressPercent}%</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ScrollArea className="h-[62vh] pr-2">
          {nodes.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-6 text-sm text-slate-500">
              No lessons found for this assignment.
            </div>
          ) : (
            <div className="relative flex flex-col items-center gap-4 py-5">
              <div className="pointer-events-none absolute left-1/2 top-6 h-[calc(100%-3rem)] w-[6px] -translate-x-1/2 rounded-full bg-slate-200" />
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 800 1200"
                preserveAspectRatio="none"
                aria-hidden
              >
                <path
                  d="M400 90 C 560 180, 560 280, 400 360 C 240 440, 240 540, 400 630 C 560 720, 560 820, 400 910 C 240 1000, 240 1080, 400 1140"
                  fill="none"
                  stroke="#dbe4ee"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
                <path
                  d="M400 90 C 560 180, 560 280, 400 360 C 240 440, 240 540, 400 630"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="12"
                  strokeLinecap="round"
                />
              </svg>

              {nodes.map((node) => {
                if (node.kind === "chest") {
                  return (
                    <JourneyChestNode
                      key={node.key}
                      node={node}
                      onClaim={onClaimChest}
                      reducedMotion={reducedMotion}
                      disabled={!canClaimRewards}
                      isClaiming={Boolean(claimingChestKeys?.[node.chestKey])}
                    />
                  );
                }

                return (
                  <JourneyLessonNode
                    key={node.key}
                    node={node}
                    onOpenLesson={onOpenLesson}
                    reducedMotion={reducedMotion}
                  />
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
