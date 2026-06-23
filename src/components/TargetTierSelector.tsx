'use client';

import { SegmentedControl } from '@/components/SegmentedControl';
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
    <fieldset className="min-w-0 xl:w-64">
      <legend className="mb-2 text-sm font-semibold text-white">{t.recommendationsPage.targetTierLabel}</legend>
      <p className="sr-only">{t.recommendationsPage.targetTierHint}</p>
      <SegmentedControl
        ariaLabel={t.recommendationsPage.targetTierLabel}
        value={value}
        onChange={onChange}
        options={TIERS.map((tier) => ({ value: tier, label: t.characterForm.tierNames[tier - 1]! }))}
      />
    </fieldset>
  );
}
