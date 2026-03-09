import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import BlockSurfaceCard from "./shared/BlockSurfaceCard";
import BlockHeader from "./shared/BlockHeader";

export default function InternalBlock({ block, task }) {
  const resourceRefType = String(block?.resourceRefType || "").trim();
  const resourceRefId = String(block?.resourceRefId || "").trim();
  const resourceSlotKey = String(block?.resourceSlotKey || "").trim();
  const onLaunchInternal = typeof block?.onLaunchInternal === "function" ? block.onLaunchInternal : null;
  const canLaunchInternal = Boolean(block?.canLaunchInternal);
  const isLaunchingInternal = Boolean(block?.isLaunchingInternal);

  return (
    <BlockSurfaceCard className="border-emerald-200">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <BlockHeader
          title="Tài nguyên nội bộ"
          description={`Internal ${resourceRefType || "content"}: ${resourceRefId || "--"}`}
        />
        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
          Launch
        </Badge>
      </div>

      {!resourceRefType || !resourceRefId || !resourceSlotKey ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          This internal block is missing launch configuration.
        </p>
      ) : null}

      <div className="flex items-center justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onLaunchInternal?.({ block, task })}
          disabled={!onLaunchInternal || !canLaunchInternal || !resourceRefId || !resourceSlotKey || isLaunchingInternal}
        >
          {isLaunchingInternal ? "Launching..." : "Launch Resource"}
        </Button>
      </div>
    </BlockSurfaceCard>
  );
}
