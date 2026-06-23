// Expected-value formulas for every Charm, plus the normalisation step that
// turns those raw (and very differently-scaled) numbers into the six
// comparable 0-100 scores the spec asks for.
//
// Documented estimation constants
// --------------------------------
// The Hunt Analyser block never reports per-monster attack counts or
// incoming damage, so a few named, deterministic assumptions stand in for
// them (see README "Limitations"). They are intentionally gathered here so
// every guess the optimiser makes is visible in one place:
//
// - ASSUMED_SECONDS_PER_ATTACK: most direct-damage attacks/spells in Tibia
//   share a ~2s cooldown across all five supported vocations. This sets a
//   TOTAL attacks/hour budget for the whole session; `optimiseCharms.ts`
//   splits that budget across species weighted by kills*hitpoints (a
//   tougher, more-killed species absorbs proportionally more attacks before
//   dying, the same way TibiaMaps' charm optimizer weights by hitpoints*
//   kills), not by kill count alone - see `ScoringContext.attacksPerHour`.
// - incomingDamagePerHourFromMonster (passed in via ScoringContext): approximated
//   by the optimiser from Healing/h, allocated per creature - see
//   `optimiseCharms.ts`.
// - ASSUMED_FIGHT_SECONDS_PER_KILL: 3600 / killsPerHour, i.e. it treats the
//   whole gap between kills as combat time against that creature. Used only
//   by the Cripple/Numb paralysis-uptime estimate.
// - ASSUMED_MANA_DRAIN_SHARE_OF_INCOMING: share of a mana-draining
//   creature's "incoming damage" assumed to land on mana instead of HP.
//
// Elemental Charm level cap (Winter Update 2024)
// -----------------------------------------------
// Since the Winter Update 2024, the 7 elemental-damage-on-attack Charms
// (Curse, Divine Wrath, Enflame, Freeze, Poison, Wound, Zap) cap their base
// damage at ELEMENTAL_CHARM_LEVEL_CAP_MULTIPLIER x character level, and
// Carnage caps at CARNAGE_LEVEL_CAP_MULTIPLIER x character level (3x the
// elemental cap, matching its 3x higher percentage - 15% vs 5% of HP).
// Without this cap, a low-level character would be modelled as dealing
// unrealistically large charm damage against very high-HP creatures.
import { PERCENT_HP_DAMAGE_CAP } from '@/data/charms';
import type { CharacterInput } from '@/types/character';
import type {
  CharmDefinition,
  CharmEffectEstimate,
  CharmTierDefinition,
  ConfidenceLevel,
  ElementType,
  LocalisedMessage,
  OptimisationMode,
  ScoreBreakdown,
  ScoreNormalisationBasis,
  ScoreWeights,
} from '@/types/charm';
import type { KilledMonsterStat } from '@/types/hunt';
import type { CorpseActionProfile, CreatureProductDrop, DataConfidence, MonsterProfile } from '@/types/monster';

export const ASSUMED_SECONDS_PER_ATTACK = 2;
export const ASSUMED_ATTACKS_PER_HOUR_WHILE_ACTIVE = 3600 / ASSUMED_SECONDS_PER_ATTACK;
export const ASSUMED_MANA_DRAIN_SHARE_OF_INCOMING = 0.3;
export const ELEMENTAL_CHARM_LEVEL_CAP_MULTIPLIER = 2;
export const CARNAGE_LEVEL_CAP_MULTIPLIER = 6;
export const ASSUMED_RISK_FACTOR_BY_DIFFICULTY: Record<string, number> = {
  harmless: 0.2,
  trivial: 0.4,
  easy: 0.6,
  medium: 0.8,
  hard: 1.0,
  challenging: 1.3,
  unknown: 0.7,
};
export const CONFIDENCE_SCORE_MULTIPLIER: Record<ConfidenceLevel, number> = {
  high: 1,
  medium: 0.85,
  low: 0.6,
  unknown: 0,
};

