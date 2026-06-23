'use client';

import { useLocale } from '@/lib/i18n';
import type { Locale } from '@/types/i18n';

const OPTIONS: { value: Locale; flag: string }[] = [
  { value: 'en-GB', flag: 'EN' },
  { value: 'pt-BR', flag: 'PT' },
];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div className="inline-flex shrink-0 rounded-xl border border-white/15 bg-white/[0.08] p-1 shadow-card backdrop-blur-xl" role="group" aria-label="Language">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setLocale(option.value)}
          aria-pressed={locale === option.value}
          className={`rounded-lg px-2 py-1 text-xs font-semibold transition-all sm:px-3 ${
            locale === option.value ? 'bg-white/[0.18] text-white shadow-glow' : 'text-charm-muted hover:bg-white/[0.08] hover:text-white hover:opacity-90'
          }`}
        >
          {option.flag}
          <span className="sr-only"> {option.value === 'en-GB' ? t.language.en : t.language.pt}</span>
        </button>
      ))}
    </div>
  );
}
