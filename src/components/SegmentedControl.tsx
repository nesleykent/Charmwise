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
    <div className="inline-flex max-w-full rounded-xl border border-white/15 bg-white/[0.08] p-1 shadow-card backdrop-blur-xl" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            title={option.hint}
            className={`min-h-8 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all sm:px-4 ${
              active ? 'bg-white/[0.2] text-white shadow-glow' : 'text-charm-muted hover:bg-white/[0.08] hover:text-white hover:opacity-90'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
