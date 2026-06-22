'use client';

import { useId } from 'react';
import { SAMPLE_HUNT_ANALYSER_TEXT } from '@/data/sampleHuntAnalyser';
import { useLocale } from '@/lib/i18n';
import { formatNumber } from '@/lib/format';
import { formatMessage } from '@/lib/messages';
import type { HuntAnalyserParseResult } from '@/types/hunt';

interface Props {
  value: string;
  onChange: (text: string) => void;
  parseResult: HuntAnalyserParseResult | null;
}

export function HuntAnalyserInput({ value, onChange, parseResult }: Props) {
  const { t, locale } = useLocale();
  const id = useId();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-charm-muted">
          {t.huntAnalyserInput.title}
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange(SAMPLE_HUNT_ANALYSER_TEXT)}
            className="rounded-md border border-charm-border px-2 py-1 text-xs text-charm-muted hover:border-charm-primary hover:text-white"
          >
            {t.huntAnalyserInput.loadSample}
          </button>
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-md border border-charm-border px-2 py-1 text-xs text-charm-muted hover:border-charm-danger hover:text-charm-danger"
          >
            {t.huntAnalyserInput.clear}
          </button>
        </div>
      </div>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.huntAnalyserInput.placeholder}
        rows={14}
        spellCheck={false}
        className="w-full rounded-md border border-charm-border bg-charm-bg px-3 py-2 font-mono text-xs leading-relaxed text-white focus:border-charm-primary focus:outline-none focus:ring-1 focus:ring-charm-primary"
      />

      {parseResult && parseResult.killedMonsters.length > 0 && (
        <div className="rounded-md border border-charm-border bg-charm-surface p-3 text-sm">
          <h4 className="font-semibold text-white">{t.huntAnalyserInput.parsedSummaryTitle}</h4>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-charm-muted">{t.huntAnalyserInput.sessionDuration}</dt>
              <dd className="text-white">
                {parseResult.totals.sessionDurationHours !== null ? `${parseResult.totals.sessionDurationHours.toFixed(2)}h` : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-charm-muted">{t.huntAnalyserInput.killedMonstersFound}</dt>
              <dd className="text-white">{parseResult.killedMonsters.length}</dd>
            </div>
            <div>
              <dt className="text-charm-muted">Damage/h</dt>
              <dd className="text-white">{parseResult.totals.damagePerHour !== null ? formatNumber(parseResult.totals.damagePerHour, locale) : '-'}</dd>
            </div>
          </dl>
        </div>
      )}

      {parseResult && parseResult.warnings.length > 0 && (
        <div className="rounded-md border border-charm-warning/40 bg-charm-warning/10 p-3 text-xs text-charm-warning">
          <h4 className="font-semibold">{t.huntAnalyserInput.warningsTitle}</h4>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {parseResult.warnings.map((w, i) => (
              <li key={i}>{formatMessage(t, w)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
