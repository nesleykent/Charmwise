'use client';

import Link from 'next/link';
import { useLocale } from '@/lib/i18n';

export default function HomePage() {
  const { t } = useLocale();

  return (
    <div>
      <section className="border-b border-charm-border bg-gradient-to-b from-charm-primary/10 to-transparent">
        <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-widest text-charm-primary">{t.home.heroEyebrow}</p>
          <h1 className="mt-4 text-5xl font-extrabold tracking-tight text-white sm:text-6xl">{t.home.heroTitle}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-charm-muted">{t.home.heroSubtitle}</p>
          <p className="mt-4 text-xl font-semibold text-charm-primary">{t.home.heroTagline}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/optimiser"
              className="rounded-full bg-charm-primary px-6 py-3 text-sm font-semibold text-charm-bg shadow-glow transition-transform hover:scale-105"
            >
              {t.home.ctaPrimary}
            </Link>
            <a
              href="#how-it-works"
              className="rounded-full border border-charm-border px-6 py-3 text-sm font-semibold text-white hover:border-charm-primary"
            >
              {t.home.ctaSecondary}
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-white">{t.home.inputsTitle}</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-charm-muted">{t.home.inputsSubtitle}</p>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.home.inputs.map((input, i) => (
            <div key={i} className="rounded-xl border border-charm-border bg-charm-surface p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-charm-primary/15 text-sm font-bold text-charm-primary">
                {i + 1}
              </div>
              <h3 className="mt-3 font-semibold text-white">{input.title}</h3>
              <p className="mt-1 text-sm text-charm-muted">{input.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="border-y border-charm-border bg-charm-surfaceAlt/40">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold text-white">{t.home.howTitle}</h2>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {t.home.howSteps.map((step, i) => (
              <div key={i} className="relative rounded-xl border border-charm-border bg-charm-surface p-5">
                <span className="absolute -top-3 -left-3 flex h-7 w-7 items-center justify-center rounded-full bg-charm-major text-xs font-bold text-charm-bg">
                  {i + 1}
                </span>
                <h3 className="font-semibold text-white">{step.title}</h3>
                <p className="mt-1 text-sm text-charm-muted">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-white">{t.home.outputsTitle}</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm text-charm-muted">{t.home.outputsSubtitle}</p>
        <ul className="mx-auto mt-8 max-w-2xl space-y-3">
          {t.home.outputs.map((output, i) => (
            <li key={i} className="flex items-start gap-3 rounded-lg border border-charm-border bg-charm-surface p-4">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-charm-minor/20 text-xs text-charm-minor">
                &#10003;
              </span>
              <span className="text-sm text-white">{output}</span>
            </li>
          ))}
        </ul>
        <div className="mt-10 text-center">
          <Link
            href="/optimiser"
            className="rounded-full bg-charm-primary px-6 py-3 text-sm font-semibold text-charm-bg shadow-glow transition-transform hover:scale-105"
          >
            {t.home.ctaPrimary}
          </Link>
        </div>
      </section>
    </div>
  );
}
