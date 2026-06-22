// Parses the plain-text block produced by Tibia's "Analyse Hunt" window.
//
// The parser is intentionally bestiary-agnostic: it only ever looks at the
// pasted text. `estimated_damage_per_kill` / `estimated_xp_per_kill` /
// `estimated_loot_per_kill` are therefore a *naive, uniform* split of the
// session totals across every kill in the session (it has no way to know a
// crusader is tankier than a headwalker). `optimiseCharms.ts` refines these
// per species once Bestiary hitpoints/experience are joined in - see
// `refineKilledMonsterEstimates` there. Keeping the two steps separate keeps
// this file a pure function of the pasted text, which is what makes it easy
// to unit test.
import type {
  HuntAnalyserParseResult,
  HuntSessionTotals,
  KilledMonsterStat,
  LootedItemRaw,
  ParseWarning,
} from '@/types/hunt';

type NumericTotalsField =
  | 'rawXpGain'
  | 'xpGain'
  | 'rawXpPerHour'
  | 'xpPerHour'
  | 'loot'
  | 'supplies'
  | 'balance'
  | 'damage'
  | 'damagePerHour'
  | 'healing'
  | 'healingPerHour';

const NUMERIC_LABEL_MAP: Record<string, NumericTotalsField> = {
  'raw xp gain': 'rawXpGain',
  'xp gain': 'xpGain',
  'raw xp/h': 'rawXpPerHour',
  'xp/h': 'xpPerHour',
  loot: 'loot',
  supplies: 'supplies',
  balance: 'balance',
  damage: 'damage',
  'damage/h': 'damagePerHour',
  healing: 'healing',
  'healing/h': 'healingPerHour',
};

const KILLED_MONSTERS_HEADER = 'killed monsters:';
const LOOTED_ITEMS_HEADER = 'looted items:';

const SESSION_DATA_PATTERN = /^session data:\s*from\s+(.+?)\s+to\s+(.+)$/i;
const SESSION_DURATION_PATTERN = /^session:\s*(\d+):(\d+)h?$/i;
const ITEM_LINE_PATTERN = /^([\d,]+)\s*x\s+(.+)$/i;
const LABEL_VALUE_PATTERN = /^([^:]+):\s*(-?[\d,]+)\s*$/;

function parseLocaleNumber(raw: string): number {
  return Number(raw.replace(/,/g, ''));
}

/** "2026-06-20, 22:41:07" -> Date. Returns null when unparseable. */
function parseSessionTimestamp(raw: string): Date | null {
  const normalised = raw.trim().replace(', ', 'T').replace(' ', 'T');
  const date = new Date(normalised);
  return Number.isNaN(date.getTime()) ? null : date;
}

function emptyTotals(): HuntSessionTotals {
  return {
    sessionStart: null,
    sessionEnd: null,
    sessionDurationHours: null,
    rawXpGain: null,
    xpGain: null,
    rawXpPerHour: null,
    xpPerHour: null,
    loot: null,
    supplies: null,
    balance: null,
    damage: null,
    damagePerHour: null,
    healing: null,
    healingPerHour: null,
  };
}

type Section = 'none' | 'killed' | 'looted';

