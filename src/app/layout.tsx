import type { Metadata } from 'next';
import { AppShell } from '@/components/nav/AppShell';
import { BackgroundAtmosphere } from '@/components/BackgroundAtmosphere';
import { LocaleProvider } from '@/lib/i18n';
import { WorkspaceProvider } from '@/lib/workspace';
import './globals.css';

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
    <html lang="en">
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
