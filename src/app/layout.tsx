import type { Metadata } from 'next';
import { AppShell } from '@/components/nav/AppShell';
import { LocaleProvider } from '@/lib/i18n';
import { WorkspaceProvider } from '@/lib/workspace';
import './globals.css';

export const metadata: Metadata = {
  title: 'Charmwise - Tibia Charm Optimisation',
  description: 'Charmwise is a data driven Tibia Charm optimisation platform. Smarter Charms. Better Hunts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <LocaleProvider>
          <WorkspaceProvider>
            <AppShell>{children}</AppShell>
          </WorkspaceProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
