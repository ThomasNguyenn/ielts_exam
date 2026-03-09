import { Badge } from "@/components/ui/badge";

export default function BlockHeader({ title, description, badge }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <h4 className="text-base font-black tracking-tight text-slate-900 md:text-lg">{title}</h4>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </div>
      {badge ? (
        <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold text-slate-600">
          {badge}
        </Badge>
      ) : null}
    </div>
  );
}


