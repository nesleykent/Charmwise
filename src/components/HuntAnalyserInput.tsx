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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="field-label">
          {t.huntAnalyserInput.title}
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange(SAMPLE_HUNT_ANALYSER_TEXT)}
            className="rounded-md border border-charm-border px-3 py-1.5 text-xs text-charm-muted transition-colors hover:border-charm-primary hover:text-white"
          >
            {t.huntAnalyserInput.loadSample}
          </button>
          <button
            type="button"
            onClick={() => onChange('')}
            className="rounded-md border border-charm-border px-3 py-1.5 text-xs text-charm-muted transition-colors hover:border-charm-danger hover:text-charm-danger"
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
        className="field-input font-mono text-xs leading-relaxed"
      />

      {parseResult && parseResult.killedMonsters.length > 0 && (
        <div className="card p-4 text-sm">
          <h4 className="font-semibold text-white">{t.huntAnalyserInput.parsedSummaryTitle}</h4>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-charm-subtle">{t.huntAnalyserInput.sessionDuration}</dt>
              <dd className="mt-0.5 text-sm text-white">
                {parseResult.totals.sessionDurationHours !== null ? `${parseResult.totals.sessionDurationHours.toFixed(2)}h` : '-'}
              </dd>
            </div>
            <div>
              <dt className="text-charm-subtle">{t.huntAnalyserInput.killedMonstersFound}</dt>
              <dd className="mt-0.5 text-sm text-white">{parseResult.killedMonsters.length}</dd>
            </div>
            <div>
              <dt className="text-charm-subtle">Damage/h</dt>
              <dd className="mt-0.5 text-sm text-white">
                {parseResult.totals.damagePerHour !== null ? formatNumber(parseResult.totals.damagePerHour, locale) : '-'}
              </dd>
            </div>
          </dl>
        </div>
      )}

      {parseResult && parseResult.warnings.length > 0 && (
        <div className="rounded-lg border border-charm-warning/30 bg-charm-warning/10 p-4 text-xs text-charm-warning">
          <h4 className="font-semibold">{t.huntAnalyserInput.warningsTitle}</h4>
          <ul className="mt-1.5 list-inside list-disc space-y-1">
            {parseResult.warnings.map((w, i) => (
              <li key={i}>{formatMessage(t, w)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
