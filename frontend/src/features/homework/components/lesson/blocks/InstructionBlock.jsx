import { Separator } from "@/components/ui/separator";
import RichTextBlock from "./RichTextBlock";
import BlockSurfaceCard from "./shared/BlockSurfaceCard";

export default function InstructionBlock({ value }) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  return (
    <BlockSurfaceCard>
      <div className="space-y-3">
        <RichTextBlock value={raw} className="text-sm leading-7 text-slate-700" />
      </div>
    </BlockSurfaceCard>
  );
}


