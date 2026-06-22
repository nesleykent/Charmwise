'use client';

import { useLocale } from '@/lib/i18n';
import { formatNumber, formatScore } from '@/lib/format';
import { formatMessage } from '@/lib/messages';
import type { CharmRecommendation, ConfidenceLevel } from '@/types/charm';

interface Props {
  recommendations: CharmRecommendation[];
  /** Shows the full score breakdown and raw effect numbers in an expandable panel per charm. */
  detailed?: boolean;
  emptyMessage?: string;
}

const CONFIDENCE_CLASS: Record<ConfidenceLevel, string> = {
  high: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  medium: 'bg-charm-warning/15 text-charm-warning border-charm-warning/30',
  low: 'bg-charm-danger/15 text-charm-danger border-charm-danger/30',
};

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-charm-bg px-2 py-1">
      <div className="text-[10px] uppercase tracking-wide text-charm-muted">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

export function CharmRankingTable({ recommendations, detailed = false, emptyMessage }: Props) {
  const { t, locale } = useLocale();

  if (recommendations.length === 0) {
    return <p className="text-sm text-charm-muted">{emptyMessage ?? '-'}</p>;
  }

  return (
    <ol className="space-y-2">
      {recommendations.map((rec, index) => {
        const e = rec.effect;
        return (
          <li
            // The same recommendations array can be a per-creature ranking
            // (charmId already unique) or the cross-creature "ranked
            // alternatives" list (the same charm appears once per creature),
            // so the index must be part of the key.
            key={`${rec.charmId}-${index}`}
            className={`rounded-lg border p-3 ${
              index === 0 && rec.unlocked
                ? 'border-charm-primary/50 bg-charm-primary/5'
                : 'border-charm-border bg-charm-surface'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-charm-bg text-xs font-bold text-charm-muted">
                  {index + 1}
                </span>
                <span className="font-semibold text-white">{t.charms[rec.charmId]?.name ?? rec.name}</span>
                <span className="rounded border border-charm-border px-1.5 py-0.5 text-[10px] text-charm-muted">
                  T{rec.tier}
                </span>
                {!rec.unlocked && (
                  <span className="rounded border border-charm-border px-1.5 py-0.5 text-[10px] text-charm-muted">
                    {t.characterForm.tierLocked}
                  </span>
                )}
                <span className={`rounded border px-1.5 py-0.5 text-[10px] ${CONFIDENCE_CLASS[rec.confidence]}`}>
                  {t.results.confidence[rec.confidence]}
                </span>
              </div>
              <span className="text-sm font-bold text-charm-primary">{formatScore(rec.scores.totalScore)} pts</span>
            </div>

            <p className="mt-2 text-xs text-charm-muted">{formatMessage(t, rec.reason)}</p>

            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {e.expectedDamagePerHour > 0.5 && (
                <MetricChip label={t.results.metrics.expectedDamagePerHour} value={formatNumber(e.expectedDamagePerHour, locale)} />
              )}
              {e.expectedProfitPerHour > 0.5 && (
                <MetricChip label={t.results.metrics.expectedProfitPerHour} value={formatNumber(e.expectedProfitPerHour, locale)} />
              )}
              {e.expectedDamagePreventedPerHour > 0.5 && (
                <MetricChip
                  label={t.results.metrics.expectedDamagePreventedPerHour}
                  value={formatNumber(e.expectedDamagePreventedPerHour, locale)}
                />
              )}
              {e.expectedHealingGainPerHour + e.expectedManaGainPerHour + e.expectedManaSavedPerHour > 0.5 && (
                <MetricChip
                  label={t.results.metrics.expectedHealingSavedPerHour}
                  value={formatNumber(e.expectedHealingGainPerHour + e.expectedManaGainPerHour + e.expectedManaSavedPerHour, locale)}
                />
              )}
              {rec.scorePerCharmPoint !== null && (
                <MetricChip label={t.results.metrics.scorePerCharmPoint} value={rec.scorePerCharmPoint.toFixed(3)} />
              )}
              {rec.scorePerMinorCharmEcho !== null && (
                <MetricChip label={t.results.metrics.scorePerMinorCharmEcho} value={rec.scorePerMinorCharmEcho.toFixed(3)} />
              )}
            </div>

            {rec.warnings.length > 0 && (
              <ul className="mt-2 list-inside list-disc space-y-0.5 text-[11px] text-charm-warning">
                {rec.warnings.map((w, i) => (
                  <li key={i}>{formatMessage(t, w)}</li>
                ))}
              </ul>
            )}

            {detailed && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-charm-primary">{t.optimiser.sectionDetails}</summary>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] sm:grid-cols-6">
                  <MetricChip label={t.scoreDimensions.damage} value={formatScore(rec.scores.damageScore)} />
                  <MetricChip label={t.scoreDimensions.xp} value={formatScore(rec.scores.xpScore)} />
                  <MetricChip label={t.scoreDimensions.profit} value={formatScore(rec.scores.profitScore)} />
                  <MetricChip label={t.scoreDimensions.safety} value={formatScore(rec.scores.safetyScore)} />
                  <MetricChip label={t.scoreDimensions.supplySaving} value={formatScore(rec.scores.supplySavingScore)} />
                  <MetricChip label={t.scoreDimensions.utility} value={formatScore(rec.scores.utilityScore)} />
                </div>
              </details>
            )}
          </li>
        );
      })}
    </ol>
  );
}
