import { Badge } from '@/components/ui/badge';

const OVERALL_STATUS_STYLES = {
  on_track: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  in_review: 'border-blue-200 bg-blue-50 text-blue-700',
  needs_attention: 'border-amber-200 bg-amber-50 text-amber-700',
  not_opened: 'border-zinc-200 bg-zinc-50 text-zinc-600',
};

const toOverallStatusLabel = (status) => {
  if (status === 'on_track') return '\u0110\u00e3 nh\u1eadn x\u00e9t';
  if (status === 'in_review') return 'C\u1ea7n Nh\u1eadn X\u00e9t';
  if (status === 'not_opened') return 'Ch\u01b0a m\u1edf b\u00e0i t\u1eadp';
  return 'C\u1ea7n Ch\u00fa \u00dd';
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

export function DailyProgressBadge({ missing, pending = 0, completed = false }) {
  const safeMissing = Number.isFinite(Number(missing)) ? Number(missing) : 0;
  const safePending = Number.isFinite(Number(pending)) ? Number(pending) : 0;
  const safeCompleted = Boolean(completed);

  if (safeMissing > 0) {
    return (
      <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-700">
        {'S\u1eafp h\u1ebft h\u1ea1n'} {safeMissing} {'b\u00e0i'}
      </Badge>
    );
  }

  if (safePending > 0) {
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
        {'B\u00e0i c\u00f2n l\u1ea1i'} {safePending}
      </Badge>
    );
  }

  if (safeCompleted) {
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
        {'\u0110\u00e3 ho\u00e0n th\u00e0nh'}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-zinc-200 bg-zinc-50 text-zinc-600">
      {'Ch\u01b0a m\u1edf b\u00e0i t\u1eadp'}
    </Badge>
  );
}
