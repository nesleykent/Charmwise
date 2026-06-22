'use client';

import { useLocale } from '@/lib/i18n';

export function Footer() {
  const { t } = useLocale();

  return (
    <footer className="border-t border-charm-border bg-charm-bg">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-charm-muted sm:px-6">
        <p>{t.home.footerNote}</p>
        <p className="mt-2">Charmwise - {t.nav.tagline}</p>
      </div>
    </footer>
  );
}
