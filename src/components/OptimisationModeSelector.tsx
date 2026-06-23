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
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-semibold text-white">{t.recommendationsPage.modeLabel}</legend>
      <div className="grid w-full max-w-full grid-cols-2 gap-1 rounded-lg border border-charm-border bg-charm-surfaceAlt/65 p-1 md:grid-cols-4">
        {MODES.map((mode) => (
          <label
            key={mode}
            title={t.recommendationsPage.modeDescriptions[mode]}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-center text-xs font-semibold transition-colors ${
              value === mode
                ? 'bg-charm-primary text-white shadow-glow'
                : 'text-charm-muted hover:bg-white/[0.05] hover:text-white'
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
            <span className="block font-semibold">{t.recommendationsPage.modes[mode]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
