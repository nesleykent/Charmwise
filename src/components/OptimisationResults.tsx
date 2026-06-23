'use client';

import { ALL_CHARM_LIST } from '@/data/charms';
import { CharmRankingTable } from '@/components/CharmRankingTable';
import { MissingDataPanel } from '@/components/MissingDataPanel';
import { useLocale } from '@/lib/i18n';
import { formatNumber, formatScore, toTitleCase } from '@/lib/format';
import {
  buildComparisonRows,
  defaultSelectedCharmIds,
  sustainGain,
  type ComparisonRow,
} from '@/lib/recommendationViews';
import { useWorkspace } from '@/lib/workspace';
import type { CharmId, CharmRecommendation, CharmRole, OptimisationMode, ScoreWeights } from '@/types/charm';
import type { HuntOptimisationSummary, CharmPurchaseSuggestion } from '@/types/optimisation';

interface Props {
  summary: HuntOptimisationSummary;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 section-label">{children}</h3>;
}

function roleLabel(role: CharmRole, t: ReturnType<typeof useLocale>['t']): string {
  return t.results.roles[role] ?? role;
}

function primaryGainLabel(row: ComparisonRow, t: ReturnType<typeof useLocale>['t']): string {
  switch (row.role) {
    case 'defensive':
      return t.results.metrics.expectedDamagePreventedPerHour;
    case 'sustain':
      return t.results.metrics.expectedHealingSavedPerHour;
    case 'control':
      return row.recommendation.effect.expectedDamagePreventedPerHour > 0.5
        ? t.results.metrics.expectedDamagePreventedPerHour
        : t.scoreDimensions.utility;
    case 'loot_utility':
      return t.results.metrics.expectedProfitPerHour;
    case 'utility':
      return t.scoreDimensions.utility;
    case 'budget_damage':
    case 'damage':
    default:
      return t.results.metrics.expectedDamagePerHour;
  }
}

function formatGain(row: ComparisonRow, locale: string): string {
  if (row.role === 'utility' || (row.role === 'control' && row.recommendation.effect.expectedDamagePreventedPerHour <= 0.5)) {
    return formatScore(row.mainGain);
  }
  return formatNumber(row.mainGain, locale);
}

function comparisonReason(row: ComparisonRow, t: ReturnType<typeof useLocale>['t']): string {
  const template = t.results.decisionReasons[row.reasonKey] ?? t.results.decisionReasons.damage_gain ?? '{{charm}} is a strong match for {{creature}}.';
  const killShare = (row.recommendation.calculation.killShare * 100).toFixed(1);
  return template
    .replace('{{charm}}', t.charms[row.recommendation.charmId]?.name ?? row.recommendation.name)
    .replace('{{creature}}', toTitleCase(row.recommendation.monsterName))
    .replace('{{share}}', killShare);
}

function flattenRecommendations(summary: HuntOptimisationSummary): CharmRecommendation[] {
  return summary.creatureResults.flatMap((result) => [...result.rankedMajorCharms, ...result.rankedMinorCharms]);
}

function allSelectedRows(summary: HuntOptimisationSummary, view: OptimisationMode, selectedCharmIds: CharmId[], customWeights: ScoreWeights): ComparisonRow[] {
  const all = flattenRecommendations(summary);
  if (view === 'manual' && selectedCharmIds.length === 0) return [];
  const fallbackIds = selectedCharmIds.length > 0 ? selectedCharmIds : defaultSelectedCharmIds(all, view, customWeights);
  return buildComparisonRows(all, view, fallbackIds, customWeights, 10);
}

