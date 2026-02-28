import "@/features/tests/components/TestCard.css";
import { Skeleton } from "@/components/ui/skeleton";

export default function TestCardSkeleton() {
  return (
    <div className="tc tc-skeleton" aria-hidden="true">
      <Skeleton className="h-5 w-4/5" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-24" />
      <div className="rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] p-3">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="mt-2 h-3.5 w-3/4" />
      </div>
      <div className="mt-auto flex items-center gap-2">
        <Skeleton className="h-[38px] flex-1 rounded-[10px]" />
        <Skeleton className="h-[38px] w-24 rounded-[10px]" />
      </div>
    </div>
  );
}
