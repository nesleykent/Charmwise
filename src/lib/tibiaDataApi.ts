// Client for TibiaData's character lookup (api.tibiadata.com/v4) - confirmed
// to send `Access-Control-Allow-Origin: *`, so this can be called directly
// from the browser with no proxy. Confirmed unreliable in practice, though:
// even known-valid character names occasionally return a 502 from TibiaData's
// own upstream. There's no clean way to tell "character does not exist" apart
// from "the service hiccupped" from the response alone, so every failure path
// collapses to a single null result - this is a convenience prefill with a
// fully-editable fallback, not a feature anything else depends on.
const REQUEST_TIMEOUT_MS = 8000;

export interface CharacterLookupResult {
  level: number;
  vocation: string;
}

interface TibiaDataCharacterResponse {
  character?: {
    character?: {
      level?: number;
      vocation?: string;
    };
  };
}

export async function fetchCharacterByName(name: string): Promise<CharacterLookupResult | null> {
  const trimmed = name.trim();
  if (trimmed.length === 0) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`https://api.tibiadata.com/v4/character/${encodeURIComponent(trimmed)}`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const data = (await response.json()) as TibiaDataCharacterResponse;
    const level = data.character?.character?.level;
    const vocation = data.character?.character?.vocation;
    if (typeof level !== 'number' || typeof vocation !== 'string') return null;

    return { level, vocation };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