export function parseHuntAnalyser(rawInput: string): HuntAnalyserParseResult {
  const warnings: ParseWarning[] = [];
  const totals = emptyTotals();
  const killedMonstersRaw: { name: string; kills: number }[] = [];
  const lootedItems: LootedItemRaw[] = [];

  const lines = rawInput.replace(/\r\n/g, '\n').split('\n');
  let section: Section = 'none';
  let sawSessionHeader = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const lower = trimmed.toLowerCase();

    if (lower === KILLED_MONSTERS_HEADER) {
      section = 'killed';
      continue;
    }
    if (lower === LOOTED_ITEMS_HEADER) {
      section = 'looted';
      continue;
    }

    if (section === 'killed' || section === 'looted') {
      const itemMatch = trimmed.match(ITEM_LINE_PATTERN);
      if (itemMatch) {
        const quantity = parseLocaleNumber(itemMatch[1]!);
        const name = itemMatch[2]!.trim();
        if (section === 'killed') {
          killedMonstersRaw.push({ name, kills: quantity });
        } else {
          lootedItems.push({ name, quantity });
        }
        continue;
      }
      // Line didn't match "NNNx name" - the section has ended, fall through
      // and re-evaluate this line against the other patterns below.
      section = 'none';
    }

    const sessionDataMatch = trimmed.match(SESSION_DATA_PATTERN);
    if (sessionDataMatch) {
      sawSessionHeader = true;
      totals.sessionStart = parseSessionTimestamp(sessionDataMatch[1]!);
      totals.sessionEnd = parseSessionTimestamp(sessionDataMatch[2]!);
      continue;
    }

    const durationMatch = trimmed.match(SESSION_DURATION_PATTERN);
    if (durationMatch) {
      const hours = Number(durationMatch[1]);
      const minutes = Number(durationMatch[2]);
      totals.sessionDurationHours = hours + minutes / 60;
      continue;
    }

    const labelMatch = trimmed.match(LABEL_VALUE_PATTERN);
    if (labelMatch) {
      const label = labelMatch[1]!.trim().toLowerCase();
      const field = NUMERIC_LABEL_MAP[label];
      if (field) {
        totals[field] = parseLocaleNumber(labelMatch[2]!);
      } else {
        warnings.push({ code: 'unparsed_line', params: { line: trimmed } });
      }
      continue;
    }

    warnings.push({ code: 'unparsed_line', params: { line: trimmed } });
  }

  // Fallback: derive duration from the timestamps when "Session: HH:MMh" is
  // missing or malformed but both timestamps parsed correctly.
  if (totals.sessionDurationHours === null && totals.sessionStart && totals.sessionEnd) {
    const ms = totals.sessionEnd.getTime() - totals.sessionStart.getTime();
    if (ms > 0) totals.sessionDurationHours = ms / 3_600_000;
  }

  if (!sawSessionHeader) {
    warnings.push({ code: 'no_session_header' });
  }

  if (totals.sessionDurationHours === 0) {
    warnings.push({ code: 'zero_duration' });
  }

  if (killedMonstersRaw.length === 0) {
    warnings.push({ code: 'no_killed_monsters' });
  }

  if (lootedItems.length === 0) {
    warnings.push({ code: 'no_looted_items' });
  }

  // Merge same-species kill lines (case-insensitive) - a normal export never
  // repeats a species, but merging keeps kill_share well-defined if it does.
  const mergedKills = new Map<string, { name: string; kills: number }>();
  for (const entry of killedMonstersRaw) {
    const key = entry.name.toLowerCase();
    const existing = mergedKills.get(key);
    if (existing) existing.kills += entry.kills;
    else mergedKills.set(key, { ...entry });
  }

  const totalKills = [...mergedKills.values()].reduce((sum, m) => sum + m.kills, 0);
  const durationHours = totals.sessionDurationHours;

  const killedMonsters: KilledMonsterStat[] = [...mergedKills.values()].map((monster) => ({
    monsterName: monster.name,
    kills: monster.kills,
    killShare: totalKills > 0 ? monster.kills / totalKills : 0,
    killsPerHour: durationHours && durationHours > 0 ? monster.kills / durationHours : null,
    estimatedDamagePerKill:
      totals.damage !== null && totalKills > 0 ? totals.damage / totalKills : null,
    estimatedXpPerKill: totals.xpGain !== null && totalKills > 0 ? totals.xpGain / totalKills : null,
    estimatedLootPerKill: totals.loot !== null && totalKills > 0 ? totals.loot / totalKills : null,
  }));

  // Deterministic order: most-killed creature first, ties broken by name.
  killedMonsters.sort((a, b) => b.kills - a.kills || a.monsterName.localeCompare(b.monsterName));

  const isValid = sawSessionHeader || killedMonsters.length > 0;
  if (!isValid) {
    warnings.push({ code: 'missing_totals' });
  }

  return {
    raw: rawInput,
    totals,
    killedMonsters,
    lootedItems,
    warnings,
    isValid,
  };
}
