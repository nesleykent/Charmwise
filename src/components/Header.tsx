'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from '@/lib/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';

export function Header() {
  const { t } = useLocale();
  const pathname = usePathname();

  const linkClass = (href: string) => {
    const active = pathname === href;
    return `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? 'bg-charm-surface text-white' : 'text-charm-muted hover:text-white'
    }`;
  };

  return (
    <header className="border-b border-charm-border bg-charm-bg/95 backdrop-blur sticky top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:gap-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-charm-primary to-charm-major text-base font-bold text-charm-bg">
            C
          </span>
          <span className="hidden text-lg font-bold text-white sm:inline">Charmwise</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-6">
          <Link href="/" className={linkClass('/')}>
            {t.nav.home}
          </Link>
          <Link href="/optimiser" className={linkClass('/optimiser')}>
            {t.nav.optimiser}
          </Link>
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}
