// Orchestrates the whole pipeline: parsed Hunt Analyser data + character
// input + bestiary profiles -> ranked Charm recommendations for each
// creature and for the hunt as a whole.
import { solveAssignment } from '@/lib/assignmentSolver';
import { EFFECT_KIND_TO_ROLE, MAJOR_CHARM_LIST, MINOR_CHARM_LIST, PERCENT_HP_DAMAGE_CAP, ROLE_PRIORITY, getCharmDefinition } from '@/data/charms';
import {
  ASSUMED_ATTACKS_PER_HOUR_WHILE_ACTIVE,
  ASSUMED_MANA_DRAIN_SHARE_OF_INCOMING,
  CONFIDENCE_SCORE_MULTIPLIER,
  computeCharmEffect,
  emptyEffect,
  roleMetricFor,
  resistanceMultiplier,
  monsterMitigationMultiplier,
  ELEMENTAL_CHARM_LEVEL_CAP_MULTIPLIER,
  CARNAGE_LEVEL_CAP_MULTIPLIER,
  type ScoringContext,
} from '@/lib/charmScoring';
import { calculateMajorCharmSlotLimit, calculateRemovalCost, calculateResetCost } from '@/lib/economy';
import { getBestiaryEntries, normaliseMonster } from '@/lib/normaliseMonster';
import { parseHuntAnalyser } from '@/lib/parseHuntAnalyser';
import type { AssignedCharm, CharacterInput, UnlockedCharm } from '@/types/character';
import type {
  CharmCategory,
  CharmDefinition,
  CharmEffectEstimate,
  CharmId,
  CharmModelBreakdown,
  CharmRecommendation,
  CharmRole,
  CharmTier,
  CharmTierDefinition,
  LocalisedMessage,
  OptimisationMode,
} from '@/types/charm';
import type { HuntAnalyserParseResult, KilledMonsterStat } from '@/types/hunt';
import type { MonsterProfile, RawBestiaryEntry } from '@/types/monster';
import type {
  CharmPurchaseSuggestion,
  CharmReassignmentSuggestion,
  CreatureOptimisationResult,
  HuntOptimisationSummary,
  MajorCharmSlotPlan,
} from '@/types/optimisation';

function getTierDefinition(charm: CharmDefinition, tier: CharmTier): CharmTierDefinition {
  return charm.tiers[tier - 1]!;
}

function costToReachTier(charm: CharmDefinition, fromTier: number, toTier: number): number {
  let cost = 0;
  for (let t = fromTier + 1; t <= toTier; t++) cost += charm.tiers[t - 1]!.cost;
  return cost;
}

function getUnlockedTier(list: UnlockedCharm[], charmId: CharmId): CharmTier | null {
  return list.find((u) => u.charmId === charmId)?.tier ?? null;
}

function getAssignedCharmId(list: AssignedCharm[], monsterName: string): CharmId | null {
  return list.find((a) => a.creatureName.toLowerCase() === monsterName.toLowerCase())?.charmId ?? null;
}

/** Proportional split of `total` across `weights` (falls back to an even split when every weight is zero/unknown). */
function allocateByWeight(total: number, weights: number[]): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum <= 0) {
    const evenShare = total / Math.max(1, weights.length);
    return weights.map(() => evenShare);
  }
  return weights.map((w) => (w / sum) * total);
}

function buildReason(rankIndex: number, unlocked: boolean, role: CharmRole, lockedAtTier: CharmTier): LocalisedMessage {
  if (rankIndex === 0 && unlocked) return { code: 'reason_top_unlocked', params: { role } };
  if (rankIndex === 0 && !unlocked) return { code: 'reason_top_locked', params: { role, tier: lockedAtTier } };
  if (unlocked) return { code: 'reason_ranked_unlocked', params: { rank: rankIndex + 1, role } };
  return { code: 'reason_ranked_locked', params: { rank: rankIndex + 1, role, tier: lockedAtTier } };
}

