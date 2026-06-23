'use client';

import { EmptyState } from '@/components/EmptyState';
import { OptimisationModeSelector } from '@/components/OptimisationModeSelector';
import { OptimisationResults } from '@/components/OptimisationResults';
import { PageHeader } from '@/components/PageHeader';
import { TargetTierSelector } from '@/components/TargetTierSelector';
import { useLocale } from '@/lib/i18n';
import { useWorkspace } from '@/lib/workspace';

export default function RecommendationsPage() {
  const { t } = useLocale();
  const { summary, hasHuntData, mode, setMode, targetTier, setTargetTier } = useWorkspace();

  return (
    <div className="page-shell">
      <PageHeader title={t.recommendationsPage.title} subtitle={t.recommendationsPage.subtitle} />

      <div className="mt-5 grid min-w-0 gap-4 rounded-lg border border-charm-border bg-white/[0.025] p-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <OptimisationModeSelector value={mode} onChange={setMode} />
        <TargetTierSelector value={targetTier} onChange={setTargetTier} />
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
        <div className="mt-8">
          <OptimisationResults summary={summary} />
        </div>
      )}
    </div>
  );
}
