'use client';

import { useMemo, useState } from 'react';
import { CharacterForm } from '@/components/CharacterForm';
import { CharmDataReference } from '@/components/CharmDataReference';
import { CharmRankingTable } from '@/components/CharmRankingTable';
import { HuntAnalyserInput } from '@/components/HuntAnalyserInput';
import { OptimisationModeSelector } from '@/components/OptimisationModeSelector';
import { OptimisationResults } from '@/components/OptimisationResults';
import { useLocale } from '@/lib/i18n';
import { optimiseCharms } from '@/lib/optimiseCharms';
import { parseHuntAnalyser } from '@/lib/parseHuntAnalyser';
import { DEFAULT_CHARACTER_INPUT, type CharacterInput } from '@/types/character';
import type { OptimisationMode } from '@/types/charm';

interface AppliedInputs {
  character: CharacterInput;
  huntText: string;
  mode: OptimisationMode;
}

export default function OptimiserPage() {
  const { t } = useLocale();
  const [character, setCharacter] = useState<CharacterInput>(DEFAULT_CHARACTER_INPUT);
  const [huntText, setHuntText] = useState('');
  const [mode, setMode] = useState<OptimisationMode>('balanced');
  const [appliedInputs, setAppliedInputs] = useState<AppliedInputs | null>(null);

  const liveParseResult = useMemo(() => (huntText.trim() ? parseHuntAnalyser(huntText) : null), [huntText]);

  const summary = useMemo(() => {
    if (!appliedInputs) return null;
    const parseResult = parseHuntAnalyser(appliedInputs.huntText);
    if (!parseResult.isValid) return null;
    return optimiseCharms(appliedInputs.character, parseResult, appliedInputs.mode);
  }, [appliedInputs]);

  function handleOptimise() {
    setAppliedInputs({ character, huntText, mode });
  }

  function handleReset() {
    setCharacter(DEFAULT_CHARACTER_INPUT);
    setHuntText('');
    setMode('balanced');
    setAppliedInputs(null);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-white">{t.optimiser.title}</h1>
      <p className="mt-1.5 text-charm-muted">{t.optimiser.subtitle}</p>

      <div className="mt-7">
        <OptimisationModeSelector value={mode} onChange={setMode} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section aria-labelledby="character-heading" className="card p-5 sm:p-6">
          <h2 id="character-heading" className="mb-5 text-lg font-semibold text-white">
            {t.optimiser.sectionCharacter}
          </h2>
          <CharacterForm value={character} onChange={setCharacter} />
        </section>

        <section aria-labelledby="hunt-heading" className="card p-5 sm:p-6">
          <h2 id="hunt-heading" className="mb-5 text-lg font-semibold text-white">
            {t.optimiser.sectionHunt}
          </h2>
          <HuntAnalyserInput value={huntText} onChange={setHuntText} parseResult={liveParseResult} />
        </section>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={handleOptimise} className="btn-primary">
          {t.optimiser.runButton}
        </button>
        <button type="button" onClick={handleReset} className="btn-secondary text-charm-muted">
          {t.optimiser.resetButton}
        </button>
      </div>

      <section aria-labelledby="charm-data-heading" className="card mt-12 p-5 sm:p-6">
        <h2 id="charm-data-heading" className="mb-5 text-lg font-semibold text-white">
          {t.optimiser.sectionCharms}
        </h2>
        <CharmDataReference />
      </section>

      <section aria-labelledby="results-heading" className="mt-12">
        <h2 id="results-heading" className="mb-5 text-lg font-semibold text-white">
          {t.optimiser.sectionResults}
        </h2>
        {summary ? <OptimisationResults summary={summary} /> : <p className="text-charm-muted">{t.optimiser.emptyState}</p>}
      </section>

      {summary && (
        <section aria-labelledby="details-heading" className="mt-12">
          <h2 id="details-heading" className="mb-5 text-lg font-semibold text-white">
            {t.optimiser.sectionDetails}
          </h2>
          <div className="space-y-5">
            {summary.creatureResults
              .filter((r) => r.hasBestiaryData)
              .map((result) => (
                <div key={result.monsterName} className="card p-5 sm:p-6">
                  <h3 className="mb-4 font-semibold text-white">{result.monsterName}</h3>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-charm-subtle">{t.results.allMajorCharms}</p>
                      <CharmRankingTable recommendations={result.rankedMajorCharms} detailed />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-charm-subtle">{t.results.allMinorCharms}</p>
                      <CharmRankingTable recommendations={result.rankedMinorCharms} detailed />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
