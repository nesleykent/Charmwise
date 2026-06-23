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
      <div className="grid w-full max-w-full grid-cols-2 gap-1 rounded-xl border border-white/15 bg-white/[0.08] p-1 shadow-card backdrop-blur-xl md:grid-cols-4">
        {MODES.map((mode) => (
          <label
            key={mode}
            title={t.recommendationsPage.modeDescriptions[mode]}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-center text-xs font-semibold transition-all ${
              value === mode
                ? 'bg-white/[0.2] text-white shadow-glow'
                : 'text-charm-muted hover:bg-white/[0.08] hover:text-white hover:opacity-90'
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
