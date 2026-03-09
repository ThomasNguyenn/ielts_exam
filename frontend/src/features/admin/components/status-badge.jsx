import { Badge } from '@/components/ui/badge';

const OVERALL_STATUS_STYLES = {
  on_track: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  in_review: 'border-blue-200 bg-blue-50 text-blue-700',
  needs_attention: 'border-amber-200 bg-amber-50 text-amber-700',
};

const toOverallStatusLabel = (status) => {
  if (status === 'on_track') return 'On track';
  if (status === 'in_review') return 'In review';
  return 'Needs attention';
};

export function StatusBadge({ status }) {
  const normalized = String(status || '').trim() || 'needs_attention';
  const tone = OVERALL_STATUS_STYLES[normalized] || OVERALL_STATUS_STYLES.needs_attention;
  return (
    <Badge variant="outline" className={tone}>
      {toOverallStatusLabel(normalized)}
    </Badge>
  );
}

export function DailyProgressBadge({ missing }) {
  const safeMissing = Number.isFinite(Number(missing)) ? Number(missing) : 0;
  if (safeMissing <= 0) {
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
        On time
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
      {safeMissing} missing
    </Badge>
  );
}

