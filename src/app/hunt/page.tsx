'use client';

import Link from 'next/link';
import { HuntAnalyserInput } from '@/components/HuntAnalyserInput';
import { useLocale } from '@/lib/i18n';
import { useWorkspace } from '@/lib/workspace';

export default function HuntPage() {
  const { t } = useLocale();
  const { huntText, setHuntText, parseResult, hasHuntData } = useWorkspace();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-white">{t.huntPage.title}</h1>
      <p className="mt-1.5 text-charm-muted">{t.huntPage.subtitle}</p>

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
