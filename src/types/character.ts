// Character input types.
import type { CharmId, CharmTier } from './charm';

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
  maxHitpoints: number;
  maxMana: number;
  /** Percent, 0-100. Defaults to the intrinsic 5% baseline every character has had since the Summer Update 2025 Weapon Proficiency System - not user-editable in the form, since Charm activation/cost is otherwise identical regardless of build. */
  criticalChance: number;
  /** Percent, 0-100. Defaults to the intrinsic 10% baseline from the same update. */
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

/** Intrinsic baseline since the Summer Update 2025 Weapon Proficiency System - see CipSoft's update notes. */
export const BASELINE_CRITICAL_CHANCE = 5;
export const BASELINE_CRITICAL_DAMAGE_BONUS = 10;

export const DEFAULT_CHARACTER_INPUT: CharacterInput = {
  level: 200,
  maxHitpoints: 4200,
  maxMana: 2400,
  criticalChance: BASELINE_CRITICAL_CHANCE,
  criticalDamageBonus: BASELINE_CRITICAL_DAMAGE_BONUS,
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
