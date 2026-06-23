// Small display-formatting helpers shared by the results components.

export function formatNumber(value: number, locale: string = 'en-GB'): string {
  if (!Number.isFinite(value)) return '-';
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

export function formatSigned(value: number, locale: string = 'en-GB'): string {
  if (!Number.isFinite(value)) return '-';
  const formatted = formatNumber(Math.abs(value), locale);
  return value < 0 ? `-${formatted}` : `+${formatted}`;
}

export function formatPercent(fraction: number, fractionDigits = 1): string {
  if (!Number.isFinite(fraction)) return '-';
  return `${(fraction * 100).toFixed(fractionDigits)}%`;
}

export function formatScore(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(1);
}

/** Stable anchor id for a creature name, used to deep-link from the Dashboard into Recommendations. */
export function creatureSlug(name: string): string {
  return `creature-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;
}

// APA (7th ed.) title case: capitalize every word except short (<=3-letter)
// articles/coordinating conjunctions/prepositions, which stay lowercase
// unless they're the first or last word.
const APA_MINOR_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in', 'nor',
  'of', 'off', 'on', 'or', 'per', 'so', 'the', 'to', 'up', 'via', 'vs', 'yet',
]);

function capitalizeWord(word: string): string {
  // Capitalize after internal hyphens too, e.g. "war-horse" -> "War-Horse".
  return word
    .split('-')
    .map((part) => (part.length === 0 ? part : part[0]!.toUpperCase() + part.slice(1).toLowerCase()))
    .join('-');
}

/**
 * Title-cases a creature name for display only - Hunt Analyser text and
 * Bestiary entries arrive in whatever case the game used (often all
 * lowercase), but matching/lookup logic should keep comparing the original,
 * unmodified casing. Call this only at render time.
 */
export function toTitleCase(text: string): string {
  const words = text.trim().split(/\s+/);
  return words
    .map((word, index) => {
      const isFirstOrLast = index === 0 || index === words.length - 1;
      const bareWord = word.toLowerCase().replace(/[^a-z]/g, '');
      if (!isFirstOrLast && APA_MINOR_WORDS.has(bareWord)) return word.toLowerCase();
      return capitalizeWord(word);
    })
    .join(' ');
}
