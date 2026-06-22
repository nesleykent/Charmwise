// Character input types.
import type { CharmId, CharmTier } from './charm';

export type Vocation = 'elite_knight' | 'royal_paladin' | 'master_sorcerer' | 'elder_druid' | 'exalted_monk';

export type AccountType = 'free' | 'premium';

export interface UnlockedCharm {
  charmId: CharmId;
  tier: CharmTier;
}

export interface AssignedCharm {
  charmId: CharmId;
  creatureName: string;
}

export interface CharacterInput {
  level: number;
  vocation: Vocation;
  maxHitpoints: number;
  maxMana: number;
  /** Percent, 0-100. Base value from gear/talents, before any charm bonus. */
  criticalChance: number;
  /** Percent, 0-100. Base extra damage on a critical hit, before any charm bonus. */
  criticalDamageBonus: number;
  /** Percent, 0+. Requires existing leech for Vampiric Embrace to apply. */
  lifeLeechPercent: number;
  /** Percent, 0+. Requires existing leech for Voids Call to apply. */
  manaLeechPercent: number;
  availableCharmPoints: number;
  availableMinorCharmEchoes: number;
  accountType: AccountType;
  hasCharmExpansion: boolean;
  unlockedMajorCharms: UnlockedCharm[];
  unlockedMinorCharms: UnlockedCharm[];
  assignedMajorCharms: AssignedCharm[];
  assignedMinorCharms: AssignedCharm[];
  /** Whether the player has already used their one free Charm reset. */
  hasUsedFreeReset: boolean;
}

export const VOCATIONS: Vocation[] = [
  'elite_knight',
  'royal_paladin',
  'master_sorcerer',
  'elder_druid',
  'exalted_monk',
];

export const DEFAULT_CHARACTER_INPUT: CharacterInput = {
  level: 200,
  vocation: 'royal_paladin',
  maxHitpoints: 4200,
  maxMana: 2400,
  criticalChance: 0,
  criticalDamageBonus: 100,
  lifeLeechPercent: 0,
  manaLeechPercent: 0,
  availableCharmPoints: 0,
  availableMinorCharmEchoes: 0,
  accountType: 'premium',
  hasCharmExpansion: false,
  unlockedMajorCharms: [],
  unlockedMinorCharms: [],
  assignedMajorCharms: [],
  assignedMinorCharms: [],
  hasUsedFreeReset: false,
};