export interface ScoringContext {
  character: CharacterInput;
  monster: MonsterProfile;
  huntStat: KilledMonsterStat;
  /** Player's own damage dealt to this monster per hour (baseline, before this charm). */
  baseDamagePerHourAgainstMonster: number;
  /** Estimated damage the player takes FROM this monster per hour. */
  incomingDamagePerHourFromMonster: number;
  /** Estimated mana drained by this monster per hour (0 unless it inflicts mana drain). */
  manaDrainReceivedPerHour: number;
  /** True when incomingDamagePerHourFromMonster is a session-wide estimate rather than monster-specific data. */
  incomingDamageIsEstimated: boolean;
  /** This species' share of the session's total attacks/hour, weighted by kills*hitpoints (see optimiseCharms.ts) - not just kill share, since tougher creatures take more hits to kill. */
  attacksPerHour: number;
}

export function emptyEffect(): CharmEffectEstimate {
  return {
    expectedDamagePerHour: 0,
    expectedXpPerHour: 0,
    expectedProfitPerHour: 0,
    expectedDamagePreventedPerHour: 0,
    expectedHealingGainPerHour: 0,
    expectedManaGainPerHour: 0,
    expectedManaSavedPerHour: 0,
    utilityMagnitude: 0,
  };
}

/** Applies the Winter Update 2024 level cap; returns the (possibly capped) base damage and whether the cap actually bound. */
function applyLevelCap(uncappedBase: number, level: number, multiplier: number): { base: number; wasCapped: boolean } {
  const cap = level * multiplier;
  return uncappedBase > cap ? { base: cap, wasCapped: true } : { base: uncappedBase, wasCapped: false };
}

export function resistanceMultiplier(
  monster: MonsterProfile,
  element: ElementType,
): { multiplier: number; wasAssumedNeutral: boolean } {
  if (!monster.resistances) return { multiplier: 1, wasAssumedNeutral: true };
  return { multiplier: monster.resistances[element], wasAssumedNeutral: false };
}

/**
 * Extra kills/hour enabled by `extraDamagePerHour`, converted into the
 * incremental XP and profit that come from killing faster. This is what lets
 * every damage-dealing charm also contribute to xp_score/profit_score
 * without a second, unrelated formula.
 */
export function deriveXpAndProfitFromDamage(
  extraDamagePerHour: number,
  monster: MonsterProfile,
  huntStat: KilledMonsterStat,
): { xpPerHour: number; profitPerHour: number } {
  if (!monster.hitpoints || monster.hitpoints <= 0 || extraDamagePerHour <= 0) {
    return { xpPerHour: 0, profitPerHour: 0 };
  }
  const extraKillsPerHour = extraDamagePerHour / monster.hitpoints;
  const xpPerKill = monster.experience ?? huntStat.estimatedXpPerKill ?? 0;
  const lootPerKill = monster.averageLootValue ?? huntStat.estimatedLootPerKill ?? 0;
  return {
    xpPerHour: extraKillsPerHour * xpPerKill,
    profitPerHour: extraKillsPerHour * lootPerKill,
  };
}

export interface CharmEffectResult {
  effect: CharmEffectEstimate;
  warnings: LocalisedMessage[];
  confidence: ConfidenceLevel;
}

function withDerivedXpProfit(
  damagePerHour: number,
  ctx: ScoringContext,
  base: CharmEffectEstimate,
): CharmEffectEstimate {
  const derived = deriveXpAndProfitFromDamage(damagePerHour, ctx.monster, ctx.huntStat);
  return {
    ...base,
    expectedDamagePerHour: damagePerHour,
    expectedXpPerHour: derived.xpPerHour,
    expectedProfitPerHour: base.expectedProfitPerHour + derived.profitPerHour,
  };
}

const HP_UNKNOWN: LocalisedMessage = { code: 'hp_unknown' };
const RESISTANCE_UNKNOWN: LocalisedMessage = { code: 'resistance_unknown' };
const CONFIDENCE_RANK: Record<ConfidenceLevel | DataConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
  unknown: 0,
};

function elementLabel(charmName: string, element: ElementType, multiplier: number): LocalisedMessage {
  return { code: multiplier < 0 ? 'heals_from_element' : 'immune_to_element', params: { element, charmName } };
}

function combineConfidence(levels: (ConfidenceLevel | DataConfidence)[]): ConfidenceLevel {
  if (levels.length === 0) return 'high';
  return levels.reduce<ConfidenceLevel>((worst, level) => (CONFIDENCE_RANK[level] < CONFIDENCE_RANK[worst] ? level : worst), 'high');
}

function itemValue(npcPrice: number | null, marketPrice: number | null): number | null {
  return marketPrice ?? npcPrice;
}

