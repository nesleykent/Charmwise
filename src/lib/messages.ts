// Renders a `LocalisedMessage` (a message code + params) against the active
// Dictionary. This is what lets optimiseCharms.ts/charmScoring.ts stay plain
// TypeScript - returning a code instead of a pre-built English string - while
// the UI renders it in whichever interface language is active.
import type { Dictionary } from '@/types/i18n';
import type { LocalisedMessage } from '@/types/charm';

// Some param names carry an enum-style key (e.g. "dominant": "damage")
// rather than display text - this maps the param name to the Dictionary
// sub-table it should be resolved against.
const ENUM_PARAM_LOOKUP: Record<string, keyof Dictionary> = {
  dominant: 'scoreDimensions',
  element: 'elements',
};

export function formatMessage(t: Dictionary, message: LocalisedMessage): string {
  const template = t.messages[message.code] ?? message.code;
  const params = message.params ?? {};
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = params[key];
    if (value === undefined) return '';
    // "tier" carries a 1-3 tier number rather than display text - resolve
    // against the real Bronze/Silver/Gold names instead of printing "3".
    if (key === 'tier' && typeof value === 'number') {
      return t.characterForm.tierNames[value - 1] ?? String(value);
    }
    const lookupTable = ENUM_PARAM_LOOKUP[key];
    if (lookupTable && typeof value === 'string') {
      const table = t[lookupTable] as unknown as Record<string, string>;
      if (value in table) return table[value]!;
    }
    return String(value);
  });
}

export function formatMessages(t: Dictionary, messages: LocalisedMessage[]): string[] {
  return messages.map((m) => formatMessage(t, m));
}
