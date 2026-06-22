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

/** Shared empty-state pattern: every page that depends on missing data (no hunt, no character customisation) explains what's missing and links straight to where it's fixed, instead of a bare "-". */
export function EmptyState({ title, body, actions }: Props) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-charm-border px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
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
