'use client';

import { CharmRankingTable } from '@/components/CharmRankingTable';
import { MissingDataPanel } from '@/components/MissingDataPanel';
import { RecommendationScopeToggle } from '@/components/RecommendationScopeToggle';
import { useLocale } from '@/lib/i18n';
import { formatNumber, formatScore, toTitleCase } from '@/lib/format';
import { formatMessage } from '@/lib/messages';
import { useWorkspace } from '@/lib/workspace';
import type { HuntOptimisationSummary } from '@/types/optimisation';

interface Props {
  summary: HuntOptimisationSummary;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-charm-subtle">{children}</h3>;
}

function SummaryCard({ title, value, accent }: { title: string; value: string; accent?: boolean }) {
  return (
    <div className={`card p-4 ${accent ? 'border-charm-primary/50 bg-charm-primary/5' : ''}`}>
      <div className="text-xs uppercase tracking-wide text-charm-subtle">{title}</div>
      <div className="mt-1 text-xl font-bold text-white">{value}</div>
    </div>
  );
}

export function OptimisationResults({ summary }: Props) {
  const { t, locale } = useLocale();
  const { scope, setScope, character } = useWorkspace();
  const improvement = summary.expectedImprovementSummary;

  const hasAnyUnlockedCharms = character.unlockedMajorCharms.length > 0 || character.unlockedMinorCharms.length > 0;
  const improvementIsZero =
    improvement.extraDamagePerHour === 0 &&
    improvement.extraProfitPerHour === 0 &&
    improvement.extraDamagePreventedPerHour === 0 &&
    improvement.extraHealingSavedPerHour === 0;
  // Three distinct reasons every number below can read as 0/empty - stating
  // which one applies is the actual fix for "0/6 but there are
  // recommendations everywhere": those recommendations are about Charms
  // that aren't unlocked yet, which this summary (current vs. achievable
  // right now) correctly excludes.
  const improvementState: 'nothing_unlocked' | 'already_optimal' | 'has_gain' = !hasAnyUnlockedCharms
    ? 'nothing_unlocked'
    : improvementIsZero
      ? 'already_optimal'
      : 'has_gain';

  return (
    <div className="space-y-8">
      <section>
        <SectionHeading>{t.results.improvementSummary}</SectionHeading>
        <p className="mb-3 max-w-2xl text-xs leading-relaxed text-charm-muted">
          {improvementState === 'nothing_unlocked'
            ? t.results.improvementStateNothingUnlocked
            : improvementState === 'already_optimal'
              ? t.results.improvementStateAlreadyOptimal
              : t.results.improvementStateHasGain}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard title={t.results.metrics.expectedDamagePerHour} value={formatNumber(improvement.extraDamagePerHour, locale)} accent />
          <SummaryCard title={t.results.metrics.expectedProfitPerHour} value={formatNumber(improvement.extraProfitPerHour, locale)} />
          <SummaryCard
            title={t.results.metrics.expectedDamagePreventedPerHour}
            value={formatNumber(improvement.extraDamagePreventedPerHour, locale)}
          />
          <SummaryCard title={t.results.metrics.expectedHealingSavedPerHour} value={formatNumber(improvement.extraHealingSavedPerHour, locale)} />
        </div>
      </section>

      <section>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <SectionHeading>{t.results.perCreatureTitle}</SectionHeading>
          <RecommendationScopeToggle value={scope} onChange={setScope} ariaLabel={t.results.perCreatureTitle} />
        </div>
        <p className="mb-3 max-w-2xl text-xs leading-relaxed text-charm-muted">{t.results.perCreatureDescription}</p>
        <div className="space-y-4">
          {summary.creatureResults.map((result) => {
            const bestMajor = scope === 'full_analysis' ? result.bestMajorCharmOverall : result.bestMajorCharm;
            const bestMinor = scope === 'full_analysis' ? result.bestMinorCharmOverall : result.bestMinorCharm;
            // The best alternative that ISN'T the recommended pick - whether
            // that's simply the #2 ranked Charm, or (when this creature lost
            // its independent #1 pick to a stronger claim elsewhere) the #1
            // ranked Charm itself. Showing it alongside the recommendation is
            // the actual answer to "why this Charm and not that one."
            const runnerUpMajor = result.rankedMajorCharms.find((r) => r.charmId !== bestMajor?.charmId) ?? null;
            const runnerUpMinor = result.rankedMinorCharms.find((r) => r.charmId !== bestMinor?.charmId) ?? null;
            const majorRows = [bestMajor, runnerUpMajor].filter((r): r is NonNullable<typeof r> => r !== null);
            const minorRows = [bestMinor, runnerUpMinor].filter((r): r is NonNullable<typeof r> => r !== null);
            return (
              <div key={result.monsterName} className="card p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-white">{toTitleCase(result.monsterName)}</h4>
                  <span className="text-xs text-charm-subtle">
                    {formatNumber(result.huntStat.kills, locale)} kills ({(result.huntStat.killShare * 100).toFixed(1)}%)
                  </span>
                </div>
                {!result.hasBestiaryData ? (
                  <p className="mt-2 text-xs text-charm-danger">{result.warnings[0] ? formatMessage(t, result.warnings[0]) : null}</p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-charm-muted">{t.results.bestMajor}</p>
                      <CharmRankingTable recommendations={majorRows} emptyMessage={t.results.noMajorUnlocked} detailed />
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-charm-muted">{t.results.bestMinor}</p>
                      <CharmRankingTable recommendations={minorRows} emptyMessage={t.results.noMinorUnlocked} detailed />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeading>{t.results.slotLimitTitle}</SectionHeading>
        <p className="mb-2 text-xs text-charm-muted">{t.results.slotLimitDescription}</p>
        <div className="card p-4 text-sm">
          <p className="text-white">
            {summary.majorCharmSlotPlan.slotLimit === null
              ? `${summary.majorCharmSlotPlan.recommendedSlots.length} / ∞`
              : `${summary.majorCharmSlotPlan.recommendedSlots.length} / ${summary.majorCharmSlotPlan.slotLimit}`}
          </p>
          {summary.majorCharmSlotPlan.recommendedSlots.length === 0 && (
            <p className="mt-1.5 text-xs text-charm-subtle">
              {character.unlockedMajorCharms.length > 0 ? t.results.slotsEmptyNoValue : t.results.slotsEmptyNothingUnlocked}
            </p>
          )}
          <ul className="mt-2 space-y-1 text-xs text-charm-muted">
            {summary.majorCharmSlotPlan.recommendedSlots.map((slot) => (
              <li key={slot.monsterName}>
                <span className="text-white">{toTitleCase(slot.monsterName)}</span> &rarr; {t.charms[slot.charmId]?.name}
              </li>
            ))}
          </ul>
          {summary.majorCharmSlotPlan.unassignedCandidates.length > 0 && (
            <div className="mt-3 border-t border-white/10 pt-2.5 text-xs text-charm-warning">
              {summary.majorCharmSlotPlan.unassignedCandidates.map((c) => (
                <p key={c.monsterName}>
                  {toTitleCase(c.monsterName)}: {formatMessage(t, c.reason)}
                </p>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <SectionHeading>
            {t.results.charmPointBudget} ({formatNumber(summary.charmPointBudget.available, locale)})
          </SectionHeading>
          {summary.charmPointBudget.suggestions.length === 0 ? (
            <p className="text-sm text-charm-subtle">-</p>
          ) : (
            <ul className="card divide-y divide-white/10 text-xs">
              {summary.charmPointBudget.suggestions.map((s, i) => (
                <li key={i} className="p-3">
                  <span className="font-semibold text-white">{t.charms[s.charmId]?.name}</span> T{s.fromTier}&rarr;T{s.toTier} {t.results.linkingFor}{' '}
                  <span className="text-white">{toTitleCase(s.monsterName)}</span> - {formatNumber(s.cost, locale)} CP ({formatScore(s.scorePerCost)} pts/CP)
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <SectionHeading>
            {t.results.minorEchoBudget} ({formatNumber(summary.minorEchoBudget.available, locale)})
          </SectionHeading>
          {summary.minorEchoBudget.suggestions.length === 0 ? (
            <p className="text-sm text-charm-subtle">-</p>
          ) : (
            <ul className="card divide-y divide-white/10 text-xs">
              {summary.minorEchoBudget.suggestions.map((s, i) => (
                <li key={i} className="p-3">
                  <span className="font-semibold text-white">{t.charms[s.charmId]?.name}</span> T{s.fromTier}&rarr;T{s.toTier} {t.results.linkingFor}{' '}
                  <span className="text-white">{toTitleCase(s.monsterName)}</span> - {formatNumber(s.cost, locale)} MCE ({formatScore(s.scorePerCost)} pts/MCE)
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {summary.reassignmentSuggestions.length > 0 && (
        <section>
          <SectionHeading>{t.results.reassignmentsTitle}</SectionHeading>
          <ul className="card divide-y divide-white/10 text-xs">
            {summary.reassignmentSuggestions.map((r, i) => (
              <li key={i} className="p-3">
                <span className="text-white">{toTitleCase(r.monsterName)}</span>: {r.fromCharmId ? t.charms[r.fromCharmId]?.name : t.characterForm.tierLocked}{' '}
                &rarr; {t.charms[r.toCharmId]?.name} (+{formatScore(r.netScoreGain)} pts, {formatNumber(r.removalCost, locale)} gold)
              </li>
            ))}
          </ul>
          <div className="mt-3 card p-4 text-xs text-charm-muted">
            <p>
              {t.results.removalCost}: {formatNumber(summary.economics.totalRemovalCost, locale)} gold
            </p>
            <p>
              {t.results.resetCost}: {summary.economics.resetIsFree ? t.results.resetFree : `${formatNumber(summary.economics.resetCost, locale)} gold`}
            </p>
            <p className="mt-1 text-white">{t.results.cheaperOption[summary.economics.cheaperOption]}</p>
          </div>
        </section>
      )}

      <section>
        <SectionHeading>{t.results.rankedAlternatives}</SectionHeading>
        <p className="mb-3 max-w-2xl text-xs leading-relaxed text-charm-muted">{t.results.rankedAlternativesDescription}</p>
        <div className="card p-3.5 sm:p-4">
          <CharmRankingTable recommendations={summary.rankedAlternatives} showCreatureName detailed />
        </div>
      </section>

      <section>
        <MissingDataPanel
          creaturesLackingBestiaryData={summary.creaturesLackingBestiaryData}
          creaturesNeedingManualReview={summary.creaturesNeedingManualReview}
        />
      </section>
    </div>
  );
}
