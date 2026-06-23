'use client';

import { SegmentedControl } from '@/components/SegmentedControl';
import { useLocale } from '@/lib/i18n';
import type { RecommendationScope } from '@/types/charm';

interface Props {
  value: RecommendationScope;
  onChange: (scope: RecommendationScope) => void;
  ariaLabel: string;
}

export function RecommendationScopeToggle({ value, onChange, ariaLabel }: Props) {
  const { t } = useLocale();
  return (
    <SegmentedControl
      ariaLabel={ariaLabel}
      value={value}
      onChange={onChange}
      options={[
        {
          value: 'full_analysis',
          label: t.dashboard.scopeFullAnalysis,
          hint: t.dashboard.scopeFullAnalysisHint,
        },
        {
          value: 'my_charms',
          label: t.dashboard.scopeMyCharms,
          hint: t.dashboard.scopeMyCharmsHint,
        },
      ]}
    />
  );
}
