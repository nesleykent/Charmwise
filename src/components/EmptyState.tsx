import Link from 'next/link';

interface Action {
  label: string;
  href: string;
  primary?: boolean;
}

interface Props {
  title: string;
  body: string;
  actions?: Action[];
}

export function EmptyState({ title, body, actions }: Props) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-charm-borderStrong bg-white/[0.025] px-6 py-16 text-center">
      <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-charm-muted">{body}</p>
      {actions && actions.length > 0 && (
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {actions.map((action) => (
            <Link key={action.href} href={action.href} className={action.primary ? 'btn-primary' : 'btn-secondary'}>
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
