'use client';

import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { toTitleCase } from '@/lib/format';
import { getBestiaryEntries } from '@/lib/normaliseMonster';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}

const MAX_SUGGESTIONS = 8;

let cachedNames: string[] | null = null;
function getAllCreatureNames(): string[] {
  if (!cachedNames) cachedNames = getBestiaryEntries().map((entry) => entry.name);
  return cachedNames;
}

/** Typeahead combobox over every known Bestiary creature name - lets users pick a creature instead of typing its full name exactly. Plain text entry still works; matching elsewhere in the app is unaffected since this only changes what gets typed into the same field. */
export function CreatureNameInput({ value, onChange, placeholder, ariaLabel }: Props) {
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (query.length === 0) return [];
    return getAllCreatureNames()
      .filter((name) => name.toLowerCase().includes(query))
      .slice(0, MAX_SUGGESTIONS);
  }, [value]);

  function selectSuggestion(name: string) {
    onChange(name);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0) {
        e.preventDefault();
        selectSuggestion(suggestions[highlightedIndex]!);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  }

  const showDropdown = isOpen && suggestions.length > 0;

  return (
    <div className="relative min-w-0 flex-1">
      <input
        type="text"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={highlightedIndex >= 0 ? `${listId}-${highlightedIndex}` : undefined}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setHighlightedIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        // Delay closing so a click on a dropdown item (which fires after
        // this blur) still lands before the list disappears.
        onBlur={() => setTimeout(() => setIsOpen(false), 100)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className="field-input w-full"
      />
      {showDropdown && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1.5 max-h-60 w-full overflow-auto rounded-lg border border-white/10 bg-charm-surface/95 py-1 shadow-card backdrop-blur-xl"
        >
          {suggestions.map((name, index) => (
            <li
              key={name}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === highlightedIndex}
              onMouseEnter={() => setHighlightedIndex(index)}
              onClick={() => selectSuggestion(name)}
              className={`cursor-pointer px-3 py-2 text-sm transition-colors ${
                index === highlightedIndex ? 'bg-charm-primary/15 text-white' : 'text-charm-muted hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              {toTitleCase(name)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
