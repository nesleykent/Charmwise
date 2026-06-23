import { describe, expect, it } from 'vitest';
import { toTitleCase } from '@/lib/format';

describe('toTitleCase', () => {
  it('capitalizes simple single and multi-word names', () => {
    expect(toTitleCase('crusader')).toBe('Crusader');
    expect(toTitleCase('war wolf')).toBe('War Wolf');
  });

  it('lowercases short minor words in the middle, per APA title case', () => {
    expect(toTitleCase('lord of the elements')).toBe('Lord of the Elements');
    expect(toTitleCase('ghost of a planegazer')).toBe('Ghost of a Planegazer');
  });

  it('always capitalizes the first and last word, even if they are minor words', () => {
    expect(toTitleCase('the pale worm')).toBe('The Pale Worm');
    expect(toTitleCase('war of the throne up')).toBe('War of the Throne Up');
  });

  it('capitalizes both sides of a hyphen', () => {
    expect(toTitleCase('war-horse')).toBe('War-Horse');
  });

  it('preserves an internal apostrophe while still capitalizing the first letter', () => {
    expect(toTitleCase("shaper's apprentice")).toBe("Shaper's Apprentice");
  });

  it('is idempotent and handles already-correct casing', () => {
    expect(toTitleCase('Lord of the Elements')).toBe('Lord of the Elements');
  });
});
