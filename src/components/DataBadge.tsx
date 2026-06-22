'use client';

import { useLocale } from '@/lib/i18n';

export type DataProvenance = 'measured' | 'estimated' | 'assumed';

const PROVENANCE_CLASS: Record<DataProvenance, string> = {
  measured: 'border-charm-minor/30 bg-charm-minor/10 text-charm-minor',
  estimated: 'border-charm-warning/30 bg-charm-warning/10 text-charm-warning',
  assumed: 'border-charm-subtle/40 bg-white/[0.04] text-charm-subtle',
};

/**
 * The "where did this number come from" badge - Charmwise's answer to
 * Responsibility/transparency. `measured` = read directly from your pasted
 * session or the Bestiary; `estimated` = derived via a documented heuristic
 * (hover/title explains which); `assumed` = a fixed default, used because no
 * data existed at all.
 */
export function DataBadge({ tier, title }: { tier: DataProvenance; title?: string }) {
  const { t } = useLocale();
  const label = { measured: t.dataBadge.measured, estimated: t.dataBadge.estimated, assumed: t.dataBadge.assumed }[tier];
  const hint = { measured: t.dataBadge.measuredHint, estimated: t.dataBadge.estimatedHint, assumed: t.dataBadge.assumedHint }[tier];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${PROVENANCE_CLASS[tier]}`}
      title={title ?? hint}
    >
      {label}
    </span>
  );
}
