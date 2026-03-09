import { Button } from "@/components/ui/button";

export default function ActionBar({ note, actionLabel, onAction, disabled = false, actionVariant = "outline" }) {
  if (!note && !actionLabel) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {note ? <p className="text-xs text-slate-500">{note}</p> : <span />}
      {actionLabel ? (
        <Button type="button" variant={actionVariant} size="sm" onClick={onAction} disabled={disabled}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}


