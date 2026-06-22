'use client';

import Link from 'next/link';
import { MAJOR_CHARM_LIST, MINOR_CHARM_LIST } from '@/data/charms';
import { useLocale } from '@/lib/i18n';
import { formatNumber, formatPercent } from '@/lib/format';
import type { CharmDefinition } from '@/types/charm';

function tierSummary(charm: CharmDefinition) {
  return charm.tiers.map((tier) => (tier.activationChance !== undefined ? formatPercent(tier.activationChance, 0) : '-')).join(' / ');
}

function CharmCard({ charm }: { charm: CharmDefinition }) {
  const { t, locale } = useLocale();
  return (
    <Link href={`/charms/${charm.id}`} className="card block p-4 transition-colors hover:border-charm-primary/50">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-white">{t.charms[charm.id]?.name ?? charm.name}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            charm.category === 'major' ? 'bg-charm-major/15 text-charm-major' : 'bg-charm-minor/15 text-charm-minor'
          }`}
        >
          {charm.category === 'major' ? 'Major' : 'Minor'}
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-charm-muted">{t.charms[charm.id]?.description}</p>
      <div className="mt-3 flex items-center justify-between text-[11px] text-charm-subtle">
        <span>{tierSummary(charm)}</span>
        <span>{formatNumber(charm.tiers[2].cost, locale)} {charm.currency === 'charm_points' ? 'CP' : 'MCE'}</span>
      </div>
    </Link>
  );
}

export default function CharmLibraryPage() {
  const { t } = useLocale();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-white">{t.charmLibrary.title}</h1>
      <p className="mt-1.5 text-charm-muted">{t.charmLibrary.subtitle}</p>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-charm-subtle">Major Charms</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MAJOR_CHARM_LIST.map((charm) => (
            <CharmCard key={charm.id} charm={charm} />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-charm-subtle">Minor Charms</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MINOR_CHARM_LIST.map((charm) => (
            <CharmCard key={charm.id} charm={charm} />
          ))}
        </div>
      </section>
    </div>
  );
}
