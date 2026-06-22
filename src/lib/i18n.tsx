'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en from '@/locales/en-GB';
import ptBR from '@/locales/pt-BR';
import type { Dictionary, Locale } from '@/types/i18n';

const DICTIONARIES: Record<Locale, Dictionary> = { 'en-GB': en, 'pt-BR': ptBR };
const STORAGE_KEY = 'charmwise.locale';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return value === 'en-GB' || value === 'pt-BR';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en-GB');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (isLocale(stored)) {
      setLocaleState(stored);
      return;
    }
    const browserLanguage = typeof navigator !== 'undefined' ? navigator.language : 'en';
    if (browserLanguage.toLowerCase().startsWith('pt')) setLocaleState('pt-BR');
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<LocaleContextValue>(() => ({ locale, setLocale, t: DICTIONARIES[locale] }), [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}
