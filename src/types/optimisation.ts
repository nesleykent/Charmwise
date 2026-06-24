// Aggregate result types produced by `optimiseCharms.ts`.
import type { CharmCategory, CharmId, CharmRecommendation, CharmRole, LocalisedMessage, OptimisationMode } from './charm';
import type { KilledMonsterStat } from './hunt';
import type { MonsterProfile } from './monster';

export interface CreatureOptimisationResult {
  monsterName: string;
  matchedProfile: MonsterProfile | null;
  huntStat: KilledMonsterStat;
  hasBestiaryData: boolean;
  /** Best among Charms the player has actually unlocked - null if none are. The first role in ROLE_PRIORITY order (damage-first) that won this creature a slot - see `bestMajorCharmByRole` for the other roles' own solved, conflict-free picks. */
  bestMajorCharm: CharmRecommendation | null;
  bestMinorCharm: CharmRecommendation | null;
  /** Every role's own globally assignment-solved pick for this creature, keyed by role - what a non-default role view should read instead of re-ranking independently (that re-ranking can recommend the same Charm to two creatures at once - the bug `assignmentSolver.ts` exists to prevent). Absent entry = no unlocked, eligible Charm of that role won a slot. */
  bestMajorCharmByRole: Partial<Record<CharmRole, CharmRecommendation>>;
  bestMinorCharmByRole: Partial<Record<CharmRole, CharmRecommendation>>;
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
  role: CharmRole;
  monsterName: string;
  fromTier: number;
  toTier: number;
  cost: number;
  currency: 'charm_points' | 'minor_charm_echoes';
  /** Raw, real-unit gain in the charm's own role metric (e.g. extra damage/hour) - never a blend across roles. */
  metricGain: number;
  metricPerCost: number;
}

export interface CharmReassignmentSuggestion {
  monsterName: string;
  category: CharmCategory;
  fromCharmId: CharmId | null;
  toCharmId: CharmId;
  /** The recommended (toCharmId) Charm's role - always well-defined, unlike the currently-assigned Charm's, which the player chose freely and may not even share a role with the recommendation. */
  toRole: CharmRole;
  removalCost: number;
  /** roleMetric gain in toRole's unit. Null when a Charm is currently assigned but in a DIFFERENT role than the recommendation - there is no single real number for "gain" across two different units in that case, so the UI shows the swap by role instead of inventing a cross-unit delta. */
  netMetricGain: number | null;
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
