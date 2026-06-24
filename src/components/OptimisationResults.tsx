'use client';

import { ALL_CHARM_LIST } from '@/data/charms';
import { CharmRankingTable } from '@/components/CharmRankingTable';
import { MissingDataPanel } from '@/components/MissingDataPanel';
import { useLocale } from '@/lib/i18n';
import { formatNumber, formatScore, toTitleCase } from '@/lib/format';
import {
  buildComparisonRows,
  defaultSelectedCharmIds,
  formatGain,
  primaryGainLabel,
  roleLabel,
  sustainGain,
  VIEW_TO_ROLE,
  type ComparisonRow,
} from '@/lib/recommendationViews';
import { useWorkspace } from '@/lib/workspace';
import type { CharmId, CharmRecommendation, CharmRole, OptimisationMode } from '@/types/charm';
import type { HuntOptimisationSummary, CharmPurchaseSuggestion } from '@/types/optimisation';

interface Props {
  summary: HuntOptimisationSummary;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 section-label">{children}</h3>;
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

function allSelectedRows(summary: HuntOptimisationSummary, view: OptimisationMode, selectedCharmIds: CharmId[]): ComparisonRow[] {
  const all = flattenRecommendations(summary);
  if (view === 'manual' && selectedCharmIds.length === 0) return [];
  const fallbackIds = selectedCharmIds.length > 0 ? selectedCharmIds : defaultSelectedCharmIds(all, view);
  return buildComparisonRows(all, view, fallbackIds, 10);
}

/** Reads the already assignment-solved pick for the active view's role (never re-ranks) - falling back to the damage-first default pick for views with no dedicated role (damage_first, manual, legacy modes). This is what keeps every role view free of the "same Charm recommended to two creatures at once" bug, not just the default. */
function bestForView(
  byRole: Partial<Record<CharmRole, CharmRecommendation>>,
  fallback: CharmRecommendation | null,
  view: OptimisationMode,
): CharmRecommendation | null {
  const role = VIEW_TO_ROLE[view];
  if (!role) return fallback;
  return byRole[role] ?? null;
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
    <div className="glass-panel p-5">
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
              className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                active
                  ? 'border-white/25 bg-white/[0.2] text-white shadow-glow'
                  : 'border-white/[0.12] bg-white/[0.045] text-charm-muted hover:border-white/[0.24] hover:bg-white/[0.09] hover:text-white hover:opacity-90'
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

function FinalRecommendation({ row, showNoUnlockedNotice }: { row: ComparisonRow | undefined; showNoUnlockedNotice: boolean }) {
  const { t, locale } = useLocale();
  if (!row) {
    return (
      <section className="glass-panel border-charm-warning/35 p-5">
        <SectionHeading>{t.results.finalRecommendation}</SectionHeading>
        {showNoUnlockedNotice && (
          <p className="mb-3 rounded-xl border border-white/15 bg-white/[0.09] p-3 text-sm text-white backdrop-blur-xl">{t.results.noUnlockedCharmNotice}</p>
        )}
        <p className="text-sm text-charm-muted">{t.results.noMeaningfulComparison}</p>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/20 bg-white/[0.08] p-4 shadow-glow backdrop-blur-xl sm:p-5">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_0%_10%,rgba(254,225,64,0.28),transparent_22rem),radial-gradient(circle_at_14%_42%,rgba(253,89,73,0.34),transparent_22rem),radial-gradient(circle_at_96%_12%,rgba(214,36,159,0.2),transparent_21rem),radial-gradient(circle_at_98%_86%,rgba(40,90,235,0.28),transparent_25rem)]" />
      <div aria-hidden="true" className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
      <SectionHeading>{t.results.finalRecommendation}</SectionHeading>
      {showNoUnlockedNotice && (
        <p className="mb-4 rounded-2xl border border-white/[0.18] bg-white/[0.1] p-3 text-sm text-white shadow-card backdrop-blur-xl">{t.results.noUnlockedCharmNotice}</p>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.72fr)] lg:items-center">
        <div className="flex gap-4">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/[0.12] text-2xl font-semibold text-charm-accent shadow-glow backdrop-blur-xl"
          >
            {row.recommendation.category === 'major' ? 'M' : 'm'}
          </div>
          <div className="min-w-0">
            <p className="font-display text-5xl font-semibold leading-none tracking-tight text-white sm:text-5xl">{t.charms[row.recommendation.charmId]?.name ?? row.recommendation.name}</p>
            <p className="mt-1 text-sm text-charm-muted">
              {toTitleCase(row.recommendation.monsterName)} · {roleLabel(row.role, t)} · {t.characterForm.tierNames[row.recommendation.tier - 1]}
              {!row.recommendation.unlocked ? ` · ${t.characterForm.tierLocked}` : ''}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-charm-muted">{comparisonReason(row, t)}</p>
            {row.role !== 'damage' && row.role !== 'budget_damage' && (
              <p className="mt-2 text-xs leading-relaxed text-charm-warning">{t.results.nonDamageReasonDisclosure}</p>
            )}
          </div>
        </div>
        <div className="border-white/15 lg:border-l lg:pl-6">
          <p className="text-sm font-semibold text-white">{t.results.whyThisIsBest}</p>
          <p className="mt-1 text-sm text-charm-muted">
            {t.results.whyThisIsBestBody.replace('{{signal}}', primaryGainLabel(row.role, row.recommendation.effect.expectedDamagePreventedPerHour, t))}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/15 bg-white/[0.075] p-3 shadow-card backdrop-blur-xl">
              <div className="text-[10px] uppercase tracking-wide text-charm-subtle">
                {primaryGainLabel(row.role, row.recommendation.effect.expectedDamagePreventedPerHour, t)}
              </div>
              <div className="mt-1 text-lg font-semibold text-white">{formatGain(row.role, row.mainGain, row.recommendation.effect.expectedDamagePreventedPerHour, locale)}</div>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/[0.075] p-3 shadow-card backdrop-blur-xl">
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

  if (rows.length === 0) return <p className="glass-panel p-4 text-sm text-charm-muted">{t.results.noMeaningfulComparison}</p>;

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/15 bg-white/[0.065] shadow-card backdrop-blur-xl">
      <table className="w-full min-w-full text-left text-xs sm:min-w-[920px]">
        <thead className="bg-white/[0.075] text-[10px] uppercase tracking-wide text-charm-subtle">
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
        <tbody className="divide-y divide-white/10">
          {rows.map((row) => {
            const rec = row.recommendation;
            return (
              <tr key={`${rec.charmId}-${rec.monsterName}-${rec.tier}`} className="align-top text-charm-muted">
                <td className="px-3 py-3 font-semibold text-white">
                  {t.charms[rec.charmId]?.name ?? rec.name}
                  {row.tieState && (
                    <span className="ml-2 rounded-lg border border-white/20 px-1.5 py-0.5 text-[10px] font-medium text-charm-accent">
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
                  <span className="block font-semibold text-white">{formatGain(row.role, row.mainGain, rec.effect.expectedDamagePreventedPerHour, locale)}</span>
                  <span className="text-[10px] text-charm-subtle">{primaryGainLabel(row.role, rec.effect.expectedDamagePreventedPerHour, t)}</span>
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

function CreatureCharmLine({ rec, t, locale }: { rec: CharmRecommendation; t: ReturnType<typeof useLocale>['t']; locale: string }) {
  return (
    <p className="mt-2 text-sm text-charm-muted">
      <span className="font-semibold text-white">{t.charms[rec.charmId]?.name ?? rec.name}</span> · {roleLabel(rec.role, t)} ·{' '}
      {formatGain(rec.role, rec.roleMetric, rec.effect.expectedDamagePreventedPerHour, locale)}{' '}
      {primaryGainLabel(rec.role, rec.effect.expectedDamagePreventedPerHour, t).toLowerCase()}
    </p>
  );
}

/**
 * Reads `bestMajorCharm(ByRole)`/`bestMinorCharm(ByRole)` - the globally
 * assignment-solved, conflict-free picks (see optimiseCharms.ts) - for
 * whichever role the active view maps to, instead of independently
 * re-ranking each creature's charms. Re-ranking per creature is what
 * previously let the same Charm show up as "the pick" for two different
 * creatures at once, since a charm can only actually be assigned to one of
 * them; reading the already-solved assignment makes that impossible in
 * every view, not just the default.
 */
function PerCreatureSummary({ summary, view }: { summary: HuntOptimisationSummary; view: OptimisationMode }) {
  const { t, locale } = useLocale();

  return (
    <section>
      <SectionHeading>{t.results.perCreatureTitle}</SectionHeading>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {summary.creatureResults.map((result) => {
          if (!result.hasBestiaryData) {
            return (
              <div key={result.monsterName} className="rounded-2xl border border-charm-danger/30 bg-charm-danger/10 p-3 text-sm text-charm-danger backdrop-blur-xl">
                {toTitleCase(result.monsterName)}: {t.messages.no_bestiary_match}
              </div>
            );
          }
          const major = bestForView(result.bestMajorCharmByRole, result.bestMajorCharm, view);
          const minor = bestForView(result.bestMinorCharmByRole, result.bestMinorCharm, view);
          return (
            <div key={result.monsterName} className="rounded-2xl border border-white/15 bg-white/[0.055] p-3 shadow-card backdrop-blur-xl">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-white">{toTitleCase(result.monsterName)}</p>
                <span className="text-xs text-charm-subtle">
                  {formatNumber(result.huntStat.kills, locale)} kills · {(result.huntStat.killShare * 100).toFixed(1)}%
                </span>
              </div>
              {major || minor ? (
                <>
                  {major && <CreatureCharmLine rec={major} t={t} locale={locale} />}
                  {minor && <CreatureCharmLine rec={minor} t={t} locale={locale} />}
                </>
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

function suggestionReason(suggestion: CharmPurchaseSuggestion, recommendations: CharmRecommendation[], t: ReturnType<typeof useLocale>['t'], locale: string): string {
  const rec = recommendations.find((r) => r.charmId === suggestion.charmId && r.monsterName === suggestion.monsterName);
  const share = rec ? (rec.calculation.killShare * 100).toFixed(1) : null;
  const gainLabel = primaryGainLabel(suggestion.role, rec?.effect.expectedDamagePreventedPerHour ?? 0, t).toLowerCase();
  return share !== null
    ? `${formatGain(suggestion.role, suggestion.metricGain, rec?.effect.expectedDamagePreventedPerHour ?? 0, locale)} ${gainLabel} on ${share}% of this hunt`
    : `${formatGain(suggestion.role, suggestion.metricGain, 0, locale)} ${gainLabel}`;
}

function PurchaseSuggestions({ title, suggestions, recommendations, currency }: { title: string; suggestions: CharmPurchaseSuggestion[]; recommendations: CharmRecommendation[]; currency: 'CP' | 'MCE' }) {
  const { t, locale } = useLocale();
  const actionable = suggestions.filter((s) => s.metricGain > 0.05 && s.metricPerCost > 0).slice(0, 5);

  return (
    <section>
      <SectionHeading>{title}</SectionHeading>
      {actionable.length === 0 ? (
        <p className="glass-panel p-4 text-sm text-charm-subtle">{t.results.noActionableUpgrades}</p>
      ) : (
        <ul className="divide-y divide-white/10 rounded-2xl border border-white/15 bg-white/[0.055] text-sm shadow-card backdrop-blur-xl">
          {actionable.map((s) => (
            <li key={`${s.charmId}-${s.monsterName}-${s.toTier}`} className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-white">
                  {t.charms[s.charmId]?.name} T{s.fromTier}&rarr;T{s.toTier} {t.results.linkingFor} {toTitleCase(s.monsterName)}
                </p>
                <span className="text-xs text-charm-accent">
                  {formatNumber(s.cost, locale)} {currency}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-charm-muted">{suggestionReason(s, recommendations, t, locale)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function OptimisationResults({ summary }: Props) {
  const { t } = useLocale();
  const { mode, selectedCharmIds, setSelectedCharmIds, character } = useWorkspace();
  const allRecommendations = flattenRecommendations(summary);
  const comparisonRows = allSelectedRows(summary, mode, selectedCharmIds);
  const finalRows = buildComparisonRows(allRecommendations, mode, mode === 'manual' ? selectedCharmIds : [], 1);
  const hasAnyUnlockedCharms = character.unlockedMajorCharms.length > 0 || character.unlockedMinorCharms.length > 0;

  return (
    <div className="space-y-6">
      <FinalRecommendation row={finalRows[0]} showNoUnlockedNotice={!hasAnyUnlockedCharms} />

      <section className="space-y-3">
        <SectionHeading>{t.results.selectedComparison}</SectionHeading>
        <CharmSelection selectedCharmIds={selectedCharmIds} onChange={setSelectedCharmIds} manualMode={mode === 'manual'} />
        <ComparisonTable rows={comparisonRows} />
      </section>

      <PerCreatureSummary summary={summary} view={mode} />

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

      <details className="group rounded-2xl border border-white/15 bg-white/[0.055] p-4 shadow-card backdrop-blur-xl">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-white marker:content-none">
          {t.results.advancedFullRanking}
          <span className="text-charm-subtle transition-transform group-open:rotate-90">&rsaquo;</span>
        </summary>
        <div className="mt-4">
          <CharmRankingTable recommendations={summary.rankedAlternatives} showCreatureName />
        </div>
      </details>

      <details className="group rounded-2xl border border-white/15 bg-white/[0.055] p-4 shadow-card backdrop-blur-xl">
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
