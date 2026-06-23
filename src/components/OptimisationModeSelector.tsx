'use client';

import { useLocale } from '@/lib/i18n';
import type { OptimisationMode } from '@/types/charm';

const MODES: OptimisationMode[] = ['balanced', 'xp', 'profit', 'safety', 'low_supplies'];

interface Props {
  value: OptimisationMode;
  onChange: (mode: OptimisationMode) => void;
}

export function OptimisationModeSelector({ value, onChange }: Props) {
  const { t } = useLocale();

  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-white">{t.recommendationsPage.modeLabel}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {MODES.map((mode) => (
          <label
            key={mode}
            className={`cursor-pointer rounded-2xl border p-3.5 text-sm transition-all ${
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
            <span className="mt-1 block text-xs leading-relaxed text-charm-subtle">{t.recommendationsPage.modeDescriptions[mode]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
