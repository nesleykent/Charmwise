// Aggregate result types produced by `optimiseCharms.ts`.
import type { CharmCategory, CharmId, CharmRecommendation, LocalisedMessage, OptimisationMode } from './charm';
import type { KilledMonsterStat } from './hunt';
import type { MonsterProfile } from './monster';

export interface CreatureOptimisationResult {
  monsterName: string;
  matchedProfile: MonsterProfile | null;
  huntStat: KilledMonsterStat;
  hasBestiaryData: boolean;
  /** Best among Charms the player has actually unlocked - null if none are. */
  bestMajorCharm: CharmRecommendation | null;
  bestMinorCharm: CharmRecommendation | null;
  /** Best overall regardless of unlock status (Full Analysis view) - same ranking `rankedMajorCharms`/`rankedMinorCharms` already produce, just the top entry. */
  bestMajorCharmOverall: CharmRecommendation | null;
  bestMinorCharmOverall: CharmRecommendation | null;
  rankedMajorCharms: CharmRecommendation[];
  rankedMinorCharms: CharmRecommendation[];
  expectedDamagePerHour: number;
  expectedProfitPerHour: number;
  expectedDamagePreventedPerHour: number;
  expectedHealingSavedPerHour: number;
  needsManualReview: boolean;
  warnings: LocalisedMessage[];
}

export interface CharmPurchaseSuggestion {
  charmId: CharmId;
  category: CharmCategory;
  monsterName: string;
  fromTier: number;
  toTier: number;
  cost: number;
  currency: 'charm_points' | 'minor_charm_echoes';
  scoreGain: number;
  scorePerCost: number;
}

export interface CharmReassignmentSuggestion {
  monsterName: string;
  category: CharmCategory;
  fromCharmId: CharmId | null;
  toCharmId: CharmId;
  removalCost: number;
  netScoreGain: number;
}

export interface MajorCharmSlotPlan {
  recommendedSlots: { monsterName: string; charmId: CharmId }[];
  unassignedCandidates: { monsterName: string; charmId: CharmId; reason: LocalisedMessage }[];
  slotLimit: number | null;
}

export interface EconomicsSummary {
  totalRemovalCost: number;
  resetCost: number;
  resetIsFree: boolean;
  cheaperOption: 'removals' | 'reset' | 'no_change';
}

export interface ExpectedImprovementSummary {
  extraDamagePerHour: number;
  extraProfitPerHour: number;
  extraDamagePreventedPerHour: number;
  extraHealingSavedPerHour: number;
}

export interface HuntOptimisationSummary {
  mode: OptimisationMode;
  creatureResults: CreatureOptimisationResult[];
  majorCharmSlotPlan: MajorCharmSlotPlan;
  rankedAlternatives: CharmRecommendation[];
  charmPointBudget: {
    available: number;
    suggestions: CharmPurchaseSuggestion[];
  };
  minorEchoBudget: {
    available: number;
    suggestions: CharmPurchaseSuggestion[];
  };
  reassignmentSuggestions: CharmReassignmentSuggestion[];
  economics: EconomicsSummary;
  expectedImprovementSummary: ExpectedImprovementSummary;
  creaturesLackingBestiaryData: string[];
  creaturesNeedingManualReview: string[];
}
