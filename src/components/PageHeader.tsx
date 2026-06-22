/**
 * Shared page-header layout: a large serif headline offset beside a thin
 * sunrise-to-twilight accent bar, rather than a centred/flush block - the
 * one piece of deliberate asymmetry every page opens with.
 */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-6">
      <div className="flex gap-4 sm:gap-5">
        <span
          aria-hidden="true"
          className="mt-1.5 h-11 w-1 shrink-0 rounded-full bg-gradient-to-b from-charm-accent via-charm-rose to-charm-major sm:h-[3.25rem]"
        />
        <div className="max-w-2xl">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-lg leading-relaxed text-charm-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