function creatureProductEvPerKill(products: CreatureProductDrop[], warnings: LocalisedMessage[]): { value: number; confidence: ConfidenceLevel } {
  let total = 0;
  const confidenceInputs: (ConfidenceLevel | DataConfidence)[] = [];

  for (const product of products) {
    const value = itemValue(product.npcPrice, product.marketPrice);
    if (product.dropChance === null) {
      warnings.push({ code: 'unknown_creature_product_drop_chance', params: { itemName: product.itemName } });
      continue;
    }
    if (value === null) {
      warnings.push({ code: 'missing_product_price', params: { itemName: product.itemName } });
      continue;
    }
    total += product.dropChance * value;
    confidenceInputs.push(product.dropChanceConfidence);
  }

  return { value: total, confidence: confidenceInputs.length > 0 ? combineConfidence(confidenceInputs) : 'unknown' };
}

function scavengeProfitPerKill(actions: CorpseActionProfile[], tier: CharmTierDefinition, warnings: LocalisedMessage[]): { value: number; confidence: ConfidenceLevel } {
  let total = 0;
  const confidenceInputs: (ConfidenceLevel | DataConfidence)[] = [];

  warnings.push({ code: 'scavenge_relative_success_note' });
  for (const action of actions) {
    const value = itemValue(action.npcPrice, action.marketPrice);
    if (action.baseSuccessChance === null) {
      warnings.push({ code: 'unknown_scavenge_base_chance', params: { itemName: action.productItemName } });
      continue;
    }
    if (value === null) {
      warnings.push({ code: 'missing_product_price', params: { itemName: action.productItemName } });
      continue;
    }
    const successChanceDelta = Math.min(1 - action.baseSuccessChance, action.baseSuccessChance * tier.value);
    total += Math.max(0, successChanceDelta) * value;
    confidenceInputs.push(action.confidence, action.baseSuccessChanceConfidence);
  }

  return { value: total, confidence: confidenceInputs.length > 0 ? combineConfidence(confidenceInputs) : 'unknown' };
}

