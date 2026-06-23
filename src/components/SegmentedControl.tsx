'use client';

interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

interface Props<T extends string | number> {
  ariaLabel: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string | number>({ ariaLabel, value, options, onChange }: Props<T>) {
  return (
    <div className="inline-flex max-w-full rounded-full border border-white/10 bg-white/[0.03] p-1" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            title={option.hint}
            className={`min-h-8 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors sm:px-4 ${
              active ? 'bg-charm-primary text-white' : 'text-charm-muted hover:text-white'
            }`}
          >
            {active ? '✓ ' : ''}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