function buildCalculationBreakdown(
  charm: CharmDefinition,
  tier: CharmTierDefinition,
  ctx: ScoringContext,
  effect: CharmEffectEstimate,
): CharmModelBreakdown {
  const hp = ctx.monster.hitpoints;
  const activationChance = tier.activationChance ?? null;
  const { multiplier: mitigationMultiplier, wasAssumedNone: mitigationWasAssumed } = monsterMitigationMultiplier(ctx.monster);
  const base: CharmModelBreakdown = {
    effectKind: charm.effectKind,
    element: charm.element,
    hitpoints: hp,
    characterLevel: ctx.character.level,
    characterMaxHitpoints: ctx.character.maxHitpoints,
    characterMaxMana: ctx.character.maxMana,
    criticalChance: ctx.character.criticalChance,
    criticalDamageBonus: ctx.character.criticalDamageBonus,
    lifeLeechPercent: ctx.character.lifeLeechPercent,
    manaLeechPercent: ctx.character.manaLeechPercent,
    tierValue: tier.value,
    activationChance,
    resistanceMultiplier: null,
    mitigationMultiplier: mitigationWasAssumed ? null : mitigationMultiplier,
    levelCapMultiplier: null,
    uncappedBaseDamage: null,
    levelCapDamage: null,
    baseDamage: null,
    wasLevelCapped: null,
    perProcDamage: null,
    expectedPerTrigger: null,
    triggersPerHour: null,
    triggerUnit: 'none',
    kills: ctx.huntStat.kills,
    killShare: ctx.huntStat.killShare,
    killsPerHour: ctx.huntStat.killsPerHour,
    attacksPerHour: ctx.attacksPerHour,
    baseDamagePerHourAgainstMonster: ctx.baseDamagePerHourAgainstMonster,
    incomingDamagePerHourFromMonster: ctx.incomingDamagePerHourFromMonster,
    manaDrainReceivedPerHour: ctx.manaDrainReceivedPerHour,
    fleeHealthPercent: ctx.monster.fleeHealthPercent,
  };

  if (hp === null) return base;

  if (charm.effectKind === 'elemental_damage_on_attack' || charm.effectKind === 'aoe_damage_on_kill') {
    const capMultiplier = charm.effectKind === 'aoe_damage_on_kill' ? CARNAGE_LEVEL_CAP_MULTIPLIER : ELEMENTAL_CHARM_LEVEL_CAP_MULTIPLIER;
    const uncappedBaseDamage = hp * tier.value;
    const levelCapDamage = ctx.character.level * capMultiplier;
    const baseDamage = Math.min(uncappedBaseDamage, levelCapDamage);
    const { multiplier } = resistanceMultiplier(ctx.monster, charm.element ?? 'physical');
    const perProcDamage = baseDamage * Math.max(0, multiplier) * mitigationMultiplier;
    return {
      ...base,
      resistanceMultiplier: multiplier,
      levelCapMultiplier: capMultiplier,
      uncappedBaseDamage,
      levelCapDamage,
      baseDamage,
      wasLevelCapped: uncappedBaseDamage > levelCapDamage,
      perProcDamage,
      expectedPerTrigger: activationChance === null ? perProcDamage : perProcDamage * activationChance,
      triggersPerHour: charm.effectKind === 'aoe_damage_on_kill' ? ctx.huntStat.killsPerHour : ctx.attacksPerHour,
      triggerUnit: charm.effectKind === 'aoe_damage_on_kill' ? 'kill' : 'attack',
    };
  }

  if (charm.effectKind === 'percent_hitpoints_damage_on_attack' || charm.effectKind === 'percent_mana_damage_on_attack') {
    const resource = charm.effectKind === 'percent_hitpoints_damage_on_attack' ? ctx.character.maxHitpoints : ctx.character.maxMana;
    const uncappedBaseDamage = resource * tier.value;
    const levelCapDamage = hp * PERCENT_HP_DAMAGE_CAP;
    const baseDamage = Math.min(uncappedBaseDamage, levelCapDamage);
    const perProcDamage = baseDamage * mitigationMultiplier;
    return {
      ...base,
      uncappedBaseDamage,
      levelCapDamage,
      baseDamage,
      wasLevelCapped: uncappedBaseDamage > levelCapDamage,
      perProcDamage,
      expectedPerTrigger: activationChance === null ? perProcDamage : perProcDamage * activationChance,
      triggersPerHour: ctx.attacksPerHour,
      triggerUnit: 'attack',
    };
  }

  if (charm.effectKind === 'dodge_incoming_damage' || charm.effectKind === 'reflect_incoming_damage') {
    return {
      ...base,
      expectedPerTrigger:
        charm.effectKind === 'dodge_incoming_damage' ? effect.expectedDamagePreventedPerHour : effect.expectedDamagePerHour,
      triggerUnit: 'incoming_hit',
    };
  }

  return base;
}

function addEffects(a: CharmEffectEstimate, b: CharmEffectEstimate): CharmEffectEstimate {
  return {
    expectedDamagePerHour: a.expectedDamagePerHour + b.expectedDamagePerHour,
    expectedXpPerHour: a.expectedXpPerHour + b.expectedXpPerHour,
    expectedProfitPerHour: a.expectedProfitPerHour + b.expectedProfitPerHour,
    expectedDamagePreventedPerHour: a.expectedDamagePreventedPerHour + b.expectedDamagePreventedPerHour,
    expectedHealingGainPerHour: a.expectedHealingGainPerHour + b.expectedHealingGainPerHour,
    expectedManaGainPerHour: a.expectedManaGainPerHour + b.expectedManaGainPerHour,
    expectedManaSavedPerHour: a.expectedManaSavedPerHour + b.expectedManaSavedPerHour,
    utilityMagnitude: a.utilityMagnitude + b.utilityMagnitude,
  };
}

interface RankedGroup {
  recommendations: CharmRecommendation[];
  /** Best among unlocked Charms only - what the player can actually equip right now. */
  best: CharmRecommendation | null;
  /** Best overall regardless of unlock status - the Full Analysis view. */
  bestOverall: CharmRecommendation | null;
}

/**
 * Ranks every charm in `charmList` for one creature: unlocked charms use the
 * tier the player owns, locked charms are evaluated at `targetTier` - their
 * realistic ceiling - not Tier 1. Tier 1 made every locked charm look weaker
 * than it really is (Gold's activation chance typically runs 2.2x Tier 1's
 * for the same charm), which is why "why only Tier 1" recommendations showed
 * up everywhere a locked charm was ranked. `targetTier` defaults to Gold but
 * is user-configurable - not every Charm Point budget realistically reaches
 * Gold on everything, so the ceiling (and the "is this worth pursuing"
 * framing built on it) should match what's actually achievable. `best` still
 * only considers unlocked charms - that's the "what should I equip right
 * now" view, unaffected by `targetTier`.
 */
