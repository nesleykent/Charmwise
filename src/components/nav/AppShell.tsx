'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLocale } from '@/lib/i18n';
import type { Dictionary } from '@/types/i18n';

// next/image does not auto-prepend basePath to `src` when images.unoptimized
// is true (required for static export) - confirmed by inspecting the actual
// built output, where it was missing. Must be prepended by hand, same as the
// favicon in layout.tsx.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

function Logo() {
  return <Image src={`${BASE_PATH}/logo-32.png`} alt="" width={32} height={32} className="h-8 w-8 rounded-lg" priority />;
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="3.5" width="7.5" height="4.5" rx="1.5" />
      <rect x="13" y="10" width="7.5" height="10.5" rx="1.5" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
    </svg>
  );
}

function CharacterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="7.5" r="3.75" />
      <path d="M4.5 20c0-3.866 3.358-7 7.5-7s7.5 3.134 7.5 7" />
    </svg>
  );
}

function HuntIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3.5h9L19 7.5v13H6z" />
      <path d="M15 3.5V7.5h4" />
      <path d="M9 12h6M9 15.5h6M9 18.5h3.5" />
    </svg>
  );
}

function RecommendationsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
    </svg>
  );
}

function CharmsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4" />
      <path d="M7 7l2 2M15 15l2 2M17 7l-2 2M9 15l-2 2" />
      <circle cx="12" cy="12" r="2.25" />
    </svg>
  );
}

const NAV_ITEMS: { href: string; key: keyof Dictionary['nav']; Icon: () => React.ReactElement }[] = [
  { href: '/', key: 'dashboard', Icon: DashboardIcon },
  { href: '/character', key: 'character', Icon: CharacterIcon },
  { href: '/hunt', key: 'hunt', Icon: HuntIcon },
  { href: '/recommendations', key: 'recommendations', Icon: RecommendationsIcon },
  { href: '/charms', key: 'charms', Icon: CharmsIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/') return pathname === '/' || pathname === '';
    return pathname?.startsWith(href) ?? false;
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-r md:border-white/10 md:bg-charm-bg/60 md:backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2 px-5 py-5">
          <Logo />
          <span className="font-display text-lg font-semibold text-white">Charmwise</span>
        </Link>
        <nav className="flex-1 space-y-1 px-3" aria-label={t.nav.dashboard}>
          {NAV_ITEMS.map(({ href, key, Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  active ? 'bg-white/[0.07] text-white' : 'text-charm-muted hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <Icon />
                {t.nav[key]}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3 px-5 py-4">
          <LanguageSwitcher />
          <p className="text-[11px] leading-relaxed text-charm-subtle">{t.common.privacyNote}</p>
        </div>
      </aside>

      <header className="flex items-center justify-between border-b border-white/10 bg-charm-bg/70 px-4 py-3 backdrop-blur-xl md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="font-display text-lg font-semibold text-white">Charmwise</span>
        </Link>
        <LanguageSwitcher />
      </header>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 pb-24 md:pb-0">{children}</main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-white/10 bg-charm-bg/75 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label={t.nav.dashboard}
      >
        {NAV_ITEMS.map(({ href, key, Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              aria-label={t.nav[key]}
              title={t.nav[key]}
              className={`flex flex-1 items-center justify-center py-3.5 transition-opacity ${
                active ? 'text-charm-primary' : 'text-charm-muted hover:opacity-80'
              }`}
            >
              <Icon />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
