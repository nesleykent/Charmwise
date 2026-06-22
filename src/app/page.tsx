'use client';

import Link from 'next/link';
import { DataBadge } from '@/components/DataBadge';
import { EmptyState } from '@/components/EmptyState';
import { MissingDataPanel } from '@/components/MissingDataPanel';
import { creatureSlug, formatNumber, formatScore } from '@/lib/format';
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
  const { summary, hasHuntData } = useWorkspace();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-white">{t.dashboard.title}</h1>
      <p className="mt-1.5 text-charm-muted">{t.dashboard.subtitle}</p>

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
        <div className="mt-8 space-y-8">
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard
              title={t.results.metrics.expectedDamagePerHour}
              value={formatNumber(summary.expectedImprovementSummary.extraDamagePerHour, locale)}
              accent
            />
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
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-charm-subtle">{t.dashboard.bestAssignmentsTitle}</h2>
              <Link href="/recommendations" className="text-xs font-medium text-charm-primary hover:underline">
                {t.dashboard.viewAllLink}
              </Link>
            </div>
            <div className="card divide-y divide-charm-border">
              {summary.creatureResults.map((result) => (
                <Link
                  key={result.monsterName}
                  href={`/recommendations#${creatureSlug(result.monsterName)}`}
                  className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-charm-surfaceAlt/60"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{result.monsterName}</p>
                    {result.hasBestiaryData ? (
                      <p className="mt-0.5 truncate text-xs text-charm-muted">
                        {result.bestMajorCharm ? t.charms[result.bestMajorCharm.charmId]?.name : t.results.noMajorUnlocked}
                        {' · '}
                        {result.bestMinorCharm ? t.charms[result.bestMinorCharm.charmId]?.name : t.results.noMinorUnlocked}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-charm-danger">{t.missingData.lackingBestiary}</p>
                    )}
                  </div>
                  {result.bestMajorCharm && <DataBadge tier={result.bestMajorCharm.confidence === 'high' ? 'measured' : result.bestMajorCharm.confidence === 'medium' ? 'estimated' : 'assumed'} />}
                </Link>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-charm-subtle">{t.dashboard.upgradeOpportunitiesTitle}</h2>
            {summary.charmPointBudget.suggestions.length === 0 && summary.minorEchoBudget.suggestions.length === 0 ? (
              <p className="text-sm text-charm-subtle">{t.dashboard.noUpgrades}</p>
            ) : (
              <ul className="card divide-y divide-charm-border text-xs">
                {[...summary.charmPointBudget.suggestions.slice(0, 3), ...summary.minorEchoBudget.suggestions.slice(0, 3)]
                  .sort((a, b) => b.scorePerCost - a.scorePerCost)
                  .slice(0, 5)
                  .map((s, i) => (
                    <li key={i} className="p-3">
                      <span className="font-semibold text-white">{t.charms[s.charmId]?.name}</span> {t.results.linkingFor}{' '}
                      <span className="text-white">{s.monsterName}</span> - {formatNumber(s.cost, locale)} {s.currency === 'charm_points' ? 'CP' : 'MCE'} (
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
