'use client';

import { useLocale } from '@/lib/i18n';
import type { CharmTier } from '@/types/charm';

interface Props {
  value: CharmTier;
  onChange: (tier: CharmTier) => void;
}

const TIERS: CharmTier[] = [1, 2, 3];

export function TargetTierSelector({ value, onChange }: Props) {
  const { t } = useLocale();

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-white">{t.recommendationsPage.targetTierLabel}</legend>
      <p className="mb-3 max-w-xl text-xs leading-relaxed text-charm-muted">{t.recommendationsPage.targetTierHint}</p>
      <div
        className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1"
        role="group"
        aria-label={t.recommendationsPage.targetTierLabel}
      >
        {TIERS.map((tier) => (
          <button
            key={tier}
            type="button"
            onClick={() => onChange(tier)}
            aria-pressed={value === tier}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
              value === tier ? 'bg-charm-primary text-charm-bg' : 'text-charm-muted hover:text-white'
            }`}
          >
            {t.characterForm.tierNames[tier - 1]}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