function rankCharmGroup(
  charmList: CharmDefinition[],
  category: CharmCategory,
  unlockedList: UnlockedCharm[],
  ctx: ScoringContext,
  targetTier: CharmTier,
): RankedGroup {
  const evaluations = charmList.map((charm) => {
    const ownedTier = getUnlockedTier(unlockedList, charm.id);
    const unlocked = ownedTier !== null;
    const tier: CharmTier = ownedTier ?? targetTier;
    const { effect, warnings, confidence } = computeCharmEffect(charm, getTierDefinition(charm, tier), ctx);
    const role = EFFECT_KIND_TO_ROLE[charm.effectKind];
    const roleMetric = roleMetricFor(effect, role) * CONFIDENCE_SCORE_MULTIPLIER[confidence];
    return { charm, tier, unlocked, effect, warnings, confidence, role, roleMetric };
  });

  // Primary: fixed role-priority order (damage-first, see ROLE_PRIORITY) -
  // this list spans every role at once (e.g. Wound [damage] and Parry
  // [defensive] both appear here for the same creature), so sorting by raw
  // roleMetric alone would silently compare damage/hour against
  // damage-prevented/hour. Only the *group* order is fixed; within a role,
  // ranking is purely by that role's own roleMetric. Secondary: cost
  // efficiency (roleMetric per point spent to reach the evaluated tier) -
  // ties within a role happen routinely (e.g. Cripple/Numb share identical
  // game data), and this is a meaningful signal rather than an arbitrary
  // alphabetical tiebreak. Charm id is the final, fully deterministic
  // fallback for when even that matches.
  evaluations.sort((a, b) => {
    const priorityDiff = ROLE_PRIORITY.indexOf(a.role) - ROLE_PRIORITY.indexOf(b.role);
    if (priorityDiff !== 0) return priorityDiff;
    const metricDiff = b.roleMetric - a.roleMetric;
    if (metricDiff !== 0) return metricDiff;
    const aCost = costToReachTier(a.charm, 0, a.tier);
    const bCost = costToReachTier(b.charm, 0, b.tier);
    const aDensity = aCost > 0 ? a.roleMetric / aCost : a.roleMetric;
    const bDensity = bCost > 0 ? b.roleMetric / bCost : b.roleMetric;
    return bDensity - aDensity || a.charm.id.localeCompare(b.charm.id);
  });

  const recommendations: CharmRecommendation[] = evaluations.map((entry, index) => {
    // Cumulative cost from scratch to the evaluated tier, not just that
    // tier's incremental price - Gold can't be bought without Bronze and
    // Silver first, so "metric per point" must reflect the full spend.
    const totalCostToTier = costToReachTier(entry.charm, 0, entry.tier);
    return {
      charmId: entry.charm.id,
      category,
      name: entry.charm.name,
      monsterName: ctx.huntStat.monsterName,
      tier: entry.tier,
      unlocked: entry.unlocked,
      effect: entry.effect,
      calculation: buildCalculationBreakdown(entry.charm, getTierDefinition(entry.charm, entry.tier), ctx, entry.effect),
      role: entry.role,
      roleMetric: entry.roleMetric,
      roleMetricPerCharmPoint: entry.charm.currency === 'charm_points' ? entry.roleMetric / totalCostToTier : null,
      roleMetricPerMinorCharmEcho: entry.charm.currency === 'minor_charm_echoes' ? entry.roleMetric / totalCostToTier : null,
      confidence: entry.confidence,
      reason: buildReason(index, entry.unlocked, entry.role, entry.tier),
      warnings: entry.warnings,
    };
  });

  const best = recommendations.find((r) => r.unlocked && r.confidence !== 'unknown' && r.roleMetric > 0) ?? null;
  const bestOverall = recommendations.find((r) => r.confidence !== 'unknown' && r.roleMetric > 0) ?? null;
  return { recommendations, best, bestOverall };
}

interface CreatureContext {
  monsterName: string;
  profile: MonsterProfile;
  ctx: ScoringContext;
}

/** Every real Charm role - excludes `budget_damage`, which is a view/mode concept (damage, cost-ranked) rather than a role any Charm is ever assigned. */
const ASSIGNABLE_ROLES: CharmRole[] = ROLE_PRIORITY.filter((role) => role !== 'budget_damage');

/**
 * A specific unlocked Charm can only be actively assigned to one creature at
 * a time (confirmed - see README); ranking charms independently per creature,
 * as `rankedMajorCharms`/`rankedMinorCharms` still does for exploration, can
 * recommend the same charm for two different creatures at once, which the
 * player cannot actually act on. This solves the real one-charm-per-creature,
 * one-creature-per-charm assignment globally across the whole hunt, scoped to
 * a single `role` so the DP's objective only ever compares charms in the
 * same real unit - optionally capped at `slotLimit` total assignments - and
 * returns the winning `CharmRecommendation` per creature, keyed by monster
 * name.
 */
function solveRoleCharmAssignment(
  creatureResults: CreatureOptimisationResult[],
  unlockedCharmIds: CharmId[],
  category: CharmCategory,
  role: CharmRole,
  slotLimit: number | undefined,
): Map<string, CharmRecommendation> {
  const assignment = new Map<string, CharmRecommendation>();
  const eligible = creatureResults.filter((r) => r.hasBestiaryData);
  const roleCharmIds = unlockedCharmIds.filter((charmId) => EFFECT_KIND_TO_ROLE[getCharmDefinition(charmId).effectKind] === role);
  if (eligible.length === 0 || roleCharmIds.length === 0) return assignment;

  const rankedList = (r: CreatureOptimisationResult) => (category === 'major' ? r.rankedMajorCharms : r.rankedMinorCharms);
  const metricMatrix = eligible.map((result) =>
    roleCharmIds.map((charmId) => rankedList(result).find((r) => r.charmId === charmId && r.unlocked)?.roleMetric ?? 0),
  );

  const { assignedItem } = solveAssignment(metricMatrix, slotLimit);

  eligible.forEach((result, i) => {
    const itemIndex = assignedItem[i];
    if (itemIndex === null || itemIndex === undefined) return;
    const charmId = roleCharmIds[itemIndex]!;
    const recommendation = rankedList(result).find((r) => r.charmId === charmId && r.unlocked);
    if (recommendation && recommendation.roleMetric > 0) assignment.set(result.monsterName, recommendation);
  });

  return assignment;
}

/**
 * Runs `solveRoleCharmAssignment` once per role (per the approved design:
 * every individual solve must stay unit-pure, so a category's unlocked
 * charms - which can span multiple roles, e.g. Wound [damage] and Parry
 * [defensive] both being Major Charms - can never share one DP objective).
 * `damageSlotLimit` (the account's Major Charm slot cap) only ever applies
 * to the damage role's solve, since that's the solve whose result becomes
 * the default, displayed "Major Charm Slots" plan - every other role's
 * solved assignment is informational alternate-view data, not counted
 * against the cap.
 */
