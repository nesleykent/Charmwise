'use client';

import Link from 'next/link';
import { DataBadge } from '@/components/DataBadge';
import { EmptyState } from '@/components/EmptyState';
import { MissingDataPanel } from '@/components/MissingDataPanel';
import { PageHeader } from '@/components/PageHeader';
import { creatureSlug, formatNumber, formatScore, toTitleCase } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { useWorkspace } from '@/lib/workspace';

function SummaryCard({ title, value, accent }: { title: string; value: string; accent?: boolean }) {
  return (
    <div className={`card p-4 ${accent ? 'border-charm-primary/50 bg-charm-primary/5' : ''}`}>
      <div className="text-xs uppercase tracking-wide text-charm-subtle">{title}</div>
      <div className="mt-1 text-xl font-bold text-white">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { t, locale } = useLocale();
  const { summary, hasHuntData, scope, setScope } = useWorkspace();

  return (
    <div className="mx-auto max-w-5xl animate-fadeIn px-4 py-10 sm:px-6">
      <PageHeader title={t.dashboard.title} subtitle={t.dashboard.subtitle} />

      {!hasHuntData || !summary ? (
        <div className="mt-8">
          <EmptyState
            title={t.dashboard.emptyTitle}
            body={t.dashboard.emptyBody}
            actions={[
              { label: t.dashboard.emptyCtaHunt, href: '/hunt', primary: true },
              { label: t.dashboard.emptyCtaCharacter, href: '/character' },
            ]}
          />
        </div>
      ) : (
        <div className="mt-10 space-y-10">
          {/* Asymmetric 5-column split: the headline metric (damage/h) takes a
              double-width slot, the other three share the remaining grid. */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="col-span-2 sm:col-span-2">
              <SummaryCard
                title={t.results.metrics.expectedDamagePerHour}
                value={formatNumber(summary.expectedImprovementSummary.extraDamagePerHour, locale)}
                accent
              />
            </div>
            <SummaryCard
              title={t.results.metrics.expectedProfitPerHour}
              value={formatNumber(summary.expectedImprovementSummary.extraProfitPerHour, locale)}
            />
            <SummaryCard
              title={t.results.metrics.expectedDamagePreventedPerHour}
              value={formatNumber(summary.expectedImprovementSummary.extraDamagePreventedPerHour, locale)}
            />
            <SummaryCard
              title={t.results.metrics.expectedHealingSavedPerHour}
              value={formatNumber(summary.expectedImprovementSummary.extraHealingSavedPerHour, locale)}
            />
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-charm-subtle">{t.dashboard.bestAssignmentsTitle}</h2>
              <Link href="/recommendations" className="text-xs font-medium text-charm-primary transition-opacity hover:opacity-70">
                {t.dashboard.viewAllLink}
              </Link>
            </div>

            <div className="mb-3 inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1" role="group" aria-label={t.dashboard.bestAssignmentsTitle}>
              {(['full_analysis', 'my_charms'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setScope(option)}
                  aria-pressed={scope === option}
                  title={option === 'full_analysis' ? t.dashboard.scopeFullAnalysisHint : t.dashboard.scopeMyCharmsHint}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    scope === option ? 'bg-charm-primary text-charm-bg' : 'text-charm-muted hover:text-white'
                  }`}
                >
                  {option === 'full_analysis' ? t.dashboard.scopeFullAnalysis : t.dashboard.scopeMyCharms}
                </button>
              ))}
            </div>

            <div className="card divide-y divide-white/10">
              {summary.creatureResults.map((result) => {
                const bestMajor = scope === 'full_analysis' ? result.bestMajorCharmOverall : result.bestMajorCharm;
                const bestMinor = scope === 'full_analysis' ? result.bestMinorCharmOverall : result.bestMinorCharm;
                return (
                  <Link
                    key={result.monsterName}
                    href={`/recommendations#${creatureSlug(result.monsterName)}`}
                    className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{toTitleCase(result.monsterName)}</p>
                      {result.hasBestiaryData ? (
                        <p className="mt-0.5 truncate text-xs text-charm-muted">
                          {bestMajor ? t.charms[bestMajor.charmId]?.name : t.results.noMajorUnlocked}
                          {bestMajor && !bestMajor.unlocked ? ` (${t.dashboard.notUnlockedTag})` : ''}
                          {' · '}
                          {bestMinor ? t.charms[bestMinor.charmId]?.name : t.results.noMinorUnlocked}
                          {bestMinor && !bestMinor.unlocked ? ` (${t.dashboard.notUnlockedTag})` : ''}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-charm-danger">{t.missingData.lackingBestiary}</p>
                      )}
                    </div>
                    {bestMajor && <DataBadge tier={bestMajor.confidence === 'high' ? 'measured' : bestMajor.confidence === 'medium' ? 'estimated' : 'assumed'} />}
                  </Link>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-charm-subtle">{t.dashboard.upgradeOpportunitiesTitle}</h2>
            {summary.charmPointBudget.suggestions.length === 0 && summary.minorEchoBudget.suggestions.length === 0 ? (
              <p className="text-sm text-charm-subtle">{t.dashboard.noUpgrades}</p>
            ) : (
              <ul className="card divide-y divide-white/10 text-xs">
                {[...summary.charmPointBudget.suggestions.slice(0, 3), ...summary.minorEchoBudget.suggestions.slice(0, 3)]
                  .sort((a, b) => b.scorePerCost - a.scorePerCost)
                  .slice(0, 5)
                  .map((s, i) => (
                    <li key={i} className="p-3">
                      <span className="font-semibold text-white">{t.charms[s.charmId]?.name}</span> {t.results.linkingFor}{' '}
                      <span className="text-white">{toTitleCase(s.monsterName)}</span> - {formatNumber(s.cost, locale)} {s.currency === 'charm_points' ? 'CP' : 'MCE'} (
                      {formatScore(s.scorePerCost)} pts/cost)
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <MissingDataPanel
            creaturesLackingBestiaryData={summary.creaturesLackingBestiaryData}
            creaturesNeedingManualReview={summary.creaturesNeedingManualReview}
          />
        </div>
      )}
    </div>
  );
}