function CharmSelection({
  selectedCharmIds,
  onChange,
  manualMode,
}: {
  selectedCharmIds: CharmId[];
  onChange: (ids: CharmId[]) => void;
  manualMode: boolean;
}) {
  const { t } = useLocale();
  const selected = new Set(selectedCharmIds);
  const toggle = (charmId: CharmId) => {
    if (selected.has(charmId)) onChange(selectedCharmIds.filter((id) => id !== charmId));
    else onChange([...selectedCharmIds, charmId]);
  };

  return (
    <div className="rounded-lg border border-charm-border bg-charm-surfaceAlt/55 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">{t.results.chooseCharmsTitle}</p>
        {selectedCharmIds.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-xs font-medium text-charm-primary hover:text-white">
            {t.results.clearSelection}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-charm-muted">
        {selectedCharmIds.length > 0 ? t.results.chooseCharmsManualNote : manualMode ? t.results.chooseCharmsManualEmptyNote : t.results.chooseCharmsDefaultNote}
      </p>
      <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-y-auto pr-1">
        {ALL_CHARM_LIST.map((charm) => {
          const active = selected.has(charm.id);
          return (
            <button
              key={charm.id}
              type="button"
              onClick={() => toggle(charm.id)}
              aria-pressed={active}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'border-charm-primary bg-charm-primary text-white shadow-glow'
                  : 'border-charm-border bg-charm-bg/45 text-charm-muted hover:border-charm-primary/50 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              {active ? '✓ ' : '+ '}
              {t.charms[charm.id]?.name ?? charm.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CustomWeightsEditor({ value, onChange }: { value: ScoreWeights; onChange: (weights: ScoreWeights) => void }) {
  const { t } = useLocale();
  const entries: { key: keyof ScoreWeights; label: string }[] = [
    { key: 'damage', label: t.scoreDimensions.damage },
    { key: 'profit', label: t.scoreDimensions.profit },
    { key: 'safety', label: t.scoreDimensions.safety },
    { key: 'supplySaving', label: t.scoreDimensions.supplySaving },
    { key: 'utility', label: t.scoreDimensions.utility },
  ];

  return (
    <div className="rounded-lg border border-charm-border bg-charm-surfaceAlt/55 p-4">
      <p className="text-sm font-semibold text-white">{t.results.customWeightsTitle}</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
        {entries.map(({ key, label }) => (
          <label key={key} className="text-xs text-charm-muted">
            <span className="mb-1 block">{label}</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={value[key]}
              onChange={(e) => onChange({ ...value, [key]: Math.max(0, Math.min(1, Number(e.target.value) || 0)) })}
              className="field-input px-2 py-1 text-xs"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function FinalRecommendation({ row, showNoUnlockedNotice }: { row: ComparisonRow | undefined; showNoUnlockedNotice: boolean }) {
  const { t, locale } = useLocale();
  if (!row) {
    return (
      <section className="card border-charm-warning/35 p-5">
        <SectionHeading>{t.results.finalRecommendation}</SectionHeading>
        {showNoUnlockedNotice && (
          <p className="mb-3 rounded-lg border border-charm-primary/30 bg-charm-primary/10 p-3 text-sm text-white">{t.results.noUnlockedCharmNotice}</p>
        )}
        <p className="text-sm text-charm-muted">{t.results.noMeaningfulComparison}</p>
      </section>
    );
  }

  return (
    <section className="card border-charm-primary/45 bg-[linear-gradient(135deg,rgba(10,132,255,0.14),rgba(17,20,25,0.72)_38%)] p-5 sm:p-6">
      <SectionHeading>{t.results.finalRecommendation}</SectionHeading>
      {showNoUnlockedNotice && (
        <p className="mb-4 rounded-lg border border-charm-primary/30 bg-charm-primary/10 p-3 text-sm text-white">{t.results.noUnlockedCharmNotice}</p>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.72fr)] lg:items-center">
        <div className="flex gap-4">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-charm-primary/35 bg-charm-primary/15 text-xl font-semibold text-charm-primary shadow-glow"
          >
            {row.recommendation.category === 'major' ? 'M' : 'm'}
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-semibold tracking-tight text-white">{t.charms[row.recommendation.charmId]?.name ?? row.recommendation.name}</p>
            <p className="mt-1 text-sm text-charm-muted">
              {toTitleCase(row.recommendation.monsterName)} · {roleLabel(row.role, t)} · {t.characterForm.tierNames[row.recommendation.tier - 1]}
              {!row.recommendation.unlocked ? ` · ${t.characterForm.tierLocked}` : ''}
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-charm-muted">{comparisonReason(row, t)}</p>
            {row.role !== 'damage' && row.role !== 'budget_damage' && (
              <p className="mt-2 text-xs leading-relaxed text-charm-warning">{t.results.nonDamageReasonDisclosure}</p>
            )}
          </div>
        </div>
        <div className="border-charm-border lg:border-l lg:pl-5">
          <p className="text-sm font-semibold text-white">{t.results.whyThisIsBest}</p>
          <p className="mt-1 text-sm text-charm-muted">{t.results.whyThisIsBestBody.replace('{{signal}}', primaryGainLabel(row, t))}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-charm-border bg-charm-bg/45 p-3">
              <div className="text-[10px] uppercase tracking-wide text-charm-subtle">{primaryGainLabel(row, t)}</div>
              <div className="mt-1 text-lg font-semibold text-white">{formatGain(row, locale)}</div>
            </div>
            <div className="rounded-lg border border-charm-border bg-charm-bg/45 p-3">
              <div className="text-[10px] uppercase tracking-wide text-charm-subtle">{t.results.comparisonCost}</div>
              <div className="mt-1 text-lg font-semibold text-white">
                {formatNumber(row.cost, locale)} {row.recommendation.category === 'major' ? 'CP' : 'MCE'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ComparisonTable({ rows }: { rows: ComparisonRow[] }) {
  const { t, locale } = useLocale();

  if (rows.length === 0) return <p className="rounded-lg border border-charm-border bg-white/[0.025] p-4 text-sm text-charm-muted">{t.results.noMeaningfulComparison}</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-charm-border bg-charm-surface/55">
      <table className="w-full min-w-full text-left text-xs sm:min-w-[920px]">
        <thead className="bg-white/[0.035] text-[10px] uppercase tracking-wide text-charm-subtle">
          <tr>
            <th className="px-3 py-2">{t.results.comparisonCharm}</th>
            <th className="px-3 py-2">{t.results.comparisonCreature}</th>
            <th className="px-3 py-2">{t.results.comparisonRole}</th>
            <th className="px-3 py-2">{t.results.comparisonTier}</th>
            <th className="px-3 py-2">{t.results.comparisonMainGain}</th>
            <th className="px-3 py-2">{t.results.comparisonCost}</th>
            <th className="px-3 py-2">{t.results.comparisonEfficiency}</th>
            <th className="px-3 py-2">{t.results.comparisonConfidence}</th>
            <th className="px-3 py-2">{t.results.comparisonReason}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-charm-border">
          {rows.map((row) => {
            const rec = row.recommendation;
            return (
              <tr key={`${rec.charmId}-${rec.monsterName}-${rec.tier}`} className="align-top text-charm-muted">
                <td className="px-3 py-3 font-semibold text-white">
                  {t.charms[rec.charmId]?.name ?? rec.name}
                  {row.tieState && (
                    <span className="ml-2 rounded-md border border-charm-primary/40 px-1.5 py-0.5 text-[10px] font-medium text-charm-primary">
                      {row.tieState === 'same_rank' ? t.results.sameRank : t.results.effectivelyTied}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-white">{toTitleCase(rec.monsterName)}</td>
                <td className="px-3 py-3">{roleLabel(row.role, t)}</td>
                <td className="px-3 py-3">
                  {t.characterForm.tierNames[rec.tier - 1]}
                  {!rec.unlocked ? ` · ${t.characterForm.tierLocked}` : ''}
                </td>
                <td className="px-3 py-3">
                  <span className="block font-semibold text-white">{formatGain(row, locale)}</span>
                  <span className="text-[10px] text-charm-subtle">{primaryGainLabel(row, t)}</span>
                </td>
                <td className="px-3 py-3">
                  {formatNumber(row.cost, locale)} {rec.category === 'major' ? 'CP' : 'MCE'}
                </td>
                <td className="px-3 py-3">{row.efficiency !== null && row.efficiency > 0 ? formatScore(row.efficiency) : '-'}</td>
                <td className="px-3 py-3">{t.results.confidence[rec.confidence]}</td>
                <td className="px-3 py-3 leading-relaxed">{comparisonReason(row, t)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PerCreatureSummary({ summary, view, selectedCharmIds, customWeights }: { summary: HuntOptimisationSummary; view: OptimisationMode; selectedCharmIds: CharmId[]; customWeights: ScoreWeights }) {
  const { t, locale } = useLocale();

  return (
    <section>
      <SectionHeading>{t.results.perCreatureTitle}</SectionHeading>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {summary.creatureResults.map((result) => {
          if (!result.hasBestiaryData) {
            return (
              <div key={result.monsterName} className="rounded-lg border border-charm-danger/30 bg-charm-danger/5 p-3 text-sm text-charm-danger">
                {toTitleCase(result.monsterName)}: {t.messages.no_bestiary_match}
              </div>
            );
          }
          const creatureRows = buildComparisonRows([...result.rankedMajorCharms, ...result.rankedMinorCharms], view, selectedCharmIds, customWeights, 1);
          const row = creatureRows[0];
          return (
            <div key={result.monsterName} className="rounded-lg border border-charm-border bg-white/[0.025] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-white">{toTitleCase(result.monsterName)}</p>
                <span className="text-xs text-charm-subtle">
                  {formatNumber(result.huntStat.kills, locale)} kills · {(result.huntStat.killShare * 100).toFixed(1)}%
                </span>
              </div>
              {row ? (
                <p className="mt-2 text-sm text-charm-muted">
                  <span className="font-semibold text-white">{t.charms[row.recommendation.charmId]?.name}</span> · {roleLabel(row.role, t)} ·{' '}
                  {formatGain(row, locale)} {primaryGainLabel(row, t).toLowerCase()}
                </p>
              ) : (
                <p className="mt-2 text-sm text-charm-subtle">{t.results.noMeaningfulComparison}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function suggestionReason(suggestion: CharmPurchaseSuggestion, recommendations: CharmRecommendation[], locale: string): string {
  const rec = recommendations.find((r) => r.charmId === suggestion.charmId && r.monsterName === suggestion.monsterName);
  if (!rec) return `${formatNumber(suggestion.scoreGain, locale)} score gain`;
  const share = (rec.calculation.killShare * 100).toFixed(1);
  if (rec.effect.expectedDamagePerHour > 0.5) return `${formatNumber(rec.effect.expectedDamagePerHour, locale)} damage/h on ${share}% of this hunt`;
  if (rec.effect.expectedDamagePreventedPerHour > 0.5) return `${formatNumber(rec.effect.expectedDamagePreventedPerHour, locale)} prevented damage/h`;
  if (sustainGain(rec) > 0.5) return `${formatNumber(sustainGain(rec), locale)} sustain/h`;
  if (rec.effect.expectedProfitPerHour > 0.5) return `${formatNumber(rec.effect.expectedProfitPerHour, locale)} profit/h`;
  return `${formatNumber(suggestion.scoreGain, locale)} score gain`;
}

function PurchaseSuggestions({ title, suggestions, recommendations, currency }: { title: string; suggestions: CharmPurchaseSuggestion[]; recommendations: CharmRecommendation[]; currency: 'CP' | 'MCE' }) {
  const { t, locale } = useLocale();
  const actionable = suggestions.filter((s) => s.scoreGain > 0.05 && s.scorePerCost > 0).slice(0, 5);

  return (
    <section>
      <SectionHeading>{title}</SectionHeading>
      {actionable.length === 0 ? (
        <p className="rounded-lg border border-charm-border bg-white/[0.025] p-4 text-sm text-charm-subtle">{t.results.noActionableUpgrades}</p>
      ) : (
        <ul className="divide-y divide-charm-border rounded-lg border border-charm-border bg-white/[0.025] text-sm">
          {actionable.map((s) => (
            <li key={`${s.charmId}-${s.monsterName}-${s.toTier}`} className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-white">
                  {t.charms[s.charmId]?.name} T{s.fromTier}&rarr;T{s.toTier} {t.results.linkingFor} {toTitleCase(s.monsterName)}
                </p>
                <span className="text-xs text-charm-primary">
                  {formatNumber(s.cost, locale)} {currency}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-charm-muted">{suggestionReason(s, recommendations, locale)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function OptimisationResults({ summary }: Props) {
  const { t } = useLocale();
  const { mode, selectedCharmIds, setSelectedCharmIds, customWeights, setCustomWeights, character } = useWorkspace();
  const allRecommendations = flattenRecommendations(summary);
  const comparisonRows = allSelectedRows(summary, mode, selectedCharmIds, customWeights);
  const finalRows = buildComparisonRows(allRecommendations, mode, mode === 'manual' ? selectedCharmIds : [], customWeights, 1);
  const hasAnyUnlockedCharms = character.unlockedMajorCharms.length > 0 || character.unlockedMinorCharms.length > 0;

  return (
    <div className="space-y-6">
      <FinalRecommendation row={finalRows[0]} showNoUnlockedNotice={!hasAnyUnlockedCharms} />

      <section className="space-y-3">
        <SectionHeading>{t.results.selectedComparison}</SectionHeading>
        <CharmSelection selectedCharmIds={selectedCharmIds} onChange={setSelectedCharmIds} manualMode={mode === 'manual'} />
        {mode === 'custom' && <CustomWeightsEditor value={customWeights} onChange={setCustomWeights} />}
        <ComparisonTable rows={comparisonRows} />
      </section>

      <PerCreatureSummary summary={summary} view={mode} selectedCharmIds={selectedCharmIds} customWeights={customWeights} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PurchaseSuggestions
          title={t.results.charmPointBudget}
          suggestions={summary.charmPointBudget.suggestions}
          recommendations={allRecommendations}
          currency="CP"
        />
        <PurchaseSuggestions
          title={t.results.minorEchoBudget}
          suggestions={summary.minorEchoBudget.suggestions}
          recommendations={allRecommendations}
          currency="MCE"
        />
      </div>

      <details className="group rounded-lg border border-charm-border bg-white/[0.025] p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-white marker:content-none">
          {t.results.advancedFullRanking}
          <span className="text-charm-subtle transition-transform group-open:rotate-90">&rsaquo;</span>
        </summary>
        <div className="mt-4">
          <CharmRankingTable recommendations={summary.rankedAlternatives} showCreatureName />
        </div>
      </details>

      <details className="group rounded-lg border border-charm-border bg-white/[0.025] p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-white marker:content-none">
          {t.results.formulaDebugDetails}
          <span className="text-charm-subtle transition-transform group-open:rotate-90">&rsaquo;</span>
        </summary>
        <div className="mt-4">
          <CharmRankingTable recommendations={comparisonRows.map((row) => row.recommendation)} showCreatureName detailed />
        </div>
      </details>

      <MissingDataPanel
        creaturesLackingBestiaryData={summary.creaturesLackingBestiaryData}
        creaturesNeedingManualReview={summary.creaturesNeedingManualReview}
      />
    </div>
  );
}
