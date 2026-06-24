'use client';

import { useLocale } from '@/lib/i18n';
import { formatNumber, formatPercent, formatScore, toTitleCase } from '@/lib/format';
import { formatMessage } from '@/lib/messages';
import { formatGain, primaryGainLabel, roleLabel } from '@/lib/recommendationViews';
import type { CharmRecommendation, ConfidenceLevel } from '@/types/charm';
import type { Dictionary, Locale } from '@/types/i18n';

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
  unknown: 'bg-white/10 text-charm-muted border-charm-border',
};

function MetricChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-charm-border bg-white/[0.025] px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-charm-subtle">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function Badge({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${className || 'border-charm-border text-charm-muted'}`}>
      {children}
    </span>
  );
}

function formatFormulaNumber(value: number | null | undefined, locale: Locale, maximumFractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

function FormulaLine({ label, formula, result }: { label: string; formula: string; result?: string }) {
  return (
    <div className="rounded-lg border border-charm-border bg-white/[0.025] p-2.5">
      <div className="text-[10px] uppercase tracking-wide text-charm-subtle">{label}</div>
      <div className="mt-1 text-xs leading-relaxed text-charm-muted">{formula}</div>
      {result && <div className="mt-1 text-sm font-semibold text-white">{result}</div>}
    </div>
  );
}

function mitigationFormulaPart(multiplier: number | null, locale: Locale): string {
  return multiplier === null
    ? '100% mitigation multiplier assumed'
    : `${formatPercent(multiplier, 1)} mitigation multiplier`;
}

function EffectModelPanel({ rec, t, locale }: { rec: CharmRecommendation; t: Dictionary; locale: Locale }) {
  const c = rec.calculation;
  const formulaLines: { label: string; formula: string; result?: string }[] = [];
  const triggerLabel =
    c.triggerUnit === 'kill'
      ? t.results.modelKillsPerHour.toLowerCase()
      : c.triggerUnit === 'attack'
        ? t.results.modelAttacksPerHour.toLowerCase()
        : t.results.modelHuntBasis.toLowerCase();

  if (c.baseDamage !== null) {
    const baseSource =
      c.effectKind === 'percent_hitpoints_damage_on_attack'
        ? `${formatFormulaNumber(c.characterMaxHitpoints, locale, 0)} character HP`
        : c.effectKind === 'percent_mana_damage_on_attack'
          ? `${formatFormulaNumber(c.characterMaxMana, locale, 0)} character mana`
          : `${formatFormulaNumber(c.hitpoints, locale, 0)} creature HP`;

    formulaLines.push({
      label: t.results.modelBaseDamage,
      formula: `${baseSource} x ${formatPercent(c.tierValue, 1)} = ${formatFormulaNumber(c.uncappedBaseDamage, locale)}`,
    });

    if (c.levelCapDamage !== null) {
      const capSource =
        c.levelCapMultiplier !== null
          ? `level ${formatFormulaNumber(c.characterLevel, locale, 0)} x ${formatFormulaNumber(c.levelCapMultiplier, locale, 0)}`
          : `${formatFormulaNumber(c.hitpoints, locale, 0)} creature HP x ${formatPercent(0.08, 0)}`;
      formulaLines.push({
        label: t.results.modelDamageCap,
        formula: `${capSource} = ${formatFormulaNumber(c.levelCapDamage, locale)} (${c.wasLevelCapped ? t.results.modelUsed : t.results.modelNotUsed})`,
      });
    }

    formulaLines.push({
      label: t.results.modelSelectedBaseDamage,
      formula: c.wasLevelCapped ? `${t.results.modelDamageCap} < ${t.results.modelBaseDamage.toLowerCase()}` : `${t.results.modelBaseDamage} <= ${t.results.modelDamageCap.toLowerCase()}`,
      result: formatFormulaNumber(c.baseDamage, locale),
    });

    if (c.hitpoints !== null) {
      const impactFactor = c.baseDamage * c.hitpoints * c.kills;
      formulaLines.push({
        label: t.results.modelCharmImpactFactor,
        formula: `${formatFormulaNumber(c.baseDamage, locale)} base x ${formatFormulaNumber(c.hitpoints, locale, 0)} creature HP x ${formatFormulaNumber(c.kills, locale, 0)} kills`,
        result: formatFormulaNumber(impactFactor, locale, 0),
      });
    }

    if (c.resistanceMultiplier !== null) {
      formulaLines.push({
        label: t.results.modelPerProcDamage,
        formula: `${formatFormulaNumber(c.baseDamage, locale)} base x ${formatPercent(c.resistanceMultiplier, 0)} ${c.element ?? ''} multiplier x ${mitigationFormulaPart(c.mitigationMultiplier, locale)} = ${formatFormulaNumber(c.perProcDamage, locale)}`,
      });
    } else {
      formulaLines.push({
        label: t.results.modelPerProcDamage,
        formula: `${formatFormulaNumber(c.baseDamage, locale)} base x ${mitigationFormulaPart(c.mitigationMultiplier, locale)} = ${formatFormulaNumber(c.perProcDamage, locale)}`,
      });
    }

    if (c.activationChance !== null && c.triggersPerHour !== null) {
      formulaLines.push({
        label: t.results.modelHourlyEstimate,
        formula: `${formatFormulaNumber(c.perProcDamage, locale)} x ${formatPercent(c.activationChance, 1)} proc chance x ${formatFormulaNumber(c.triggersPerHour, locale)} ${triggerLabel}`,
        result: `${formatNumber(rec.effect.expectedDamagePerHour, locale)} ${t.results.metrics.expectedDamagePerHour.toLowerCase()}`,
      });
    }
  } else if (c.effectKind === 'dodge_incoming_damage') {
    formulaLines.push({
      label: t.results.modelHourlyEstimate,
      formula: `${formatNumber(c.incomingDamagePerHourFromMonster, locale)} incoming damage/h x ${formatPercent(c.activationChance ?? 0, 1)} proc chance`,
      result: `${formatNumber(rec.effect.expectedDamagePreventedPerHour, locale)} ${t.results.metrics.expectedDamagePreventedPerHour.toLowerCase()}`,
    });
  } else if (c.effectKind === 'reflect_incoming_damage') {
    formulaLines.push({
      label: t.results.modelHourlyEstimate,
      formula: `${formatNumber(c.incomingDamagePerHourFromMonster, locale)} incoming damage/h x ${formatPercent(c.activationChance ?? 0, 1)} proc chance`,
      result: `${formatNumber(rec.effect.expectedDamagePerHour, locale)} ${t.results.metrics.expectedDamagePerHour.toLowerCase()}`,
    });
  } else if (c.effectKind === 'critical_chance_bonus') {
    formulaLines.push({
      label: t.results.modelHourlyEstimate,
      formula: `${formatNumber(c.baseDamagePerHourAgainstMonster, locale)} baseline damage/h x ${formatPercent(c.tierValue, 1)} crit chance gain x ${formatPercent(c.criticalDamageBonus / 100, 1)} crit damage`,
      result: `${formatNumber(rec.effect.expectedDamagePerHour, locale)} ${t.results.metrics.expectedDamagePerHour.toLowerCase()}`,
    });
  } else if (c.effectKind === 'critical_damage_bonus') {
    formulaLines.push({
      label: t.results.modelHourlyEstimate,
      formula: `${formatNumber(c.baseDamagePerHourAgainstMonster, locale)} baseline damage/h x ${formatPercent(c.criticalChance / 100, 1)} crit chance x ${formatPercent(c.tierValue, 1)} crit damage gain`,
      result: `${formatNumber(rec.effect.expectedDamagePerHour, locale)} ${t.results.metrics.expectedDamagePerHour.toLowerCase()}`,
    });
  } else if (c.effectKind === 'life_leech_bonus') {
    formulaLines.push({
      label: t.results.modelHourlyEstimate,
      formula: `${formatNumber(c.baseDamagePerHourAgainstMonster, locale)} baseline damage/h x ${formatPercent(c.tierValue, 1)} added life leech`,
      result: `${formatNumber(rec.effect.expectedHealingGainPerHour, locale)} ${t.results.metrics.expectedHealingSavedPerHour.toLowerCase()}`,
    });
  } else if (c.effectKind === 'mana_leech_bonus') {
    formulaLines.push({
      label: t.results.modelHourlyEstimate,
      formula: `${formatNumber(c.baseDamagePerHourAgainstMonster, locale)} baseline damage/h x ${formatPercent(c.tierValue, 1)} added mana leech`,
      result: `${formatNumber(rec.effect.expectedManaGainPerHour, locale)} ${t.results.metrics.expectedHealingSavedPerHour.toLowerCase()}`,
    });
  } else if (c.effectKind === 'mana_drain_inversion') {
    formulaLines.push({
      label: t.results.modelHourlyEstimate,
      formula: `${formatNumber(c.manaDrainReceivedPerHour, locale)} estimated mana drain/h x ${formatPercent(c.activationChance ?? 0, 1)} proc chance x 2 net swing (loss avoided + mana gained)`,
      result: `${formatNumber(rec.effect.expectedManaSavedPerHour, locale)} ${t.results.metrics.expectedHealingSavedPerHour.toLowerCase()}`,
    });
  } else if (c.effectKind === 'prevent_flee') {
    if (c.fleeHealthPercent === null) {
      formulaLines.push({
        label: t.results.modelHourlyEstimate,
        formula: t.messages.no_flee_data ?? 'No flee-at-low-health threshold is available for this creature.',
      });
    } else if (c.fleeHealthPercent <= 0) {
      formulaLines.push({
        label: t.results.modelHourlyEstimate,
        formula: t.messages.no_flee_behavior ?? 'This creature is marked as not fleeing at low health.',
      });
    } else {
      formulaLines.push({
        label: t.results.modelHourlyEstimate,
        formula: `${formatPercent(c.activationChance ?? 0, 1)} proc chance x ${formatPercent(c.fleeHealthPercent, 1)} low-health flee window`,
        result: `${formatScore(rec.effect.utilityMagnitude)} ${roleLabel('utility', t).toLowerCase()}`,
      });
    }
  } else if (c.effectKind === 'paralyse_creature_on_attack' || c.effectKind === 'paralyse_creature_on_hit_received') {
    const averageSecondsPerKill = c.killsPerHour && c.killsPerHour > 0 ? 3600 / c.killsPerHour : null;
    const uptime = averageSecondsPerKill ? Math.min(1, ((c.activationChance ?? 0) * c.tierValue) / averageSecondsPerKill) : null;
    formulaLines.push({
      label: t.results.modelHourlyEstimate,
      formula: `${formatPercent(c.activationChance ?? 0, 1)} proc chance x ${formatFormulaNumber(c.tierValue, locale, 0)}s paralysis / ${formatFormulaNumber(averageSecondsPerKill, locale, 1)}s average between kills = ${formatPercent(uptime ?? 0, 1)} uptime`,
      result: `${formatNumber(rec.effect.expectedDamagePreventedPerHour, locale)} ${t.results.metrics.expectedDamagePreventedPerHour.toLowerCase()}`,
    });
  }

  const hasDerivedOutput =
    rec.effect.expectedDamagePerHour > 0.5 ||
    rec.effect.expectedXpPerHour > 0.5 ||
    rec.effect.expectedProfitPerHour > 0.5 ||
    rec.effect.expectedDamagePreventedPerHour > 0.5 ||
    rec.effect.expectedHealingGainPerHour + rec.effect.expectedManaGainPerHour + rec.effect.expectedManaSavedPerHour > 0.5;

  return (
    <div className="rounded-lg border border-charm-border bg-charm-bg/45 p-3">
      <p className="text-xs font-semibold text-white">{t.results.effectModelTitle}</p>
      <div className="mt-2 text-[10px] uppercase tracking-wide text-charm-subtle">{t.results.modelHuntBasis}</div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MetricChip label={t.results.modelKillShare} value={formatPercent(c.killShare, 1)} />
        <MetricChip label={t.results.modelKillsPerHour} value={formatFormulaNumber(c.killsPerHour, locale)} />
        <MetricChip label={t.results.modelAttacksPerHour} value={formatFormulaNumber(c.attacksPerHour, locale)} />
      </div>

      <div className="mt-3 text-[10px] uppercase tracking-wide text-charm-subtle">{t.results.modelEffectFormula}</div>
      <div className="mt-3 space-y-2">
        {formulaLines.length > 0 ? (
          formulaLines.map((line, index) => <FormulaLine key={`${line.label}-${index}`} {...line} />)
        ) : (
          <p className="rounded-lg border border-charm-border bg-white/[0.025] p-2.5 text-xs leading-relaxed text-charm-muted">
            {t.results.modelNoSpecificFormula}
          </p>
        )}
      </div>

      {hasDerivedOutput && (
        <div className="mt-3">
          <div className="mb-1.5 text-[10px] uppercase tracking-wide text-charm-subtle">{t.results.modelDerivedOutputs}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {rec.effect.expectedDamagePerHour > 0.5 && (
              <MetricChip label={t.results.metrics.expectedDamagePerHour} value={formatNumber(rec.effect.expectedDamagePerHour, locale)} />
            )}
            {rec.effect.expectedXpPerHour > 0.5 && <MetricChip label={t.results.metrics.expectedXpPerHour} value={formatNumber(rec.effect.expectedXpPerHour, locale)} />}
            {rec.effect.expectedProfitPerHour > 0.5 && (
              <MetricChip label={t.results.metrics.expectedProfitPerHour} value={formatNumber(rec.effect.expectedProfitPerHour, locale)} />
            )}
            {rec.effect.expectedDamagePreventedPerHour > 0.5 && (
              <MetricChip label={t.results.metrics.expectedDamagePreventedPerHour} value={formatNumber(rec.effect.expectedDamagePreventedPerHour, locale)} />
            )}
            {rec.effect.expectedHealingGainPerHour + rec.effect.expectedManaGainPerHour + rec.effect.expectedManaSavedPerHour > 0.5 && (
              <MetricChip
                label={t.results.metrics.expectedHealingSavedPerHour}
                value={formatNumber(rec.effect.expectedHealingGainPerHour + rec.effect.expectedManaGainPerHour + rec.effect.expectedManaSavedPerHour, locale)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Replaces the old per-dimension weighted-score breakdown: there is no
 * blend left to show. A role badge plus a one-line structural "why" (role
 * is a fixed identity fact - see EFFECT_KIND_TO_ROLE - never recomputed from
 * this hunt's numbers), the charm's own raw role metric in its real unit,
 * and a cost ratio when one applies.
 */
function RoleCalculationPanel({ rec, t, locale }: { rec: CharmRecommendation; t: Dictionary; locale: Locale }) {
  const explanationTemplate = t.results.roleExplanations[rec.role] ?? '';
  const explanation = explanationTemplate.replace('{{charm}}', t.charms[rec.charmId]?.name ?? rec.name);

  return (
    <div className="mt-2.5 space-y-3">
      <EffectModelPanel rec={rec} t={t} locale={locale} />
      <div className="rounded-lg border border-charm-border bg-charm-bg/45 p-3">
        <Badge className="border-charm-primary/40 bg-charm-primary/10 text-charm-primary">{roleLabel(rec.role, t)}</Badge>
        <p className="mt-2 text-[11px] leading-relaxed text-charm-muted">{explanation}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <MetricChip
            label={primaryGainLabel(rec.role, rec.effect.expectedDamagePreventedPerHour, t)}
            value={formatGain(rec.role, rec.roleMetric, rec.effect.expectedDamagePreventedPerHour, locale)}
          />
          {rec.roleMetricPerCharmPoint !== null && (
            <MetricChip label={t.results.metrics.roleMetricPerCharmPoint} value={rec.roleMetricPerCharmPoint.toFixed(3)} />
          )}
          {rec.roleMetricPerMinorCharmEcho !== null && (
            <MetricChip label={t.results.metrics.roleMetricPerMinorCharmEcho} value={rec.roleMetricPerMinorCharmEcho.toFixed(3)} />
          )}
        </div>
      </div>
    </div>
  );
}

// Relative, not absolute - roleMetric's scale varies hugely by role (a
// damage/hour figure can run into the thousands; a 0-1 utilityMagnitude
// never does), so a fixed absolute gap can't mean "tied" for both at once.
const TIE_EPSILON_RATIO = 0.01;

/** Ties only ever compare entries of the SAME role - different roles are different units, so they're never "tied" regardless of how close roleMetric happens to land. */
function isWithinTieEpsilon(a: CharmRecommendation, b: CharmRecommendation): boolean {
  if (a.role !== b.role) return false;
  const larger = Math.max(Math.abs(a.roleMetric), Math.abs(b.roleMetric));
  if (larger <= 0) return true;
  return Math.abs(a.roleMetric - b.roleMetric) / larger < TIE_EPSILON_RATIO;
}

/**
 * Standard competition ranking (1, 2, 2, 4 - not 1, 2, 2, 3): real ties on
 * roleMetric happen routinely - Cripple and Numb, for instance, model
 * identical activation chance and duration per tier (see
 * cripple_numb_same_values), so they land on the exact same prevented-damage
 * number whenever nothing else differs. Showing a strict, unbroken 1-2-3-4
 * here would assert a confidence in the ordering that the data doesn't
 * actually have.
 */
function computeDisplayRanks(recommendations: CharmRecommendation[]): { rank: number; isTied: boolean }[] {
  const ranks: number[] = [];
  for (let i = 0; i < recommendations.length; i++) {
    const tiedWithPrevious = i > 0 && isWithinTieEpsilon(recommendations[i]!, recommendations[i - 1]!);
    ranks.push(tiedWithPrevious ? ranks[i - 1]! : i + 1);
  }
  return recommendations.map((rec, i) => ({
    rank: ranks[i]!,
    isTied:
      (i > 0 && isWithinTieEpsilon(rec, recommendations[i - 1]!)) ||
      (i < recommendations.length - 1 && isWithinTieEpsilon(rec, recommendations[i + 1]!)),
  }));
}

export function CharmRankingTable({ recommendations, detailed = false, emptyMessage, showCreatureName = false }: Props) {
  const { t, locale } = useLocale();

  if (recommendations.length === 0) {
    return <p className="text-sm text-charm-subtle">{emptyMessage ?? '-'}</p>;
  }

  const displayRanks = computeDisplayRanks(recommendations);

  return (
    <>
      {recommendations.length > 1 && <p className="mb-2 text-[11px] leading-relaxed text-charm-subtle">{t.results.rankingCriterionNote}</p>}
      <ol className="space-y-2.5">
      {recommendations.map((rec, index) => {
        const e = rec.effect;
        const { rank, isTied } = displayRanks[index]!;
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
            className={`rounded-lg border p-3.5 transition-colors ${
              rank === 1 && rec.unlocked
                ? 'border-charm-primary/50 bg-charm-primary/10 shadow-glow'
                : 'border-charm-border bg-white/[0.025]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-charm-bg/80 text-xs font-bold text-charm-muted"
                  title={isTied ? t.results.tiedRankHint : undefined}
                >
                  {isTied ? `=${rank}` : rank}
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
                <span className="block text-sm font-bold text-charm-primary">
                  {formatGain(rec.role, rec.roleMetric, e.expectedDamagePreventedPerHour, locale)}
                </span>
                <span className="block text-[10px] font-medium text-charm-subtle">{primaryGainLabel(rec.role, e.expectedDamagePreventedPerHour, t)}</span>
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
              {rec.roleMetricPerCharmPoint !== null && (
                <MetricChip label={t.results.metrics.roleMetricPerCharmPoint} value={rec.roleMetricPerCharmPoint.toFixed(3)} />
              )}
              {rec.roleMetricPerMinorCharmEcho !== null && (
                <MetricChip label={t.results.metrics.roleMetricPerMinorCharmEcho} value={rec.roleMetricPerMinorCharmEcho.toFixed(3)} />
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
                <summary className="cursor-pointer text-xs font-medium text-charm-primary">{t.results.calculationDetailsTitle}</summary>
                <RoleCalculationPanel rec={rec} t={t} locale={locale} />
              </details>
            )}
          </li>
        );
      })}
      </ol>
    </>
  );
}