function solveAssignmentsByRole(
  creatureResults: CreatureOptimisationResult[],
  unlockedCharmIds: CharmId[],
  category: CharmCategory,
  damageSlotLimit: number | undefined,
): Partial<Record<CharmRole, Map<string, CharmRecommendation>>> {
  const byRole: Partial<Record<CharmRole, Map<string, CharmRecommendation>>> = {};
  for (const role of ASSIGNABLE_ROLES) {
    const slotLimit = role === 'damage' ? damageSlotLimit : undefined;
    byRole[role] = solveRoleCharmAssignment(creatureResults, unlockedCharmIds, category, role, slotLimit);
  }
  return byRole;
}

/**
 * Greedy budget allocator for ONE role's charms: repeatedly takes the single
 * best metric-per-cost upgrade that still fits the remaining budget, then
 * re-evaluates from that charm's new (virtual) tier - so a budget that's
 * best spent maxing out one excellent charm's full Bronze-to-Gold path gets
 * suggested as that full chain, not as ten independent "buy Tier 1 of
 * something else" options that structurally look more efficient in
 * isolation (Tier 1 is always the cheapest, biggest relative jump for an
 * unowned charm). This is what actually drove "why are you only suggesting
 * Tier 1" - cheap, fresh-unlock Tier 1s were crowding every further tier-up
 * out of a flat top-10 list.
 *
 * Not a provably optimal knapsack solver (see README "Future improvements")
 * - but it correctly respects the available budget and chains tiers, unlike
 * the flat ranking it replaces.
 *
 * Stops at `targetTier` rather than always walking to Gold - not every
 * Charm Point budget realistically reaches Gold on everything, so a lower
 * target means this never bothers suggesting the (often steeply expensive)
 * final step towards a tier the player isn't aiming for.
 */
function allocateRoleBudget(
  roleCharms: CharmDefinition[],
  category: CharmCategory,
  role: CharmRole,
  unlockedList: UnlockedCharm[],
  creatureContexts: CreatureContext[],
  budget: number,
  suggestionCap: number,
  targetTier: CharmTier,
): CharmPurchaseSuggestion[] {
  let remainingBudget = budget;
  const virtualTier = new Map<CharmId, number>(roleCharms.map((c) => [c.id, getUnlockedTier(unlockedList, c.id) ?? 0]));
  const suggestions: CharmPurchaseSuggestion[] = [];

  while (suggestions.length < suggestionCap) {
    let best: { charm: CharmDefinition; fromTier: number; toTier: CharmTier; cost: number; monsterName: string; metricGain: number; metricPerCost: number } | null = null;

    for (const charm of roleCharms) {
      const currentTier = virtualTier.get(charm.id)!;
      if (currentTier >= targetTier) continue;
      const toTier = (currentTier + 1) as CharmTier;
      const cost = getTierDefinition(charm, toTier).cost;
      if (cost > remainingBudget) continue;

      let bestForCharm: { monsterName: string; metricGain: number } | null = null;
      for (const { monsterName, ctx } of creatureContexts) {
        const currentResult = currentTier > 0 ? computeCharmEffect(charm, getTierDefinition(charm, currentTier as CharmTier), ctx) : null;
        const currentEffect = currentResult?.effect ?? emptyEffect();
        const nextResult = computeCharmEffect(charm, getTierDefinition(charm, toTier), ctx);
        const gain =
          roleMetricFor(nextResult.effect, role) * CONFIDENCE_SCORE_MULTIPLIER[nextResult.confidence] -
          roleMetricFor(currentEffect, role) * CONFIDENCE_SCORE_MULTIPLIER[currentResult?.confidence ?? 'high'];
        if (!bestForCharm || gain > bestForCharm.metricGain) bestForCharm = { monsterName, metricGain: gain };
      }
      if (!bestForCharm || bestForCharm.metricGain <= 0) continue;

      const metricPerCost = cost > 0 ? bestForCharm.metricGain / cost : bestForCharm.metricGain;
      if (!best || metricPerCost > best.metricPerCost) {
        best = { charm, fromTier: currentTier, toTier, cost, monsterName: bestForCharm.monsterName, metricGain: bestForCharm.metricGain, metricPerCost };
      }
    }

    if (!best) break;

    suggestions.push({
      charmId: best.charm.id,
      category,
      role,
      monsterName: best.monsterName,
      fromTier: best.fromTier,
      toTier: best.toTier,
      cost: best.cost,
      currency: best.charm.currency,
      metricGain: best.metricGain,
      metricPerCost: best.metricPerCost,
    });
    virtualTier.set(best.charm.id, best.toTier);
    remainingBudget -= best.cost;
  }

  return suggestions;
}

/**
 * Partitions `charmList` by role (so the allocator above only ever compares
 * same-unit candidates) and runs it once per role in `ROLE_PRIORITY` order.
 * The Charm Point/Echo budget is one real, shared pool, so roles can't each
 * independently assume they get the full amount - instead each role only
 * sees what's left after every higher-priority role already spent, the same
 * fixed-priority rule used everywhere else a cross-role decision is
 * otherwise unavoidable, applied here as a sequential claim on one budget
 * instead of a blended ranking.
 *
 * When no budget has been entered (still 0, the Advanced-settings default),
 * there is nothing to allocate against, so every role instead gets an
 * advisory top-10 list of its own most efficient next steps, unconstrained
 * by affordability - the same spirit as the previous behaviour, but still
 * capable of chaining.
 */
function buildPurchaseSuggestions(
  charmList: CharmDefinition[],
  category: CharmCategory,
  unlockedList: UnlockedCharm[],
  creatureContexts: CreatureContext[],
  availableBudget: number,
  targetTier: CharmTier,
): CharmPurchaseSuggestion[] {
  const hasBudget = availableBudget > 0;
  let remainingBudget = hasBudget ? availableBudget : Number.POSITIVE_INFINITY;
  const suggestions: CharmPurchaseSuggestion[] = [];

  for (const role of ASSIGNABLE_ROLES) {
    const roleCharms = charmList.filter((c) => EFFECT_KIND_TO_ROLE[c.effectKind] === role);
    if (roleCharms.length === 0) continue;

    const suggestionCap = hasBudget ? roleCharms.length * targetTier : 10;
    const roleSuggestions = allocateRoleBudget(roleCharms, category, role, unlockedList, creatureContexts, remainingBudget, suggestionCap, targetTier);
    suggestions.push(...roleSuggestions);
    if (hasBudget) remainingBudget -= roleSuggestions.reduce((sum, s) => sum + s.cost, 0);
  }

  return suggestions;
}

