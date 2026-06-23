// Charm catalogue types: definitions, tiers, scoring and recommendation shapes.

export type MajorCharmId =
  | 'carnage'
  | 'curse'
  | 'divine_wrath'
  | 'dodge'
  | 'enflame'
  | 'freeze'
  | 'low_blow'
  | 'overpower'
  | 'overflux'
  | 'parry'
  | 'poison'
  | 'savage_blow'
  | 'wound'
  | 'zap';

export type MinorCharmId =
  | 'adrenaline_burst'
  | 'bless'
  | 'cleanse'
  | 'cripple'
  | 'gut'
  | 'numb'
  | 'scavenge'
  | 'fatal_hold'
  | 'vampiric_embrace'
  | 'void_inversion'
  | 'voids_call';

export type CharmId = MajorCharmId | MinorCharmId;

export type CharmCategory = 'major' | 'minor';

/** 1 = Bronze (unlocked), 2 = Silver, 3 = Gold. */
export type CharmTier = 1 | 2 | 3;

export type CharmCurrency = 'charm_points' | 'minor_charm_echoes';

export type ElementType = 'physical' | 'fire' | 'earth' | 'energy' | 'ice' | 'holy' | 'death';

/**
 * Discriminates how a charm's tier `value` should be interpreted and which
 * formula in `charmScoring.ts` applies. Kept separate from `element` so the
 * scoring engine can `switch` on behaviour rather than charm identity.
 */
export type CharmEffectKind =
  | 'elemental_damage_on_attack'
  | 'aoe_damage_on_kill'
  | 'percent_hitpoints_damage_on_attack'
  | 'percent_mana_damage_on_attack'
  | 'dodge_incoming_damage'
  | 'reflect_incoming_damage'
  | 'critical_chance_bonus'
  | 'critical_damage_bonus'
  | 'movement_speed_on_hit_received'
  | 'death_penalty_reduction'
  | 'condition_cleanse_on_hit_received'
  | 'paralyse_creature_on_attack'
  | 'paralyse_creature_on_hit_received'
  | 'creature_product_bonus'
  | 'skinning_dusting_bonus'
  | 'prevent_flee'
  | 'life_leech_bonus'
  | 'mana_leech_bonus'
  | 'mana_drain_inversion';

export interface CharmTierDefinition {
  tier: CharmTier;
  cost: number;
  /** Fraction 0-1. Undefined for always-on (passive) charms such as Gut or Bless. */
  activationChance?: number;
  /** Effect magnitude for this tier. Fractions (percentages) are stored 0-1. */
  value: number;
}

export interface CharmDefinition {
  id: CharmId;
  category: CharmCategory;
  name: string;
  /** i18n dictionary key under `charms.<id>.description`. */
  descriptionKey: string;
  currency: CharmCurrency;
  effectKind: CharmEffectKind;
  element?: ElementType;
  tiers: readonly [CharmTierDefinition, CharmTierDefinition, CharmTierDefinition];
}

export interface ScoreBreakdown {
  damageScore: number;
  xpScore: number;
  profitScore: number;
  safetyScore: number;
  supplySavingScore: number;
  utilityScore: number;
  /** Per-dimension maxima from the comparison set used to normalise raw effect values to 0-100. */
  normalisationBasis: ScoreNormalisationBasis;
  /** Optimisation-mode weights applied to the normalised dimension scores. */
  weights: ScoreWeights;
  /** Weighted score before confidence adjustment. */
  rawTotalScore: number;
  /** Multiplier applied to the raw score for data confidence. */
  confidenceMultiplier: number;
  /** Weighted score after confidence adjustment; this is what ranking uses. */
  totalScore: number;
}

export interface ScoreNormalisationBasis {
  damage: number;
  xp: number;
  profit: number;
  safety: number;
  supplySaving: number;
  utility: number;
}

export interface CharmModelBreakdown {
  effectKind: CharmEffectKind;
  element?: ElementType;
  hitpoints: number | null;
  characterLevel: number;
  characterMaxHitpoints: number;
  characterMaxMana: number;
  criticalChance: number;
  criticalDamageBonus: number;
  lifeLeechPercent: number;
  manaLeechPercent: number;
  tierValue: number;
  activationChance: number | null;
  resistanceMultiplier: number | null;
  mitigationMultiplier: number | null;
  levelCapMultiplier: number | null;
  uncappedBaseDamage: number | null;
  levelCapDamage: number | null;
  baseDamage: number | null;
  wasLevelCapped: boolean | null;
  perProcDamage: number | null;
  expectedPerTrigger: number | null;
  triggersPerHour: number | null;
  triggerUnit: 'attack' | 'kill' | 'incoming_hit' | 'none';
  kills: number;
  killShare: number;
  killsPerHour: number | null;
  attacksPerHour: number;
  baseDamagePerHourAgainstMonster: number;
  incomingDamagePerHourFromMonster: number;
  manaDrainReceivedPerHour: number;
  fleeHealthPercent: number | null;
}

export type OptimisationMode = 'balanced' | 'xp' | 'profit' | 'safety' | 'low_supplies';

/** Which charms count as candidates for "best charm": every Charm regardless of unlock status (`full_analysis`, the default - useful before filling in Unlocked Charms at all), or only what the player has actually unlocked (`my_charms`). */
export type RecommendationScope = 'full_analysis' | 'my_charms';

export interface ScoreWeights {
  damage: number;
  xp: number;
  profit: number;
  safety: number;
  supplySaving: number;
  utility: number;
}

export interface CharmEffectEstimate {
  expectedDamagePerHour: number;
  expectedXpPerHour: number;
  expectedProfitPerHour: number;
  expectedDamagePreventedPerHour: number;
  expectedHealingGainPerHour: number;
  expectedManaGainPerHour: number;
  expectedManaSavedPerHour: number;
  /** 0-1 magnitude for charms with no natural currency/damage unit (e.g. Cleanse, Bless, Adrenaline Burst). */
  utilityMagnitude: number;
  /** Human-readable note for charms whose value is mostly qualitative (e.g. Cleanse, Bless). */
  utilityNote?: string;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown';

/**
 * A translatable piece of generated text. `code` looks up a template in
 * `Dictionary.messages` (see src/locales) and `params` fill in its
 * `{{placeholders}}` - this is what lets the optimiser's explanations and
 * warnings render in either interface language instead of being baked into
 * one. See `formatMessage` in src/lib/messages.ts.
 */
export interface LocalisedMessage {
  code: string;
  params?: Record<string, string | number>;
}

export interface CharmRecommendation {
  charmId: CharmId;
  category: CharmCategory;
  name: string;
  /** Which creature this recommendation was scored against - the same Charm appears once per creature in a cross-creature list like "ranked alternatives", with a different score each time, so callers that flatten across creatures need this to label rows. */
  monsterName: string;
  /** The tier this recommendation is evaluated at: the tier actually owned if unlocked, otherwise the user's configured target tier ceiling (Gold by default - see workspace.tsx's `targetTier`). */
  tier: CharmTier;
  unlocked: boolean;
  effect: CharmEffectEstimate;
  calculation: CharmModelBreakdown;
  scores: ScoreBreakdown;
  /** total_score divided by the cumulative Charm Point cost to reach `tier` from scratch, null for minor charms or zero-cost cases. */
  scorePerCharmPoint: number | null;
  /** total_score divided by the cumulative Minor Charm Echo cost to reach `tier` from scratch, null for major charms. */
  scorePerMinorCharmEcho: number | null;
  confidence: ConfidenceLevel;
  reason: LocalisedMessage;
  warnings: LocalisedMessage[];
}
