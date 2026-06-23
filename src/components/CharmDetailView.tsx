'use client';

import Link from 'next/link';
import { getCharmSuitability } from '@/lib/charmLibrary';
import { formatNumber, formatPercent, toTitleCase } from '@/lib/format';
import { useLocale } from '@/lib/i18n';
import { formatMessage } from '@/lib/messages';
import { ALL_CHARM_LIST } from '@/data/charms';

export function CharmDetailView({ charmId }: { charmId: string }) {
  const { t, locale } = useLocale();
  const charm = ALL_CHARM_LIST.find((c) => c.id === charmId);

  if (!charm) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link href="/charms" className="text-sm text-charm-primary transition-opacity hover:opacity-70">
          &larr; {t.charmLibrary.backToLibrary}
        </Link>
      </div>
    );
  }

  const suitability = getCharmSuitability(charm);

  return (
    <div className="mx-auto max-w-3xl animate-fadeIn px-4 py-10 sm:px-6">
      <Link href="/charms" className="text-sm text-charm-primary transition-opacity hover:opacity-70">
        &larr; {t.charmLibrary.backToLibrary}
      </Link>

      <div className="mt-5 flex gap-4 sm:gap-5">
        <span
          aria-hidden="true"
          className="mt-1.5 h-11 w-1 shrink-0 rounded-full bg-gradient-to-b from-charm-accent via-charm-rose to-charm-major sm:h-[3.25rem]"
        />
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {t.charms[charm.id]?.name ?? charm.name}
            </h1>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                charm.category === 'major' ? 'bg-charm-major/15 text-charm-major' : 'bg-charm-minor/15 text-charm-minor'
              }`}
            >
              {charm.category === 'major' ? 'Major Charm' : 'Minor Charm'}
            </span>
          </div>
          <p className="mt-3 max-w-xl leading-relaxed text-charm-muted">{t.charms[charm.id]?.description}</p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-charm-subtle">{t.charmLibrary.tierCosts}</h2>
        <div className="card grid grid-cols-3 divide-x divide-white/10 text-center">
          {charm.tiers.map((tier, i) => (
            <div key={tier.tier} className="p-4">
              <div className="text-xs font-semibold text-charm-muted">{t.characterForm.tierNames[i]}</div>
              <div className="mt-2 text-lg font-bold text-white">
                {tier.activationChance !== undefined ? formatPercent(tier.activationChance, 0) : '-'}
              </div>
              <div className="mt-1 text-xs text-charm-subtle">
                {formatNumber(tier.cost, locale)} {charm.currency === 'charm_points' ? 'CP' : 'MCE'}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-charm-subtle">
          {t.charmLibrary.bestAgainst} / {t.charmLibrary.worstAgainst}
        </h2>
        {!suitability.rankable ? (
          <p className="card p-4 text-sm leading-relaxed text-charm-muted">
            {suitability.unrankableReason ? formatMessage(t, suitability.unrankableReason) : null}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-charm-minor">{t.charmLibrary.bestAgainst}</p>
              <ul className="card divide-y divide-white/10 text-sm">
                {suitability.best.map((c) => (
                  <li key={c.name} className="flex items-center justify-between p-3">
                    <span className="text-white">{toTitleCase(c.name)}</span>
                    <span className="text-xs text-charm-subtle">{c.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-charm-danger">{t.charmLibrary.worstAgainst}</p>
              <ul className="card divide-y divide-white/10 text-sm">
                {suitability.worst.map((c) => (
                  <li key={c.name} className="flex items-center justify-between p-3">
                    <span className="text-white">{toTitleCase(c.name)}</span>
                    <span className="text-xs text-charm-subtle">{c.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