function emptySummary(character: CharacterInput, mode: OptimisationMode): HuntOptimisationSummary {
  return {
    mode,
    creatureResults: [],
    majorCharmSlotPlan: {
      recommendedSlots: [],
      unassignedCandidates: [],
      slotLimit: calculateMajorCharmSlotLimit(character.accountType, character.hasCharmExpansion),
    },
    rankedAlternatives: [],
    charmPointBudget: { available: character.availableCharmPoints, suggestions: [] },
    minorEchoBudget: { available: character.availableMinorCharmEchoes, suggestions: [] },
    reassignmentSuggestions: [],
    economics: {
      totalRemovalCost: 0,
      resetCost: calculateResetCost(character.level, character.hasUsedFreeReset),
      resetIsFree: !character.hasUsedFreeReset,
      cheaperOption: 'no_change',
    },
    expectedImprovementSummary: {
      extraDamagePerHour: 0,
      extraProfitPerHour: 0,
      extraDamagePreventedPerHour: 0,
      extraHealingSavedPerHour: 0,
    },
    creaturesLackingBestiaryData: [],
    creaturesNeedingManualReview: [],
  };
}

export function optimiseCharms(
  character: CharacterInput,
  parseResult: HuntAnalyserParseResult,
  mode: OptimisationMode = 'balanced',
  bestiaryEntries: RawBestiaryEntry[] = getBestiaryEntries(),
  targetTier: CharmTier = 3,
): HuntOptimisationSummary {
  const { killedMonsters, totals } = parseResult;
  if (killedMonsters.length === 0) return emptySummary(character, mode);

  // --- Join Bestiary data first (without a loot value yet - it depends on
  // hitpoints-weighted allocation below, computed from these same profiles).
  const profiles = killedMonsters.map((monster) => normaliseMonster(monster.monsterName, bestiaryEntries, null));

  const knownHitpoints = profiles.map((p) => p.hitpoints).filter((hp): hp is number => hp !== null);
  const fallbackHp = knownHitpoints.length > 0 ? knownHitpoints.reduce((s, hp) => s + hp, 0) / knownHitpoints.length : 1;

  // Damage/incoming-damage/loot are allocated by kill-share weighted toward
  // tougher creatures (kills * hitpoints), since a tankier species soaks up
  // proportionally more of both your outgoing damage and its own hits, and
  // plausibly drops more valuable loot. See README "Limitations" - this is
  // an estimation heuristic, not a reported figure.
  const weightFor = (monster: KilledMonsterStat, profile: MonsterProfile) => monster.killShare * (profile.hitpoints ?? fallbackHp);
  const allocationWeights = killedMonsters.map((m, i) => weightFor(m, profiles[i]!));
  const damagePerHourAllocated = allocateByWeight(totals.damagePerHour ?? 0, allocationWeights);
  // Healing/h is used as a proxy for damage taken per hour - the pasted Hunt
  // Analyser block has no "Damage Taken" figure, but a sustainable hunt's
  // healing received roughly tracks the damage it offsets.
  const incomingDamagePerHourAllocated = allocateByWeight(totals.healingPerHour ?? 0, allocationWeights);
  // allocateByWeight gives the TOTAL loot attributed to each species across
  // all of its kills - divide by kills to get a per-kill value, the unit
  // every loot-based formula (deriveXpAndProfitFromDamage, Gut, Scavenge) expects.
  const lootTotalAllocated = allocateByWeight(totals.loot ?? 0, allocationWeights);
  const lootPerKillAllocated = killedMonsters.map((m, i) => (m.kills > 0 ? (lootTotalAllocated[i] ?? 0) / m.kills : null));
  // Attack opportunities (used by elemental/Overpower/Overflux charms) are
  // split the same way: a tankier creature takes more hits to kill, so it
  // soaks up proportionally more of the session's total attacks even at an
  // identical kill share. ASSUMED_ATTACKS_PER_HOUR_WHILE_ACTIVE is the
  // session-wide total being redistributed, not a per-species figure.
  const attacksPerHourAllocated = allocateByWeight(ASSUMED_ATTACKS_PER_HOUR_WHILE_ACTIVE, allocationWeights);

  for (const [i, profile] of profiles.entries()) {
    const lootPerKill = lootPerKillAllocated[i] ?? null;
    if (profile.averageLootValue === null && lootPerKill !== null) {
      profile.averageLootValue = lootPerKill;
      profile.missingFields = profile.missingFields.filter((f) => f !== 'averageLootValue');
    }
  }

  const globalXpBoostMultiplier = totals.xpGain && totals.rawXpGain ? totals.xpGain / totals.rawXpGain : 1;

  const creatureContexts: CreatureContext[] = [];
  const creatureResults: CreatureOptimisationResult[] = [];
  const creaturesLackingBestiaryData: string[] = [];
  const creaturesNeedingManualReview: string[] = [];

  killedMonsters.forEach((huntStat, i) => {
    const profile = profiles[i]!;
    const hasBestiaryData = profile.matchedBestiaryName !== null;

    if (!hasBestiaryData) {
      creaturesLackingBestiaryData.push(huntStat.monsterName);
      creatureResults.push({
        monsterName: huntStat.monsterName,
        matchedProfile: profile,
        huntStat,
        hasBestiaryData: false,
        bestMajorCharm: null,
        bestMinorCharm: null,
        bestMajorCharmByRole: {},
        bestMinorCharmByRole: {},
        bestMajorCharmOverall: null,
        bestMinorCharmOverall: null,
        rankedMajorCharms: [],
        rankedMinorCharms: [],
        expectedDamagePerHour: 0,
        expectedProfitPerHour: 0,
        expectedDamagePreventedPerHour: 0,
        expectedHealingSavedPerHour: 0,
        needsManualReview: true,
        warnings: [{ code: 'no_bestiary_match' }],
      });
      return;
    }

    // Refine the parser's naive uniform per-kill estimates now that Bestiary
    // data is available - real per-kill XP is fixed in Tibia, so apply the
    // session's own boost multiplier instead of splitting xp_gain evenly.
    const refinedHuntStat: KilledMonsterStat = {
      ...huntStat,
      estimatedXpPerKill: profile.experience !== null ? profile.experience * globalXpBoostMultiplier : huntStat.estimatedXpPerKill,
      estimatedDamagePerKill: profile.hitpoints ?? huntStat.estimatedDamagePerKill,
      estimatedLootPerKill: profile.averageLootValue ?? huntStat.estimatedLootPerKill,
    };

    const manaDrainPerHour = profile.damageProfile?.inflictsManaDrain
      ? (incomingDamagePerHourAllocated[i] ?? 0) * ASSUMED_MANA_DRAIN_SHARE_OF_INCOMING
      : 0;

    const ctx: ScoringContext = {
      character,
      monster: profile,
      huntStat: refinedHuntStat,
      baseDamagePerHourAgainstMonster: damagePerHourAllocated[i] ?? 0,
      incomingDamagePerHourFromMonster: incomingDamagePerHourAllocated[i] ?? 0,
      manaDrainReceivedPerHour: manaDrainPerHour,
      incomingDamageIsEstimated: true,
      attacksPerHour: attacksPerHourAllocated[i] ?? 0,
    };

    const majorGroup = rankCharmGroup(MAJOR_CHARM_LIST, 'major', character.unlockedMajorCharms, ctx, targetTier);
    const minorGroup = rankCharmGroup(MINOR_CHARM_LIST, 'minor', character.unlockedMinorCharms, ctx, targetTier);

    creatureContexts.push({ monsterName: huntStat.monsterName, profile, ctx });

    const needsManualReview = profile.wasFuzzyMatched || profile.hitpoints === null || profile.resistances === null;
    if (needsManualReview) creaturesNeedingManualReview.push(huntStat.monsterName);

    const dataWarnings: LocalisedMessage[] = [];
    if (profile.wasFuzzyMatched) {
      dataWarnings.push({ code: 'fuzzy_match_note', params: { matchedName: profile.matchedBestiaryName ?? '' } });
    }
    if (profile.missingFields.length > 0) {
      dataWarnings.push({ code: 'missing_fields_note', params: { fields: profile.missingFields.join(', ') } });
    }

    // bestMajorCharm/bestMinorCharm/expectedXPerHour are placeholders here -
    // a single charm can only go to one creature at a time, so "best" can't
    // be decided per creature in isolation. Finalised below once the global
    // assignment across every creature has been solved.
    creatureResults.push({
      monsterName: huntStat.monsterName,
      matchedProfile: profile,
      huntStat: refinedHuntStat,
      hasBestiaryData: true,
      bestMajorCharm: null,
      bestMinorCharm: null,
      bestMajorCharmByRole: {},
      bestMinorCharmByRole: {},
      bestMajorCharmOverall: majorGroup.bestOverall,
      bestMinorCharmOverall: minorGroup.bestOverall,
      rankedMajorCharms: majorGroup.recommendations,
      rankedMinorCharms: minorGroup.recommendations,
      expectedDamagePerHour: 0,
      expectedProfitPerHour: 0,
      expectedDamagePreventedPerHour: 0,
      expectedHealingSavedPerHour: 0,
      needsManualReview,
      warnings: dataWarnings,
    });
  });

  // --- Solve the real one-charm-per-creature assignment for Major and Minor
  // charms, once per role (Major's damage-role solve is additionally capped
  // at the account's slot limit; every other solve - including every Minor
  // Charm role - has no overall cap beyond the one-per-creature rule).
  const slotLimit = calculateMajorCharmSlotLimit(character.accountType, character.hasCharmExpansion);
  const majorAssignmentsByRole = solveAssignmentsByRole(
    creatureResults,
    character.unlockedMajorCharms.map((u) => u.charmId),
    'major',
    slotLimit ?? undefined,
  );
  const minorAssignmentsByRole = solveAssignmentsByRole(
    creatureResults,
    character.unlockedMinorCharms.map((u) => u.charmId),
    'minor',
    undefined,
  );

  for (const result of creatureResults) {
    if (!result.hasBestiaryData) continue;

    const bestMajorCharmByRole: Partial<Record<CharmRole, CharmRecommendation>> = {};
    const bestMinorCharmByRole: Partial<Record<CharmRole, CharmRecommendation>> = {};
    for (const role of ASSIGNABLE_ROLES) {
      const major = majorAssignmentsByRole[role]?.get(result.monsterName);
      if (major) bestMajorCharmByRole[role] = major;
      const minor = minorAssignmentsByRole[role]?.get(result.monsterName);
      if (minor) bestMinorCharmByRole[role] = minor;
    }

    // The default pick walks ROLE_PRIORITY (damage-role solve's answer
    // first, then the other roles in the same fixed order) and takes the
    // first role that actually won this creature a slot - not just
    // damage/loot_utility, since a player can easily have nothing unlocked
    // in either of those (e.g. only Cripple, a control-role Charm) and
    // still deserves a default pick rather than none at all. Every role's
    // solved assignment also lives in `bestMajorCharmByRole`/
    // `bestMinorCharmByRole` as alternate-view data regardless of which one
    // wins here.
    const bestMajorCharm = ASSIGNABLE_ROLES.reduce<CharmRecommendation | null>((found, role) => found ?? bestMajorCharmByRole[role] ?? null, null);
    const bestMinorCharm = ASSIGNABLE_ROLES.reduce<CharmRecommendation | null>((found, role) => found ?? bestMinorCharmByRole[role] ?? null, null);
    const combinedEffect = addEffects(bestMajorCharm?.effect ?? emptyEffect(), bestMinorCharm?.effect ?? emptyEffect());

    result.bestMajorCharm = bestMajorCharm;
    result.bestMinorCharm = bestMinorCharm;
    result.bestMajorCharmByRole = bestMajorCharmByRole;
    result.bestMinorCharmByRole = bestMinorCharmByRole;
    result.expectedDamagePerHour = combinedEffect.expectedDamagePerHour;
    result.expectedProfitPerHour = combinedEffect.expectedProfitPerHour;
    result.expectedDamagePreventedPerHour = combinedEffect.expectedDamagePreventedPerHour;
    result.expectedHealingSavedPerHour = combinedEffect.expectedHealingGainPerHour;
    result.warnings = [...(bestMajorCharm?.warnings ?? []), ...(bestMinorCharm?.warnings ?? []), ...result.warnings];
  }

  // --- Major Charm slot plan: directly from the solved assignment - no
  // separate greedy fill needed, the solver already respects slotLimit.
  const recommendedSlots = creatureResults
    .filter((r) => r.bestMajorCharm !== null)
    .map((r) => ({ monsterName: r.monsterName, charmId: r.bestMajorCharm!.charmId }));
  const slotsAreFull = slotLimit !== null && recommendedSlots.length >= slotLimit;

  const unassignedCandidates = creatureResults
    .filter((r) => r.hasBestiaryData && r.bestMajorCharm === null)
    .map((r) => {
      // Best UNLOCKED major charm this creature could have used, ignoring the
      // assignment problem - tells us *why* it ended up with nothing: every
      // slot is full (a real cap), or every charm that could have helped it
      // went to a creature that valued it even more (contention).
      const bestIndependentUnlocked = r.rankedMajorCharms.find((rec) => rec.unlocked) ?? null;
      if (!bestIndependentUnlocked) return null;
      return {
        monsterName: r.monsterName,
        charmId: bestIndependentUnlocked.charmId,
        reason: slotsAreFull
          ? { code: 'slot_limit_reached', params: { slotCount: slotLimit } }
          : { code: 'charm_in_use_elsewhere' },
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  const majorCharmSlotPlan: MajorCharmSlotPlan = { recommendedSlots, unassignedCandidates, slotLimit };

  // --- Ranked alternatives across the whole hunt (top charms regardless of
  // creature) - same fixed role-priority-then-roleMetric order as within one
  // creature's rankedMajorCharms/rankedMinorCharms, just applied hunt-wide.
  const rankedAlternatives = creatureResults
    .flatMap((r) => [...r.rankedMajorCharms, ...r.rankedMinorCharms])
    .sort((a, b) => {
      const priorityDiff = ROLE_PRIORITY.indexOf(a.role) - ROLE_PRIORITY.indexOf(b.role);
      if (priorityDiff !== 0) return priorityDiff;
      return b.roleMetric - a.roleMetric || a.charmId.localeCompare(b.charmId) || a.monsterName.localeCompare(b.monsterName);
    })
    .slice(0, 15);

  // --- Purchase suggestions for unspent Charm Points / Minor Charm Echoes.
  const charmPointSuggestions = buildPurchaseSuggestions(
    MAJOR_CHARM_LIST,
    'major',
    character.unlockedMajorCharms,
    creatureContexts,
    character.availableCharmPoints,
    targetTier,
  );
  const minorEchoSuggestions = buildPurchaseSuggestions(
    MINOR_CHARM_LIST,
    'minor',
    character.unlockedMinorCharms,
    creatureContexts,
    character.availableMinorCharmEchoes,
    targetTier,
  );

  // --- Reassignment suggestions: where the current loadout differs from the
  // recommendation. The currently-assigned Charm was chosen freely by the
  // player, so it can easily be a different role than the recommendation
  // (e.g. Parry equipped, Wound recommended) - netMetricGain is only ever a
  // real number when both sides share a role (same unit); otherwise it's
  // null and the UI shows the swap by role rather than inventing a
  // cross-unit delta.
  const reassignmentSuggestions: CharmReassignmentSuggestion[] = [];
  for (const result of creatureResults) {
    if (!result.hasBestiaryData) continue;

    const recommendedMajor = result.bestMajorCharm;
    const currentMajorId = getAssignedCharmId(character.assignedMajorCharms, result.monsterName);
    if (recommendedMajor && recommendedMajor.charmId !== currentMajorId) {
      const currentEntry = result.rankedMajorCharms.find((r) => r.charmId === currentMajorId);
      reassignmentSuggestions.push({
        monsterName: result.monsterName,
        category: 'major',
        fromCharmId: currentMajorId,
        toCharmId: recommendedMajor.charmId,
        toRole: recommendedMajor.role,
        removalCost: currentMajorId ? calculateRemovalCost(character.level, character.hasCharmExpansion) : 0,
        netMetricGain: !currentMajorId
          ? recommendedMajor.roleMetric
          : currentEntry && currentEntry.role === recommendedMajor.role
            ? recommendedMajor.roleMetric - currentEntry.roleMetric
            : null,
      });
    }

    const recommendedMinor = result.bestMinorCharm;
    const currentMinorId = getAssignedCharmId(character.assignedMinorCharms, result.monsterName);
    if (recommendedMinor && recommendedMinor.charmId !== currentMinorId) {
      const currentEntry = result.rankedMinorCharms.find((r) => r.charmId === currentMinorId);
      reassignmentSuggestions.push({
        monsterName: result.monsterName,
        category: 'minor',
        fromCharmId: currentMinorId,
        toCharmId: recommendedMinor.charmId,
        toRole: recommendedMinor.role,
        removalCost: currentMinorId ? calculateRemovalCost(character.level, character.hasCharmExpansion) : 0,
        netMetricGain: !currentMinorId
          ? recommendedMinor.roleMetric
          : currentEntry && currentEntry.role === recommendedMinor.role
            ? recommendedMinor.roleMetric - currentEntry.roleMetric
            : null,
      });
    }
  }
  reassignmentSuggestions.sort((a, b) => (b.netMetricGain ?? Number.NEGATIVE_INFINITY) - (a.netMetricGain ?? Number.NEGATIVE_INFINITY));

  // --- Economics: removal cost of the suggested changes vs. a full reset.
  const totalRemovalCost = reassignmentSuggestions.reduce((sum, r) => sum + r.removalCost, 0);
  const resetCost = calculateResetCost(character.level, character.hasUsedFreeReset);
  const economics = {
    totalRemovalCost,
    resetCost,
    resetIsFree: !character.hasUsedFreeReset,
    cheaperOption: (reassignmentSuggestions.length === 0
      ? 'no_change'
      : resetCost < totalRemovalCost
        ? 'reset'
        : 'removals') as 'removals' | 'reset' | 'no_change',
  };

  // --- Expected improvement vs. the player's current loadout, respecting Major Charm slot limits.
  const improvement = { extraDamagePerHour: 0, extraProfitPerHour: 0, extraDamagePreventedPerHour: 0, extraHealingSavedPerHour: 0 };
  for (const result of creatureResults) {
    if (!result.hasBestiaryData) continue;
    const ctxEntry = creatureContexts.find((c) => c.monsterName === result.monsterName);
    if (!ctxEntry) continue;

    const currentMajorId = getAssignedCharmId(character.assignedMajorCharms, result.monsterName);
    const currentMinorId = getAssignedCharmId(character.assignedMinorCharms, result.monsterName);

    const currentMajorEffect = currentMajorId
      ? computeCharmEffect(
          getCharmDefinition(currentMajorId),
          getTierDefinition(getCharmDefinition(currentMajorId), getUnlockedTier(character.unlockedMajorCharms, currentMajorId) ?? 1),
          ctxEntry.ctx,
        ).effect
      : emptyEffect();
    const currentMinorEffect = currentMinorId
      ? computeCharmEffect(
          getCharmDefinition(currentMinorId),
          getTierDefinition(getCharmDefinition(currentMinorId), getUnlockedTier(character.unlockedMinorCharms, currentMinorId) ?? 1),
          ctxEntry.ctx,
        ).effect
      : emptyEffect();

    // bestMajorCharm is already null for any creature that didn't win a slot
    // in the global assignment, so falling back to its current effect here
    // correctly contributes a zero delta for it, with no separate slot check needed.
    const recommendedMajorEffect = result.bestMajorCharm?.effect ?? currentMajorEffect;
    const recommendedMinorEffect = result.bestMinorCharm?.effect ?? currentMinorEffect;

    const delta = addEffects(
      {
        ...emptyEffect(),
        expectedDamagePerHour: recommendedMajorEffect.expectedDamagePerHour - currentMajorEffect.expectedDamagePerHour,
        expectedProfitPerHour: recommendedMajorEffect.expectedProfitPerHour - currentMajorEffect.expectedProfitPerHour,
        expectedDamagePreventedPerHour:
          recommendedMajorEffect.expectedDamagePreventedPerHour - currentMajorEffect.expectedDamagePreventedPerHour,
        expectedHealingGainPerHour: recommendedMajorEffect.expectedHealingGainPerHour - currentMajorEffect.expectedHealingGainPerHour,
        expectedManaGainPerHour: recommendedMajorEffect.expectedManaGainPerHour - currentMajorEffect.expectedManaGainPerHour,
        expectedManaSavedPerHour: recommendedMajorEffect.expectedManaSavedPerHour - currentMajorEffect.expectedManaSavedPerHour,
      },
      {
        ...emptyEffect(),
        expectedDamagePerHour: recommendedMinorEffect.expectedDamagePerHour - currentMinorEffect.expectedDamagePerHour,
        expectedProfitPerHour: recommendedMinorEffect.expectedProfitPerHour - currentMinorEffect.expectedProfitPerHour,
        expectedDamagePreventedPerHour:
          recommendedMinorEffect.expectedDamagePreventedPerHour - currentMinorEffect.expectedDamagePreventedPerHour,
        expectedHealingGainPerHour: recommendedMinorEffect.expectedHealingGainPerHour - currentMinorEffect.expectedHealingGainPerHour,
        expectedManaGainPerHour: recommendedMinorEffect.expectedManaGainPerHour - currentMinorEffect.expectedManaGainPerHour,
        expectedManaSavedPerHour: recommendedMinorEffect.expectedManaSavedPerHour - currentMinorEffect.expectedManaSavedPerHour,
      },
    );

    improvement.extraDamagePerHour += delta.expectedDamagePerHour;
    improvement.extraProfitPerHour += delta.expectedProfitPerHour;
    improvement.extraDamagePreventedPerHour += delta.expectedDamagePreventedPerHour;
    improvement.extraHealingSavedPerHour += delta.expectedHealingGainPerHour + delta.expectedManaGainPerHour + delta.expectedManaSavedPerHour;
  }

  return {
    mode,
    creatureResults,
    majorCharmSlotPlan,
    rankedAlternatives,
    charmPointBudget: { available: character.availableCharmPoints, suggestions: charmPointSuggestions },
    minorEchoBudget: { available: character.availableMinorCharmEchoes, suggestions: minorEchoSuggestions },
    reassignmentSuggestions,
    economics,
    expectedImprovementSummary: improvement,
    creaturesLackingBestiaryData,
    creaturesNeedingManualReview,
  };
}

/** Convenience wrapper for tests/samples: parses raw text and optimises in one call. */
export function optimiseHuntFromText(
  character: CharacterInput,
  rawHuntAnalyserText: string,
  mode: OptimisationMode = 'balanced',
  bestiaryEntries?: RawBestiaryEntry[],
  targetTier: CharmTier = 3,
): HuntOptimisationSummary {
  const parseResult = parseHuntAnalyser(rawHuntAnalyserText);
  return optimiseCharms(character, parseResult, mode, bestiaryEntries, targetTier);
}
