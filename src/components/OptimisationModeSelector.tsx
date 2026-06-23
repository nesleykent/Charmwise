'use client';

import { useLocale } from '@/lib/i18n';
import { PRIMARY_RECOMMENDATION_VIEWS } from '@/lib/recommendationViews';
import type { OptimisationMode, RecommendationView } from '@/types/charm';

const MODES: RecommendationView[] = PRIMARY_RECOMMENDATION_VIEWS;

interface Props {
  value: OptimisationMode;
  onChange: (mode: OptimisationMode) => void;
}

export function OptimisationModeSelector({ value, onChange }: Props) {
  const { t } = useLocale();

  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-white">{t.recommendationsPage.modeLabel}</legend>
      <div className="flex flex-wrap gap-2">
        {MODES.map((mode) => (
          <label
            key={mode}
            title={t.recommendationsPage.modeDescriptions[mode]}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
              value === mode
                ? 'border-charm-primary bg-charm-primary/10 text-white shadow-glow'
                : 'border-white/10 bg-white/[0.03] text-charm-muted hover:border-charm-primary/40 hover:bg-white/[0.06]'
            }`}
          >
            <input
              type="radio"
              name="optimisation-mode"
              value={mode}
              checked={value === mode}
              onChange={() => onChange(mode)}
              className="sr-only"
            />
            <span className="block font-semibold">
              {value === mode ? '✓ ' : ''}
              {t.recommendationsPage.modes[mode]}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
