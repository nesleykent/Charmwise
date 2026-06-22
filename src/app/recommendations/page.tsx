'use client';

import { CharmRankingTable } from '@/components/CharmRankingTable';
import { EmptyState } from '@/components/EmptyState';
import { OptimisationModeSelector } from '@/components/OptimisationModeSelector';
import { OptimisationResults } from '@/components/OptimisationResults';
import { PageHeader } from '@/components/PageHeader';
import { creatureSlug } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { useWorkspace } from '@/lib/workspace';

export default function RecommendationsPage() {
  const { t } = useLocale();
  const { summary, hasHuntData, mode, setMode } = useWorkspace();

  return (
    <div className="mx-auto max-w-6xl animate-fadeIn px-4 py-10 sm:px-6">
      <PageHeader title={t.recommendationsPage.title} subtitle={t.recommendationsPage.subtitle} />

      <div className="mt-7">
        <OptimisationModeSelector value={mode} onChange={setMode} />
      </div>

      {!hasHuntData || !summary ? (
        <div className="mt-8">
          <EmptyState
            title={t.recommendationsPage.emptyTitle}
            body={t.recommendationsPage.emptyBody}
            actions={[{ label: t.recommendationsPage.emptyCta, href: '/hunt', primary: true }]}
          />
        </div>
      ) : (
        <>
          <div className="mt-8">
            <OptimisationResults summary={summary} />
          </div>

          <section aria-labelledby="details-heading" className="mt-12">
            <h2 id="details-heading" className="mb-5 text-lg font-semibold text-white">
              {t.recommendationsPage.sectionDetails}
            </h2>
            <div className="space-y-5">
              {summary.creatureResults
                .filter((r) => r.hasBestiaryData)
                .map((result) => (
                  <div key={result.monsterName} id={creatureSlug(result.monsterName)} className="card scroll-mt-6 p-5 sm:p-6">
                    <h3 className="mb-4 font-semibold text-white">{result.monsterName}</h3>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-charm-subtle">{t.results.allMajorCharms}</p>
                        <CharmRankingTable recommendations={result.rankedMajorCharms} detailed />
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-charm-subtle">{t.results.allMinorCharms}</p>
                        <CharmRankingTable recommendations={result.rankedMinorCharms} detailed />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
