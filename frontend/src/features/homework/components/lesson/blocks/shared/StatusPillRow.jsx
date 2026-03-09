import { Badge } from "@/components/ui/badge";

export default function StatusPillRow({ pills = [] }) {
  const visible = (Array.isArray(pills) ? pills : []).filter((pill) => String(pill?.label || "").trim());
  if (!visible.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map((pill) => (
        <Badge
          key={pill.id || pill.label}
          variant={pill.variant || "outline"}
          className="rounded-full px-3 py-1 text-xs font-semibold"
        >
          {pill.label}
        </Badge>
      ))}
    </div>
  );
}


