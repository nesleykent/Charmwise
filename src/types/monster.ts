// Raw bestiary.json shapes (tibiadraptor.com export) and the normalised
// MonsterProfile the rest of the app is built against. Keeping the raw shape
// loosely typed (lots of `unknown`/optional fields) is what lets
// `normaliseMonster.ts` act as a safe adapter when the source data drifts.
import type { ElementType } from './charm';

export interface RawBestiaryResistance {
  type: string;
  value: number;
}

export interface RawBestiaryCharmDetails {
  first_stage?: number;
  second_stage?: number;
  third_stage?: number;
  charm_points?: number;
}

export interface RawBestiaryClass {
  id?: number;
  name?: string;
  image?: string;
}

export interface RawBestiaryEntry {
  id?: number;
  name: string;
  hitpoints?: number;
  experience?: number;
  difficulty?: string;
  occurrence?: string;
  armor?: number;
  mitigation?: string | number;
  speed?: number;
  attack_type?: string;
  damage_types?: string[];
  negative_conditions?: string[];
  resistances?: RawBestiaryResistance[];
  charm_details?: RawBestiaryCharmDetails;
  class?: RawBestiaryClass;
  is_premium?: number;
  // The upstream API has drifted before and likely will again; anything not
  // explicitly modelled above is tolerated rather than rejected.
  [key: string]: unknown;
}

export interface RawBestiaryFile {
  data: RawBestiaryEntry[];
  [key: string]: unknown;
}

export type BestiaryDifficulty =
  | 'harmless'
  | 'trivial'
  | 'easy'
  | 'medium'
  | 'hard'
  | 'challenging'
  | 'unknown';

export interface MonsterResistances {
  physical: number;
  fire: number;
  earth: number;
  energy: number;
  ice: number;
  holy: number;
  death: number;
}

export interface MonsterDamageProfile {
  attackType: 'melee' | 'ranged' | 'mixed' | 'unknown';
  /** Elements the CREATURE deals to the player; informs Cleanse/Void Inversion relevance. */
  dealtElements: ElementType[];
  inflictsManaDrain: boolean;
  inflictsLifeDrain: boolean;
}

export interface MonsterProfile {
  name: string;
  hitpoints: number | null;
  experience: number | null;
  difficulty: BestiaryDifficulty;
  charmPoints: number | null;
  resistances: MonsterResistances | null;
  /** Not present in the upstream bestiary export; populated from the pasted hunt session when possible. */
  averageLootValue: number | null;
  creatureProductValue: number | null;
  supportsSkinning: boolean | null;
  supportsDusting: boolean | null;
  skinningValue: number | null;
  dustingValue: number | null;
  fleeHealthPercent: number | null;
  conditions: string[];
  damageProfile: MonsterDamageProfile | null;
  /** Field names that could not be sourced for this monster, surfaced in MissingDataPanel. */
  missingFields: string[];
  /** The exact bestiary `name` that was matched, which may differ from the Hunt Analyser spelling. */
  matchedBestiaryName: string | null;
  /** True when the match came from the fuzzy helper rather than an exact (case/space-insensitive) match. */
  wasFuzzyMatched: boolean;
}
