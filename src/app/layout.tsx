import type { Metadata } from 'next';
import { Playfair_Display } from 'next/font/google';
import { AppShell } from '@/components/nav/AppShell';
import { BackgroundAtmosphere } from '@/components/BackgroundAtmosphere';
import { LocaleProvider } from '@/lib/i18n';
import { WorkspaceProvider } from '@/lib/workspace';
import './globals.css';

// Self-hosted at build time by next/font - no runtime request to Google's
// CDN, so this stays consistent with the rest of the app running fully
// offline-capable from a static export. Headlines only; body text stays on
// the system sans stack.
const displayFont = Playfair_Display({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
  display: 'swap',
});

// See AppShell.tsx - basePath must be prepended by hand for asset URLs
// Next doesn't run through its own build pipeline.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata: Metadata = {
  title: 'Charmwise - Tibia Charm Optimisation',
  description: 'Charmwise is a data driven Tibia Charm optimisation platform. Smarter Charms. Better Hunts.',
  icons: {
    icon: `${basePath}/logo.png`,
    apple: `${basePath}/logo.png`,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={displayFont.variable}>
      <body className="font-sans antialiased">
        <BackgroundAtmosphere />
        <LocaleProvider>
          <WorkspaceProvider>
            <AppShell>{children}</AppShell>
          </WorkspaceProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