/** Computes the raw (unnormalised) effect of equipping `tier` of `charm` against the creature in `ctx`. */
export function computeCharmEffect(charm: CharmDefinition, tier: CharmTierDefinition, ctx: ScoringContext): CharmEffectResult {
  const warnings: LocalisedMessage[] = [];
  const { monster, character, huntStat } = ctx;
  const hp = monster.hitpoints;
  const activation = tier.activationChance ?? 0;

  switch (charm.effectKind) {
    case 'elemental_damage_on_attack': {
      const element = charm.element ?? 'physical';
      if (hp === null) {
        warnings.push(HP_UNKNOWN);
        return { effect: emptyEffect(), warnings, confidence: 'low' };
      }
      const { multiplier, wasAssumedNeutral } = resistanceMultiplier(monster, element);
      if (wasAssumedNeutral) warnings.push(RESISTANCE_UNKNOWN);
      if (multiplier <= 0) warnings.push(elementLabel(charm.name, element, multiplier));
      const { base: cappedBase, wasCapped } = applyLevelCap(hp * tier.value, character.level, ELEMENTAL_CHARM_LEVEL_CAP_MULTIPLIER);
      if (wasCapped) warnings.push({ code: 'damage_level_capped', params: { multiplier: ELEMENTAL_CHARM_LEVEL_CAP_MULTIPLIER } });
      const perAttack = cappedBase * activation * multiplier;
      const damagePerHour = Math.max(0, perAttack * ctx.attacksPerHour);
      return {
        effect: withDerivedXpProfit(damagePerHour, ctx, emptyEffect()),
        warnings,
        confidence: wasAssumedNeutral ? 'medium' : 'high',
      };
    }

    case 'aoe_damage_on_kill': {
      if (hp === null) {
        warnings.push(HP_UNKNOWN);
        return { effect: emptyEffect(), warnings, confidence: 'low' };
      }
      const { multiplier, wasAssumedNeutral } = resistanceMultiplier(monster, charm.element ?? 'physical');
      if (wasAssumedNeutral) warnings.push(RESISTANCE_UNKNOWN);
      warnings.push({ code: 'carnage_aoe_note' });
      const { base: cappedBase, wasCapped } = applyLevelCap(hp * tier.value, character.level, CARNAGE_LEVEL_CAP_MULTIPLIER);
      if (wasCapped) warnings.push({ code: 'damage_level_capped', params: { multiplier: CARNAGE_LEVEL_CAP_MULTIPLIER } });
      const perKill = cappedBase * activation * Math.max(0, multiplier);
      const killsPerHour = huntStat.killsPerHour ?? 0;
      const damagePerHour = Math.max(0, perKill * killsPerHour);
      return {
        effect: withDerivedXpProfit(damagePerHour, ctx, emptyEffect()),
        warnings,
        confidence: wasAssumedNeutral ? 'medium' : 'high',
      };
    }

    case 'percent_hitpoints_damage_on_attack': {
      if (hp === null) {
        warnings.push(HP_UNKNOWN);
        return { effect: emptyEffect(), warnings, confidence: 'low' };
      }
      const procDamage = Math.min(character.maxHitpoints * tier.value, hp * PERCENT_HP_DAMAGE_CAP);
      const perAttack = procDamage * activation;
      const damagePerHour = Math.max(0, perAttack * ctx.attacksPerHour);
      return {
        effect: withDerivedXpProfit(damagePerHour, ctx, emptyEffect()),
        warnings,
        confidence: 'high',
      };
    }

    case 'percent_mana_damage_on_attack': {
      if (hp === null) {
        warnings.push(HP_UNKNOWN);
        return { effect: emptyEffect(), warnings, confidence: 'low' };
      }
      if (character.maxMana <= 0) {
        warnings.push({ code: 'no_mana' });
        return { effect: emptyEffect(), warnings, confidence: 'high' };
      }
      const procDamage = Math.min(character.maxMana * tier.value, hp * PERCENT_HP_DAMAGE_CAP);
      const perAttack = procDamage * activation;
      const damagePerHour = Math.max(0, perAttack * ctx.attacksPerHour);
      return {
        effect: withDerivedXpProfit(damagePerHour, ctx, emptyEffect()),
        warnings,
        confidence: 'high',
      };
    }

    case 'dodge_incoming_damage': {
      if (ctx.incomingDamageIsEstimated) warnings.push({ code: 'incoming_damage_estimated' });
      const prevented = ctx.incomingDamagePerHourFromMonster * activation;
      return {
        effect: { ...emptyEffect(), expectedDamagePreventedPerHour: prevented },
        warnings,
        confidence: ctx.incomingDamageIsEstimated ? 'medium' : 'high',
      };
    }

    case 'reflect_incoming_damage': {
      if (ctx.incomingDamageIsEstimated) warnings.push({ code: 'incoming_damage_estimated' });
      warnings.push({ code: 'parry_armour_note' });
      const reflected = ctx.incomingDamagePerHourFromMonster * activation;
      return {
        effect: withDerivedXpProfit(reflected, ctx, emptyEffect()),
        warnings,
        confidence: ctx.incomingDamageIsEstimated ? 'medium' : 'high',
      };
    }

    case 'critical_chance_bonus': {
      const gain = ctx.baseDamagePerHourAgainstMonster * tier.value * (character.criticalDamageBonus / 100);
      return {
        effect: withDerivedXpProfit(Math.max(0, gain), ctx, emptyEffect()),
        warnings,
        confidence: 'medium',
      };
    }

    case 'critical_damage_bonus': {
      const gain = ctx.baseDamagePerHourAgainstMonster * (character.criticalChance / 100) * tier.value;
      if (character.criticalChance <= 0) warnings.push({ code: 'no_crit_chance' });
      return {
        effect: withDerivedXpProfit(Math.max(0, gain), ctx, emptyEffect()),
        warnings,
        confidence: 'medium',
      };
    }

    case 'life_leech_bonus': {
      if (character.lifeLeechPercent <= 0) {
        warnings.push({ code: 'no_life_leech' });
        return { effect: emptyEffect(), warnings, confidence: 'high' };
      }
      const healingGain = ctx.baseDamagePerHourAgainstMonster * tier.value;
      return {
        effect: { ...emptyEffect(), expectedHealingGainPerHour: healingGain },
        warnings,
        confidence: 'high',
      };
    }

    case 'mana_leech_bonus': {
      if (character.manaLeechPercent <= 0) {
        warnings.push({ code: 'no_mana_leech' });
        return { effect: emptyEffect(), warnings, confidence: 'high' };
      }
      const manaGain = ctx.baseDamagePerHourAgainstMonster * tier.value;
      return {
        effect: { ...emptyEffect(), expectedManaGainPerHour: manaGain },
        warnings,
        confidence: 'high',
      };
    }

    case 'mana_drain_inversion': {
      if (!monster.damageProfile?.inflictsManaDrain) {
        warnings.push({ code: 'no_mana_drain' });
        return { effect: emptyEffect(), warnings, confidence: 'high' };
      }
      warnings.push({ code: 'mana_drain_estimated' });
      const saved = ctx.manaDrainReceivedPerHour * activation;
      return {
        effect: { ...emptyEffect(), expectedManaSavedPerHour: saved },
        warnings,
        confidence: 'low',
      };
    }

    case 'creature_product_bonus': {
      if (monster.creatureProducts.length > 0) {
        const productEv = creatureProductEvPerKill(monster.creatureProducts, warnings);
        const profit = (huntStat.killsPerHour ?? 0) * productEv.value * tier.value;
        return {
          effect: { ...emptyEffect(), expectedProfitPerHour: profit },
          warnings,
          confidence: productEv.confidence,
        };
      }
      if (monster.creatureProductValue === null) {
        warnings.push({ code: 'no_creature_product_data' });
        return { effect: emptyEffect(), warnings, confidence: 'unknown' };
      }
      const profit = (huntStat.killsPerHour ?? 0) * monster.creatureProductValue * tier.value;
      return {
        effect: { ...emptyEffect(), expectedProfitPerHour: profit },
        warnings,
        confidence: 'low',
      };
    }

    case 'skinning_dusting_bonus': {
      const actions = [monster.skinning, monster.dusting].filter((action): action is CorpseActionProfile => action?.eligible === true);
      if (actions.length === 0) {
        warnings.push({ code: 'no_skinning_dusting_data' });
        return { effect: emptyEffect(), warnings, confidence: 'unknown' };
      }
      const scavengeEv = scavengeProfitPerKill(actions, tier, warnings);
      const profit = (huntStat.killsPerHour ?? 0) * scavengeEv.value;
      return {
        effect: { ...emptyEffect(), expectedProfitPerHour: profit },
        warnings,
        confidence: scavengeEv.confidence,
      };
    }

    case 'paralyse_creature_on_attack':
    case 'paralyse_creature_on_hit_received': {
      const killsPerHour = huntStat.killsPerHour;
      if (!killsPerHour || killsPerHour <= 0) {
        return { effect: { ...emptyEffect(), utilityMagnitude: activation }, warnings, confidence: 'low' };
      }
      warnings.push({ code: 'paralysis_uptime_estimated' });
      const avgSecondsPerKill = 3600 / killsPerHour;
      const uptimeFraction = Math.min(1, (activation * tier.value) / avgSecondsPerKill);
      const prevented = ctx.incomingDamagePerHourFromMonster * uptimeFraction;
      return {
        effect: { ...emptyEffect(), expectedDamagePreventedPerHour: prevented, utilityMagnitude: activation },
        warnings,
        confidence: 'low',
      };
    }

    case 'prevent_flee': {
      warnings.push({ code: 'fatal_hold_note' });
      return { effect: { ...emptyEffect(), utilityMagnitude: activation }, warnings, confidence: 'low' };
    }

    case 'movement_speed_on_hit_received': {
      warnings.push({ code: 'adrenaline_burst_haste_note' });
      return { effect: { ...emptyEffect(), utilityMagnitude: activation }, warnings, confidence: 'low' };
    }

    case 'condition_cleanse_on_hit_received': {
      const relevance = monster.conditions.length > 0 ? 1 : 0.15;
      if (monster.conditions.length === 0) warnings.push({ code: 'no_conditions_known' });
      return { effect: { ...emptyEffect(), utilityMagnitude: activation * relevance }, warnings, confidence: 'low' };
    }

    case 'death_penalty_reduction': {
      const riskFactor = ASSUMED_RISK_FACTOR_BY_DIFFICULTY[monster.difficulty] ?? 0.7;
      warnings.push({ code: 'bless_risk_note' });
      return { effect: { ...emptyEffect(), utilityMagnitude: tier.value * riskFactor }, warnings, confidence: 'low' };
    }

    default:
      return { effect: emptyEffect(), warnings, confidence: 'low' };
  }
}

