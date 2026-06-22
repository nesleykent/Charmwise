// Hunt Analyser parsing types.
import type { LocalisedMessage } from './charm';

export interface HuntSessionTotals {
  sessionStart: Date | null;
  sessionEnd: Date | null;
  sessionDurationHours: number | null;
  rawXpGain: number | null;
  xpGain: number | null;
  rawXpPerHour: number | null;
  xpPerHour: number | null;
  loot: number | null;
  supplies: number | null;
  balance: number | null;
  damage: number | null;
  damagePerHour: number | null;
  healing: number | null;
  healingPerHour: number | null;
}

export interface LootedItemRaw {
  name: string;
  quantity: number;
}

export interface KilledMonsterStat {
  monsterName: string;
  kills: number;
  /** Fraction of total kills in the session (0-1). */
  killShare: number;
  killsPerHour: number | null;
  estimatedDamagePerKill: number | null;
  estimatedXpPerKill: number | null;
  estimatedLootPerKill: number | null;
}

export type ParseWarningCode =
  | 'no_session_header'
  | 'no_killed_monsters'
  | 'no_looted_items'
  | 'unparsed_line'
  | 'zero_duration'
  | 'missing_totals';

export interface ParseWarning extends LocalisedMessage {
  code: ParseWarningCode;
}

export interface HuntAnalyserParseResult {
  raw: string;
  totals: HuntSessionTotals;
  killedMonsters: KilledMonsterStat[];
  lootedItems: LootedItemRaw[];
  warnings: ParseWarning[];
  /** False only when nothing usable (no killed monsters and no totals) could be extracted. */
  isValid: boolean;
}
