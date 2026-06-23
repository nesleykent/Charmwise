'use client';

// Cross-page state: character, pasted hunt text, and optimisation mode live
// here instead of in any one page's component state, persisted to
// localStorage so navigating between Dashboard/Character/Hunt/Recommendations
// (or refreshing the tab) never loses your work. Every page reads the SAME
// computed parseResult/summary rather than each recomputing its own copy.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { optimiseCharms } from '@/lib/optimiseCharms';
import { parseHuntAnalyser } from '@/lib/parseHuntAnalyser';
import { DEFAULT_CHARACTER_INPUT, type CharacterInput } from '@/types/character';
import type { CharmId, CharmTier, OptimisationMode, RecommendationScope, ScoreWeights } from '@/types/charm';
import type { HuntAnalyserParseResult } from '@/types/hunt';
import type { HuntOptimisationSummary } from '@/types/optimisation';

const STORAGE_KEY = 'charmwise.workspace.v1';

interface PersistedState {
  character: CharacterInput;
  huntText: string;
  mode: OptimisationMode;
  scope: RecommendationScope;
  /** Ceiling locked Charms are evaluated at, and how far purchase suggestions walk - see optimiseCharms.ts. Gold by default; not everyone's Charm Point budget realistically reaches Gold on everything. */
  targetTier: CharmTier;
  selectedCharmIds: CharmId[];
  customWeights: ScoreWeights;
}

function defaultState(): PersistedState {
  // Full Analysis by default - someone who hasn't filled in Unlocked Charms
  // yet should still see a comprehensive "what's the best Charm here"
  // answer, not an empty "nothing unlocked" result.
  return {
    character: DEFAULT_CHARACTER_INPUT,
    huntText: '',
    mode: 'damage_first',
    scope: 'full_analysis',
    targetTier: 3,
    selectedCharmIds: [],
    customWeights: { damage: 0.7, xp: 0, profit: 0.05, safety: 0.1, supplySaving: 0.1, utility: 0.05 },
  };
}

interface WorkspaceContextValue {
  character: CharacterInput;
  setCharacter: (character: CharacterInput) => void;
  huntText: string;
  setHuntText: (text: string) => void;
  mode: OptimisationMode;
  setMode: (mode: OptimisationMode) => void;
  scope: RecommendationScope;
  setScope: (scope: RecommendationScope) => void;
  targetTier: CharmTier;
  setTargetTier: (tier: CharmTier) => void;
  selectedCharmIds: CharmId[];
  setSelectedCharmIds: (charmIds: CharmId[]) => void;
  customWeights: ScoreWeights;
  setCustomWeights: (weights: ScoreWeights) => void;
  parseResult: HuntAnalyserParseResult | null;
  summary: HuntOptimisationSummary | null;
  hasHuntData: boolean;
  resetWorkspace: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(defaultState());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<PersistedState>;
        const defaults = defaultState();
        setState((prev) => ({
          ...prev,
          ...saved,
          mode: saved.mode === 'balanced' ? defaults.mode : (saved.mode ?? prev.mode),
          character: { ...prev.character, ...saved.character },
          selectedCharmIds: saved.selectedCharmIds ?? prev.selectedCharmIds,
          customWeights: { ...prev.customWeights, ...saved.customWeights },
        }));
      }
    } catch {
      // Corrupted or inaccessible storage - keep defaults rather than crash.
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    // Guard against writing the default state back over a save we haven't
    // read yet (the read above is also inside an effect, so it runs after
    // this one's first pass without the guard).
    if (!isHydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, isHydrated]);

  const parseResult = useMemo(() => (state.huntText.trim() ? parseHuntAnalyser(state.huntText) : null), [state.huntText]);

  const summary = useMemo(() => {
    if (!parseResult || !parseResult.isValid) return null;
    return optimiseCharms(state.character, parseResult, state.mode, undefined, state.targetTier);
  }, [state.character, parseResult, state.mode, state.targetTier]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      character: state.character,
      setCharacter: (character) => setState((s) => ({ ...s, character })),
      huntText: state.huntText,
      setHuntText: (huntText) => setState((s) => ({ ...s, huntText })),
      mode: state.mode,
      setMode: (mode) => setState((s) => ({ ...s, mode })),
      scope: state.scope,
      setScope: (scope) => setState((s) => ({ ...s, scope })),
      targetTier: state.targetTier,
      setTargetTier: (targetTier) => setState((s) => ({ ...s, targetTier })),
      selectedCharmIds: state.selectedCharmIds,
      setSelectedCharmIds: (selectedCharmIds) => setState((s) => ({ ...s, selectedCharmIds })),
      customWeights: state.customWeights,
      setCustomWeights: (customWeights) => setState((s) => ({ ...s, customWeights })),
      parseResult,
      summary,
      hasHuntData: (parseResult?.killedMonsters.length ?? 0) > 0,
      resetWorkspace: () => setState(defaultState()),
    }),
    [state, parseResult, summary],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return ctx;
}
