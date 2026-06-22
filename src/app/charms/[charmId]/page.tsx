// Server component: generateStaticParams runs at build time so `next build`
// (static export) can pre-render one HTML file per Charm - this can't live
// in a 'use client' file, which is why the actual rendering is delegated to
// CharmDetailView.
import { CharmDetailView } from '@/components/CharmDetailView';
import { ALL_CHARM_LIST } from '@/data/charms';

export function generateStaticParams() {
  return ALL_CHARM_LIST.map((charm) => ({ charmId: charm.id }));
}

export default function CharmDetailPage({ params }: { params: { charmId: string } }) {
  return <CharmDetailView charmId={params.charmId} />;
}
