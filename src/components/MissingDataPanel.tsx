'use client';

import { toTitleCase } from '@/lib/format';
import { useLocale } from '@/lib/i18n';

interface Props {
  creaturesLackingBestiaryData: string[];
  creaturesNeedingManualReview: string[];
}

export function MissingDataPanel({ creaturesLackingBestiaryData, creaturesNeedingManualReview }: Props) {
  const { t } = useLocale();
  const hasIssues = creaturesLackingBestiaryData.length > 0 || creaturesNeedingManualReview.length > 0;

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-white">{t.missingData.title}</h3>
      {!hasIssues && <p className="mt-2 text-sm text-charm-subtle">{t.missingData.noIssues}</p>}

      {creaturesLackingBestiaryData.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-charm-danger">{t.missingData.lackingBestiary}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {creaturesLackingBestiaryData.map((name) => (
              <li key={name} className="rounded-full border border-charm-danger/30 bg-charm-danger/10 px-2.5 py-0.5 text-xs text-charm-danger">
                {toTitleCase(name)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {creaturesNeedingManualReview.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-charm-warning">{t.missingData.needsManualReview}</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {creaturesNeedingManualReview.map((name) => (
              <li key={name} className="rounded-full border border-charm-warning/30 bg-charm-warning/10 px-2.5 py-0.5 text-xs text-charm-warning">
                {toTitleCase(name)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
