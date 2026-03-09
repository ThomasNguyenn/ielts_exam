import BlockSurfaceCard from "./shared/BlockSurfaceCard";

export default function TitleBlock({ block }) {
  const text = String(block?.data?.text || "").trim();
  if (!text) return null;

  return (
    <BlockSurfaceCard className="border-slate-900">
      <h4 className="text-lg font-black tracking-tight text-slate-900 md:text-xl">{text}</h4>
    </BlockSurfaceCard>
  );
}


