export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="relative flex flex-wrap items-end justify-between gap-6 pb-5">
      <div aria-hidden="true" className="absolute -left-5 top-2 h-px w-24 bg-gradient-to-r from-charm-accent via-charm-coral to-transparent opacity-80" />
      <div className="max-w-3xl pt-2">
        <h1 className="font-display text-[2.45rem] font-semibold leading-none tracking-tight text-white sm:text-7xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-lg leading-relaxed text-charm-muted sm:text-xl">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
