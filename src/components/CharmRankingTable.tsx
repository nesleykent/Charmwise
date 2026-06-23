'use client';

import { useLocale } from '@/lib/i18n';
import { formatNumber, formatPercent, formatScore, toTitleCase } from '@/lib/format';
import { formatMessage } from '@/lib/messages';
import type { CharmRecommendation, ConfidenceLevel, ScoreWeights } from '@/types/charm';
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

type ScoreDimensionKey = keyof ScoreWeights;

interface ScoreCalculationRow {
  key: ScoreDimensionKey;
  label: string;
  input: number;
  basis: number;
  score: number;
  weight: number;
}

function formatCalculationValue(key: ScoreDimensionKey, value: number, locale: Locale): string {
  return key === 'utility' ? formatScore(value) : formatNumber(value, locale);
}

function formatInputVsBest(row: ScoreCalculationRow, t: Dictionary, locale: Locale): string {
  const input = formatCalculationValue(row.key, row.input, locale);
  const basis = row.basis <= 1e-6 ? t.results.scoreNoBestValue : formatCalculationValue(row.key, row.basis, locale);
  return `${input} / ${basis}`;
}

function formatFormulaNumber(value: number | null | undefined, locale: Locale, maximumFractionDigits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

function FormulaLine({ label, formula, result }: { label: string; formula: string; result?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
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
        result: `${formatScore(rec.effect.utilityMagnitude)} ${t.scoreDimensions.utility.toLowerCase()}`,
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
    <div className="rounded-xl border border-white/10 bg-charm-bg/45 p-3">
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
          <p className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-xs leading-relaxed text-charm-muted">
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
            {rec.effect.expectedXpPerHour > 0.5 && <MetricChip label={t.scoreDimensions.xp} value={formatNumber(rec.effect.expectedXpPerHour, locale)} />}
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

function ScoreCalculationPanel({ rec, t, locale }: { rec: CharmRecommendation; t: Dictionary; locale: Locale }) {
  const supplyInput = rec.effect.expectedHealingGainPerHour + rec.effect.expectedManaGainPerHour + rec.effect.expectedManaSavedPerHour;
  const rows: ScoreCalculationRow[] = [
    {
      key: 'damage',
      label: t.scoreDimensions.damage,
      input: rec.effect.expectedDamagePerHour,
      basis: rec.scores.normalisationBasis.damage,
      score: rec.scores.damageScore,
      weight: rec.scores.weights.damage,
    },
    {
      key: 'xp',
      label: t.scoreDimensions.xp,
      input: rec.effect.expectedXpPerHour,
      basis: rec.scores.normalisationBasis.xp,
      score: rec.scores.xpScore,
      weight: rec.scores.weights.xp,
    },
    {
      key: 'profit',
      label: t.scoreDimensions.profit,
      input: rec.effect.expectedProfitPerHour,
      basis: rec.scores.normalisationBasis.profit,
      score: rec.scores.profitScore,
      weight: rec.scores.weights.profit,
    },
    {
      key: 'safety',
      label: t.scoreDimensions.safety,
      input: rec.effect.expectedDamagePreventedPerHour,
      basis: rec.scores.normalisationBasis.safety,
      score: rec.scores.safetyScore,
      weight: rec.scores.weights.safety,
    },
    {
      key: 'supplySaving',
      label: t.scoreDimensions.supplySaving,
      input: supplyInput,
      basis: rec.scores.normalisationBasis.supplySaving,
      score: rec.scores.supplySavingScore,
      weight: rec.scores.weights.supplySaving,
    },
    {
      key: 'utility',
      label: t.scoreDimensions.utility,
      input: rec.effect.utilityMagnitude,
      basis: rec.scores.normalisationBasis.utility,
      score: rec.scores.utilityScore,
      weight: rec.scores.weights.utility,
    },
  ];

  return (
    <div className="mt-2.5 space-y-3">
      <EffectModelPanel rec={rec} t={t} locale={locale} />
      <div className="rounded-xl border border-white/10 bg-charm-bg/45 p-3">
      <p className="text-xs font-semibold text-white">
        {t.results.scoreFormula}: {formatScore(rec.scores.rawTotalScore)} {t.results.metrics.rawScore.toLowerCase()} x{' '}
        {rec.scores.confidenceMultiplier.toFixed(2)} {t.results.scoreConfidenceMultiplier.toLowerCase()} ={' '}
        {formatScore(rec.scores.totalScore)} pts
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-charm-muted">{t.results.scoreNormalisationNote}</p>

      <div className="mt-3 text-[11px]">
        <div className="hidden gap-3 border-b border-white/10 pb-1.5 text-charm-subtle sm:grid sm:grid-cols-[0.9fr_1.35fr_0.9fr_0.8fr_1fr]">
          <span>{t.results.scoreMetric}</span>
          <span>{t.results.scoreInputVsBest}</span>
          <span>{t.results.scoreNormalised}</span>
          <span>{t.results.scoreWeight}</span>
          <span className="text-right">{t.results.scoreContribution}</span>
        </div>
        <div className="divide-y divide-white/10">
          {rows.map((row) => {
            const contribution = row.score * row.weight;
            return (
              <div key={row.key} className="grid grid-cols-2 gap-x-3 gap-y-1 py-2 text-charm-muted sm:grid-cols-[0.9fr_1.35fr_0.9fr_0.8fr_1fr] sm:items-center">
                <span className="col-span-2 font-medium text-white sm:col-span-1">{row.label}</span>
                <span className="sm:whitespace-nowrap">
                  <span className="block text-charm-subtle sm:hidden">{t.results.scoreInputVsBest}</span>
                  {formatInputVsBest(row, t, locale)}
                </span>
                <span>
                  <span className="block text-charm-subtle sm:hidden">{t.results.scoreNormalised}</span>
                  {formatScore(row.score)}
                </span>
                <span>
                  <span className="block text-charm-subtle sm:hidden">{t.results.scoreWeight}</span>
                  {formatPercent(row.weight, row.weight > 0 && row.weight < 0.1 ? 1 : 0)}
                </span>
                <span className="text-white sm:text-right">
                  <span className="block text-charm-subtle sm:hidden">{t.results.scoreContribution}</span>
                  {formatScore(contribution)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="border-t border-white/10 pt-2 font-semibold text-white">
          <div className="flex items-center justify-between gap-3">
            <span>{t.results.metrics.rawScore}</span>
            <span>{formatScore(rec.scores.rawTotalScore)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-charm-primary">
            <span>
              {t.results.scoreConfidenceAdjustment} ({t.results.confidence[rec.confidence]})
            </span>
            <span>
              x {rec.scores.confidenceMultiplier.toFixed(2)} = {formatScore(rec.scores.totalScore)}
            </span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

// Anything closer than this rounds to the same displayed (1-decimal) score
// via formatScore - treated as a tie regardless of any tinier float
// difference underneath, since that's what's actually visible.
const TIE_EPSILON = 0.05;

/**
 * Standard competition ranking (1, 2, 2, 4 - not 1, 2, 2, 3): true ties on
 * total score are common here, not a bug - a charm that's simultaneously the
 * per-creature maximum in both damage and profit (xp/profit scale linearly
 * with damage for one creature) normalises to exactly 100 in both
 * dimensions, so the same charm dominating two different creatures can land
 * on the exact same weighted total. Showing a strict, unbroken 1-2-3-4 here
 * would assert a confidence in the ordering that the math doesn't actually
 * have.
 */
function computeDisplayRanks(recommendations: CharmRecommendation[]): { rank: number; isTied: boolean }[] {
  const ranks: number[] = [];
  for (let i = 0; i < recommendations.length; i++) {
    const tiedWithPrevious = i > 0 && Math.abs(recommendations[i]!.scores.totalScore - recommendations[i - 1]!.scores.totalScore) < TIE_EPSILON;
    ranks.push(tiedWithPrevious ? ranks[i - 1]! : i + 1);
  }
  return recommendations.map((rec, i) => ({
    rank: ranks[i]!,
    isTied:
      (i > 0 && Math.abs(rec.scores.totalScore - recommendations[i - 1]!.scores.totalScore) < TIE_EPSILON) ||
      (i < recommendations.length - 1 && Math.abs(rec.scores.totalScore - recommendations[i + 1]!.scores.totalScore) < TIE_EPSILON),
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
        const scoreWasAdjusted = Math.abs(rec.scores.rawTotalScore - rec.scores.totalScore) > 0.05;
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
            className={`rounded-2xl border p-3.5 transition-colors ${
              rank === 1 && rec.unlocked
                ? 'border-charm-primary/50 bg-charm-primary/10 shadow-glow'
                : 'border-white/10 bg-white/[0.03]'
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
                <summary className="cursor-pointer text-xs font-medium text-charm-primary">{t.results.scoreDetailsTitle}</summary>
                <ScoreCalculationPanel rec={rec} t={t} locale={locale} />
                {rec.scores.damageScore > 0 &&
                  Math.abs(rec.scores.damageScore - rec.scores.xpScore) < TIE_EPSILON &&
                  Math.abs(rec.scores.damageScore - rec.scores.profitScore) < TIE_EPSILON && (
                    <p className="mt-2 text-[11px] leading-relaxed text-charm-subtle">{t.recommendationsPage.identicalSubScoresNote}</p>
                  )}
              </details>
            )}
          </li>
        );
      })}
      </ol>
    </>
  );
}
