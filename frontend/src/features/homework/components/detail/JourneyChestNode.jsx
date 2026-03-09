import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Gift, Lock, Sparkles } from "lucide-react";

export default function JourneyChestNode({
  node,
  onClaim,
  reducedMotion = false,
  disabled = false,
  isClaiming = false,
}) {
  const isClaimed = Boolean(node?.claimed);
  const isUnlocked = Boolean(node?.unlocked);
  const canClaim = !disabled && isUnlocked && !isClaimed && !isClaiming;

  return (
    <motion.article
      initial={reducedMotion ? false : { opacity: 0, scale: 0.9 }}
      animate={reducedMotion ? false : { opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`relative z-10 flex w-full max-w-md flex-col items-center ${node?.offsetClass || ""}`}
    >
      <Card className="w-full rounded-[28px] border border-amber-100 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-md">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                {isClaimed ? <Sparkles className="h-5 w-5" /> : <Gift className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-sm font-black text-slate-900">Reward chest</p>
                <p className="text-xs text-slate-600">Unlock after {node?.requiredLessons || 0} lessons</p>
              </div>
            </div>
            <Badge className="rounded-full bg-white text-amber-700">+{node?.xp || 0} XP</Badge>
          </div>

          <Button
            type="button"
            variant={isClaimed ? "outline" : "default"}
            className="w-full rounded-xl"
            disabled={!canClaim}
            data-testid={`chest-action-${node?.chestKey || "unknown"}`}
            onClick={() => onClaim?.(node)}
          >
            {isClaimed
              ? "Claimed"
              : isClaiming
                ? "Claiming..."
                : isUnlocked
                  ? "Claim chest"
                  : (
                    <>
                      <Lock className="mr-1 h-4 w-4" />
                      Locked
                    </>
                  )}
          </Button>
        </CardContent>
      </Card>
    </motion.article>
  );
}