export const MODE_WEIGHTS: Record<OptimisationMode, ScoreWeights> = {
  // Mirrors the spec's default total_score formula exactly (xp excluded).
  balanced: { damage: 0.4, xp: 0, profit: 0.25, safety: 0.2, supplySaving: 0.1, utility: 0.05 },
  xp: { damage: 0.3, xp: 0.45, profit: 0.1, safety: 0.1, supplySaving: 0.025, utility: 0.025 },
  profit: { damage: 0.2, xp: 0, profit: 0.55, safety: 0.1, supplySaving: 0.1, utility: 0.05 },
  safety: { damage: 0.15, xp: 0, profit: 0.1, safety: 0.5, supplySaving: 0.2, utility: 0.05 },
  low_supplies: { damage: 0.15, xp: 0, profit: 0.1, safety: 0.25, supplySaving: 0.45, utility: 0.05 },
};

export interface ScorableCandidate {
  effect: CharmEffectEstimate;
  confidence?: ConfidenceLevel;
}

export type ScoreMaxima = ScoreNormalisationBasis;

/** The normalisation basis for one comparison set (e.g. "all Major Charms for Crusader"). Exposed separately so purchase suggestions can score a hypothetical tier upgrade against the same basis without re-normalising the whole set. */
export function computeMaxima(effects: CharmEffectEstimate[]): ScoreMaxima {
  const maxOf = (pick: (e: CharmEffectEstimate) => number) => Math.max(1e-9, ...effects.map(pick));
  return {
    damage: maxOf((e) => e.expectedDamagePerHour),
    xp: maxOf((e) => e.expectedXpPerHour),
    profit: maxOf((e) => e.expectedProfitPerHour),
    safety: maxOf((e) => e.expectedDamagePreventedPerHour),
    supplySaving: maxOf((e) => e.expectedHealingGainPerHour + e.expectedManaGainPerHour + e.expectedManaSavedPerHour),
    utility: maxOf((e) => e.utilityMagnitude),
  };
}

