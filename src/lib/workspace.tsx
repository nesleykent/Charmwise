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
import type { OptimisationMode } from '@/types/charm';
import type { HuntAnalyserParseResult } from '@/types/hunt';
import type { HuntOptimisationSummary } from '@/types/optimisation';

const STORAGE_KEY = 'charmwise.workspace.v1';

interface PersistedState {
  character: CharacterInput;
  huntText: string;
  mode: OptimisationMode;
}

function defaultState(): PersistedState {
  return { character: DEFAULT_CHARACTER_INPUT, huntText: '', mode: 'balanced' };
}

interface WorkspaceContextValue {
  character: CharacterInput;
  setCharacter: (character: CharacterInput) => void;
  huntText: string;
  setHuntText: (text: string) => void;
  mode: OptimisationMode;
  setMode: (mode: OptimisationMode) => void;
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
        setState((prev) => ({
          ...prev,
          ...saved,
          character: { ...prev.character, ...saved.character },
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
    return optimiseCharms(state.character, parseResult, state.mode);
  }, [state.character, parseResult, state.mode]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      character: state.character,
      setCharacter: (character) => setState((s) => ({ ...s, character })),
      huntText: state.huntText,
      setHuntText: (huntText) => setState((s) => ({ ...s, huntText })),
      mode: state.mode,
      setMode: (mode) => setState((s) => ({ ...s, mode })),
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
