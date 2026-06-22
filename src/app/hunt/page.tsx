'use client';

import Link from 'next/link';
import { HuntAnalyserInput } from '@/components/HuntAnalyserInput';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/lib/i18n';
import { useWorkspace } from '@/lib/workspace';

export default function HuntPage() {
  const { t } = useLocale();
  const { huntText, setHuntText, parseResult, hasHuntData } = useWorkspace();

  return (
    <div className="mx-auto max-w-3xl animate-fadeIn px-4 py-10 sm:px-6">
      <PageHeader title={t.huntPage.title} subtitle={t.huntPage.subtitle} />

      <div className="card mt-8 p-5 sm:p-6">
        <HuntAnalyserInput value={huntText} onChange={setHuntText} parseResult={parseResult} />
      </div>

      {hasHuntData && (
        <div className="mt-6 flex justify-end">
          <Link href="/recommendations" className="btn-primary">
            {t.nav.recommendations} &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
