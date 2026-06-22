'use client';

import { useState } from 'react';
import { MAJOR_CHARM_LIST, MINOR_CHARM_LIST } from '@/data/charms';
import { useLocale } from '@/lib/i18n';
import { formatNumber, formatPercent } from '@/lib/format';
import type { CharmCategory, CharmDefinition } from '@/types/charm';

function tierSummary(charm: CharmDefinition, tierIndex: number) {
  const tier = charm.tiers[tierIndex]!;
  const parts: string[] = [];
  if (tier.activationChance !== undefined) parts.push(formatPercent(tier.activationChance, 0));
  return parts.join(' ');
}

function CharmCard({ charm }: { charm: CharmDefinition }) {
  const { t, locale } = useLocale();
  return (
    <div className="rounded-lg border border-charm-border bg-charm-surface p-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-white">{t.charms[charm.id]?.name ?? charm.name}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] ${
            charm.category === 'major' ? 'bg-charm-major/15 text-charm-major' : 'bg-charm-minor/15 text-charm-minor'
          }`}
        >
          {charm.category === 'major' ? 'Major' : 'Minor'}
        </span>
      </div>
      <p className="mt-1 text-xs text-charm-muted">{t.charms[charm.id]?.description}</p>
      <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px]">
        {charm.tiers.map((tier, i) => (
          <div key={tier.tier} className="rounded bg-charm-bg p-1.5">
            <div className="text-charm-muted">T{tier.tier}</div>
            <div className="text-white">{tierSummary(charm, i) || '-'}</div>
            <div className="text-charm-muted">{formatNumber(tier.cost, locale)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CharmDataReference() {
  const [category, setCategory] = useState<CharmCategory>('major');
  const list = category === 'major' ? MAJOR_CHARM_LIST : MINOR_CHARM_LIST;

  return (
    <div>
      <div className="mb-3 inline-flex rounded-full border border-charm-border bg-charm-surface p-1">
        {(['major', 'minor'] as CharmCategory[]).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full px-4 py-1 text-xs font-semibold capitalize transition-colors ${
              category === c ? 'bg-charm-primary text-charm-bg' : 'text-charm-muted hover:text-white'
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((charm) => (
          <CharmCard key={charm.id} charm={charm} />
        ))}
      </div>
    </div>
  );
}
