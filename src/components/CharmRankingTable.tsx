'use client';

import { useLocale } from '@/lib/i18n';
import { formatNumber, formatScore, toTitleCase } from '@/lib/format';
import { formatMessage } from '@/lib/messages';
import type { CharmRecommendation, ConfidenceLevel } from '@/types/charm';

interface Props {
  recommendations: CharmRecommendation[];
  /** Shows the full score breakdown and raw effect numbers in an expandable panel per charm. */
  detailed?: boolean;
  emptyMessage?: string;
  /**
   * Shows which creature each row was scored against. Needed whenever the
   * same list can mix rows for different creatures (e.g. "ranked
   * alternatives") - otherwise the same Charm appearing twice with two
   * different scores looks like a duplicate-data bug rather than two
   * distinct per-creature calculations. Leave off for an already
   * single-creature list (the heading above it already says which creature).
   */
  showCreatureName?: boolean;
}

const CONFIDENCE_CLASS: Record<ConfidenceLevel, string> = {
  high: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  medium: 'bg-charm-warning/15 text-charm-warning border-charm-warning/30',
  low: 'bg-charm-danger/15 text-charm-danger border-charm-danger/30',
  unknown: 'bg-white/10 text-charm-muted border-white/15',
};

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-charm-subtle">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${className || 'border-white/15 text-charm-muted'}`}>
      {children}
    </span>
  );
}

export function CharmRankingTable({ recommendations, detailed = false, emptyMessage, showCreatureName = false }: Props) {
  const { t, locale } = useLocale();

  if (recommendations.length === 0) {
    return <p className="text-sm text-charm-subtle">{emptyMessage ?? '-'}</p>;
  }

  return (
    <ol className="space-y-2.5">
      {recommendations.map((rec, index) => {
        const e = rec.effect;
        const scoreWasAdjusted = Math.abs(rec.scores.rawTotalScore - rec.scores.totalScore) > 0.05;
        return (
          <li
            // The same recommendations array can be a per-creature ranking
            // (charmId already unique) or the cross-creature "ranked
            // alternatives" list (the same charm appears once per creature),
            // so the index must be part of the key.
            key={`${rec.charmId}-${index}`}
            // Translucent fill, deliberately WITHOUT backdrop-blur - a ranking
            // list can run to dozens of rows across creatures, so each row
            // stays cheap and lets the single blurred glass panel it sits
            // inside (see call sites) carry the actual frosted-glass effect.
            className={`rounded-2xl border p-3.5 transition-colors ${
              index === 0 && rec.unlocked
                ? 'border-charm-primary/50 bg-charm-primary/10 shadow-glow'
                : 'border-white/10 bg-white/[0.03]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-charm-bg/80 text-xs font-bold text-charm-muted">
                  {index + 1}
                </span>
                <span className="font-semibold text-white">
                  {t.charms[rec.charmId]?.name ?? rec.name}
                  {showCreatureName && (
                    <span className="font-normal text-charm-subtle"> {t.results.linkingFor} {toTitleCase(rec.monsterName)}</span>
                  )}
                </span>
                <Badge>
                  {rec.unlocked ? t.characterForm.tierNames[rec.tier - 1] : `${t.characterForm.tierLocked} · ${t.characterForm.tierNames[rec.tier - 1]}`}
                </Badge>
                <Badge className={CONFIDENCE_CLASS[rec.confidence]}>{t.results.confidence[rec.confidence]}</Badge>
              </div>
              <span className="text-right">
                <span className="block text-sm font-bold text-charm-primary">{formatScore(rec.scores.totalScore)} pts</span>
                {scoreWasAdjusted && (
                  <span className="block text-[10px] font-medium text-charm-subtle">{t.results.metrics.adjustedScore}</span>
                )}
              </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-charm-muted">{formatMessage(t, rec.reason)}</p>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
              <ul className="mt-2.5 list-inside list-disc space-y-1 text-[11px] leading-relaxed text-charm-warning">
                {rec.warnings.map((w, i) => (
                  <li key={i}>{formatMessage(t, w)}</li>
                ))}
              </ul>
            )}

            {detailed && (
              <details className="mt-2.5">
                <summary className="cursor-pointer text-xs font-medium text-charm-primary">{t.recommendationsPage.sectionDetails}</summary>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] sm:grid-cols-6">
                  <MetricChip label={t.scoreDimensions.damage} value={formatScore(rec.scores.damageScore)} />
                  <MetricChip label={t.scoreDimensions.xp} value={formatScore(rec.scores.xpScore)} />
                  <MetricChip label={t.scoreDimensions.profit} value={formatScore(rec.scores.profitScore)} />
                  <MetricChip label={t.scoreDimensions.safety} value={formatScore(rec.scores.safetyScore)} />
                  <MetricChip label={t.scoreDimensions.supplySaving} value={formatScore(rec.scores.supplySavingScore)} />
                  <MetricChip label={t.scoreDimensions.utility} value={formatScore(rec.scores.utilityScore)} />
                  <MetricChip label={t.results.metrics.rawScore} value={formatScore(rec.scores.rawTotalScore)} />
                  <MetricChip label={t.results.metrics.adjustedScore} value={formatScore(rec.scores.totalScore)} />
                </div>
              </details>
            )}
          </li>
        );
      })}
    </ol>
  );
}