/**
 * Min-max normalises one effect against `maxima` before weighting, so e.g.
 * Wound's damage/hour (thousands) and Cleanse's utility magnitude (0-1) can
 * be summed with the same weights meaningfully.
 */
export function scoreEffect(
  effect: CharmEffectEstimate,
  maxima: ScoreMaxima,
  weights: ScoreWeights,
  confidence: ConfidenceLevel = 'high',
): ScoreBreakdown {
  const damageScore = (effect.expectedDamagePerHour / maxima.damage) * 100;
  const xpScore = (effect.expectedXpPerHour / maxima.xp) * 100;
  const profitScore = (effect.expectedProfitPerHour / maxima.profit) * 100;
  const safetyScore = (effect.expectedDamagePreventedPerHour / maxima.safety) * 100;
  const supplySavingScore =
    ((effect.expectedHealingGainPerHour + effect.expectedManaGainPerHour + effect.expectedManaSavedPerHour) /
      maxima.supplySaving) *
    100;
  const utilityScore = (effect.utilityMagnitude / maxima.utility) * 100;

  const rawTotalScore =
    damageScore * weights.damage +
    xpScore * weights.xp +
    profitScore * weights.profit +
    safetyScore * weights.safety +
    supplySavingScore * weights.supplySaving +
    utilityScore * weights.utility;
  const confidenceMultiplier = CONFIDENCE_SCORE_MULTIPLIER[confidence];
  const totalScore = rawTotalScore * confidenceMultiplier;

  return {
    damageScore,
    xpScore,
    profitScore,
    safetyScore,
    supplySavingScore,
    utilityScore,
    normalisationBasis: { ...maxima },
    weights: { ...weights },
    rawTotalScore,
    confidenceMultiplier,
    totalScore,
  };
}

/**
 * Min-max normalises each metric to 0-100 across `candidates` before
 * weighting. Ranking is always relative to the candidates passed in (the
 * other charms of the same category being considered for the same creature).
 */
export function scoreCandidates(candidates: ScorableCandidate[], weights: ScoreWeights): ScoreBreakdown[] {
  const maxima = computeMaxima(candidates.map((c) => c.effect));
  return candidates.map(({ effect, confidence }) => scoreEffect(effect, maxima, weights, confidence));
}
