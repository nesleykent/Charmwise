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
    <div className="inline-flex shrink-0 rounded-full border border-charm-border bg-charm-surface p-1" role="group" aria-label="Language">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setLocale(option.value)}
          aria-pressed={locale === option.value}
          className={`rounded-full px-2 py-1 text-xs font-semibold transition-colors sm:px-3 ${
            locale === option.value ? 'bg-charm-primary text-charm-bg' : 'text-charm-muted hover:text-white'
          }`}
        >
          {option.flag}
          <span className="sr-only"> {option.value === 'en-GB' ? t.language.en : t.language.pt}</span>
        </button>
      ))}
    </div>
  );
}
