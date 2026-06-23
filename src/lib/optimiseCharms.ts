// Orchestrates the whole pipeline: parsed Hunt Analyser data + character
// input + bestiary profiles -> ranked Charm recommendations for each
// creature and for the hunt as a whole.
import { solveAssignment } from '@/lib/assignmentSolver';
import { MAJOR_CHARM_LIST, MINOR_CHARM_LIST, getCharmDefinition } from '@/data/charms';
import {
  ASSUMED_ATTACKS_PER_HOUR_WHILE_ACTIVE,
  ASSUMED_MANA_DRAIN_SHARE_OF_INCOMING,
  computeCharmEffect,
  computeMaxima,
  emptyEffect,
  scoreEffect,
  MODE_WEIGHTS,
  type ScoreMaxima,
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
  CharmRecommendation,
  CharmTier,
  CharmTierDefinition,
  LocalisedMessage,
  OptimisationMode,
  ScoreWeights,
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

/** Returns the score-dimension key (e.g. "damage"), not display text - the UI localises it via Dictionary.scoreDimensions. */
function dominantScoreLabel(
  scores: { damageScore: number; xpScore: number; profitScore: number; safetyScore: number; supplySavingScore: number; utilityScore: number },
  weights: ScoreWeights,
): string {
  const contributions: [string, number][] = [
    ['damage', scores.damageScore * weights.damage],
    ['xp', scores.xpScore * weights.xp],
    ['profit', scores.profitScore * weights.profit],
    ['safety', scores.safetyScore * weights.safety],
    ['supplySaving', scores.supplySavingScore * weights.supplySaving],
    ['utility', scores.utilityScore * weights.utility],
  ];
  contributions.sort((a, b) => b[1] - a[1]);
  return contributions[0]![0];
}

function buildReason(rankIndex: number, unlocked: boolean, dominant: string, lockedAtTier: CharmTier): LocalisedMessage {
  if (rankIndex === 0 && unlocked) return { code: 'reason_top_unlocked', params: { dominant } };
  if (rankIndex === 0 && !unlocked) return { code: 'reason_top_locked', params: { dominant, tier: lockedAtTier } };
  if (unlocked) return { code: 'reason_ranked_unlocked', params: { rank: rankIndex + 1, dominant } };
  return { code: 'reason_ranked_locked', params: { rank: rankIndex + 1, dominant, tier: lockedAtTier } };
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
  maxima: ScoreMaxima;
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
  weights: ScoreWeights,
  targetTier: CharmTier,
): RankedGroup {
  const evaluations = charmList.map((charm) => {
    const ownedTier = getUnlockedTier(unlockedList, charm.id);
    const unlocked = ownedTier !== null;
    const tier: CharmTier = ownedTier ?? targetTier;
    const { effect, warnings, confidence } = computeCharmEffect(charm, getTierDefinition(charm, tier), ctx);
    return { charm, tier, unlocked, effect, warnings, confidence };
  });

  const maxima = computeMaxima(evaluations.map((e) => e.effect));
  const scored = evaluations.map((e) => ({ ...e, scores: scoreEffect(e.effect, maxima, weights) }));

  // Deterministic ranking: total score desc, ties broken by charm id so output never reorders between runs.
  scored.sort((a, b) => b.scores.totalScore - a.scores.totalScore || a.charm.id.localeCompare(b.charm.id));

  const recommendations: CharmRecommendation[] = scored.map((entry, index) => {
    const dominant = dominantScoreLabel(entry.scores, weights);
    // Cumulative cost from scratch to the evaluated tier, not just that
    // tier's incremental price - Gold can't be bought without Bronze and
    // Silver first, so "score per point" must reflect the full spend.
    const totalCostToTier = costToReachTier(entry.charm, 0, entry.tier);
    return {
      charmId: entry.charm.id,
      category,
      name: entry.charm.name,
      monsterName: ctx.huntStat.monsterName,
      tier: entry.tier,
      unlocked: entry.unlocked,
      effect: entry.effect,
      scores: entry.scores,
      scorePerCharmPoint: entry.charm.currency === 'charm_points' ? entry.scores.totalScore / totalCostToTier : null,
      scorePerMinorCharmEcho: entry.charm.currency === 'minor_charm_echoes' ? entry.scores.totalScore / totalCostToTier : null,
      confidence: entry.confidence,
      reason: buildReason(index, entry.unlocked, dominant, entry.tier),
      warnings: entry.warnings,
    };
  });

  const best = recommendations.find((r) => r.unlocked) ?? null;
  const bestOverall = recommendations[0] ?? null;
  return { recommendations, best, bestOverall, maxima };
}

interface CreatureContext {
  monsterName: string;
  profile: MonsterProfile;
  ctx: ScoringContext;
  majorMaxima: ScoreMaxima;
  minorMaxima: ScoreMaxima;
}

/**
 * A specific unlocked Charm can only be actively assigned to one creature at
 * a time (confirmed - see README); ranking charms independently per creature,
 * as `rankedMajorCharms`/`rankedMinorCharms` still does for exploration, can
 * recommend the same charm for two different creatures at once, which the
 * player cannot actually act on. This solves the real one-charm-per-creature,
 * one-creature-per-charm assignment globally across the whole hunt -
 * optionally capped at `slotLimit` total assignments - and returns the
 * winning `CharmRecommendation` per creature, keyed by monster name.
 */
function solveGlobalCharmAssignment(
  creatureResults: CreatureOptimisationResult[],
  unlockedCharmIds: CharmId[],
  category: CharmCategory,
  slotLimit: number | undefined,
): Map<string, CharmRecommendation> {
  const assignment = new Map<string, CharmRecommendation>();
  const eligible = creatureResults.filter((r) => r.hasBestiaryData);
  if (eligible.length === 0 || unlockedCharmIds.length === 0) return assignment;

  const rankedList = (r: CreatureOptimisationResult) => (category === 'major' ? r.rankedMajorCharms : r.rankedMinorCharms);
  const scoreMatrix = eligible.map((result) =>
    unlockedCharmIds.map((charmId) => rankedList(result).find((r) => r.charmId === charmId && r.unlocked)?.scores.totalScore ?? 0),
  );

  const { assignedItem } = solveAssignment(scoreMatrix, slotLimit);

  eligible.forEach((result, i) => {
    const itemIndex = assignedItem[i];
    if (itemIndex === null || itemIndex === undefined) return;
    const charmId = unlockedCharmIds[itemIndex]!;
    const recommendation = rankedList(result).find((r) => r.charmId === charmId && r.unlocked);
    if (recommendation && recommendation.scores.totalScore > 0) assignment.set(result.monsterName, recommendation);
  });

  return assignment;
}

/**
 * Greedy budget allocator: repeatedly takes the single best score-per-cost
 * upgrade that still fits the remaining budget, then re-evaluates from that
 * charm's new (virtual) tier - so a budget that's best spent maxing out one
 * excellent charm's full Bronze-to-Gold path gets suggested as that full
 * chain, not as ten independent "buy Tier 1 of something else" options that
 * structurally look more efficient in isolation (Tier 1 is always the
 * cheapest, biggest relative jump for an unowned charm). This is what
 * actually drove "why are you only suggesting Tier 1" - cheap, fresh-unlock
 * Tier 1s were crowding every further tier-up out of a flat top-10 list.
 *
 * Not a provably optimal knapsack solver (see README "Future improvements")
 * - but it correctly respects the available budget and chains tiers, unlike
 * the flat ranking it replaces.
 *
 * When no budget has been entered (still 0, the Advanced-settings default),
 * there is nothing to allocate against, so this falls back to an advisory
 * top-10 list of the most efficient next steps, unconstrained by affordability -
 * the same spirit as the previous behaviour, but still capable of chaining.
 *
 * Stops at `targetTier` rather than always walking to Gold - not every
 * Charm Point budget realistically reaches Gold on everything, so a lower
 * target means this never bothers suggesting the (often steeply expensive)
 * final step towards a tier the player isn't aiming for.
 */
function buildPurchaseSuggestions(
  charmList: CharmDefinition[],
  category: CharmCategory,
  unlockedList: UnlockedCharm[],
  creatureContexts: CreatureContext[],
  weights: ScoreWeights,
  availableBudget: number,
  targetTier: CharmTier,
): CharmPurchaseSuggestion[] {
  const hasBudget = availableBudget > 0;
  let remainingBudget = hasBudget ? availableBudget : Number.POSITIVE_INFINITY;
  const suggestionCap = hasBudget ? charmList.length * targetTier : 10;

  const virtualTier = new Map<CharmId, number>(charmList.map((c) => [c.id, getUnlockedTier(unlockedList, c.id) ?? 0]));
  const suggestions: CharmPurchaseSuggestion[] = [];

  while (suggestions.length < suggestionCap) {
    let best: { charm: CharmDefinition; fromTier: number; toTier: CharmTier; cost: number; monsterName: string; scoreGain: number; scorePerCost: number } | null = null;

    for (const charm of charmList) {
      const currentTier = virtualTier.get(charm.id)!;
      if (currentTier >= targetTier) continue;
      const toTier = (currentTier + 1) as CharmTier;
      const cost = getTierDefinition(charm, toTier).cost;
      if (cost > remainingBudget) continue;

      let bestForCharm: { monsterName: string; scoreGain: number } | null = null;
      for (const { monsterName, ctx, majorMaxima, minorMaxima } of creatureContexts) {
        const maxima = category === 'major' ? majorMaxima : minorMaxima;
        const currentEffect =
          currentTier > 0 ? computeCharmEffect(charm, getTierDefinition(charm, currentTier as CharmTier), ctx).effect : emptyEffect();
        const nextEffect = computeCharmEffect(charm, getTierDefinition(charm, toTier), ctx).effect;
        const gain = scoreEffect(nextEffect, maxima, weights).totalScore - scoreEffect(currentEffect, maxima, weights).totalScore;
        if (!bestForCharm || gain > bestForCharm.scoreGain) bestForCharm = { monsterName, scoreGain: gain };
      }
      if (!bestForCharm || bestForCharm.scoreGain <= 0) continue;

      const scorePerCost = cost > 0 ? bestForCharm.scoreGain / cost : bestForCharm.scoreGain;
      if (!best || scorePerCost > best.scorePerCost) {
        best = { charm, fromTier: currentTier, toTier, cost, monsterName: bestForCharm.monsterName, scoreGain: bestForCharm.scoreGain, scorePerCost };
      }
    }

    if (!best) break;

    suggestions.push({
      charmId: best.charm.id,
      category,
      monsterName: best.monsterName,
      fromTier: best.fromTier,
      toTier: best.toTier,
      cost: best.cost,
      currency: best.charm.currency,
      scoreGain: best.scoreGain,
      scorePerCost: best.scorePerCost,
    });
    virtualTier.set(best.charm.id, best.toTier);
    remainingBudget -= best.cost;
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

  const weights = MODE_WEIGHTS[mode];

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

    const majorGroup = rankCharmGroup(MAJOR_CHARM_LIST, 'major', character.unlockedMajorCharms, ctx, weights, targetTier);
    const minorGroup = rankCharmGroup(MINOR_CHARM_LIST, 'minor', character.unlockedMinorCharms, ctx, weights, targetTier);

    creatureContexts.push({ monsterName: huntStat.monsterName, profile, ctx, majorMaxima: majorGroup.maxima, minorMaxima: minorGroup.maxima });

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
  // charms separately (Major is additionally capped at the account's slot
  // limit; Minor Charms have no overall cap beyond the one-per-creature rule).
  const slotLimit = calculateMajorCharmSlotLimit(character.accountType, character.hasCharmExpansion);
  const majorAssignment = solveGlobalCharmAssignment(
    creatureResults,
    character.unlockedMajorCharms.map((u) => u.charmId),
    'major',
    slotLimit ?? undefined,
  );
  const minorAssignment = solveGlobalCharmAssignment(
    creatureResults,
    character.unlockedMinorCharms.map((u) => u.charmId),
    'minor',
    undefined,
  );

  for (const result of creatureResults) {
    if (!result.hasBestiaryData) continue;
    const bestMajorCharm = majorAssignment.get(result.monsterName) ?? null;
    const bestMinorCharm = minorAssignment.get(result.monsterName) ?? null;
    const combinedEffect = addEffects(bestMajorCharm?.effect ?? emptyEffect(), bestMinorCharm?.effect ?? emptyEffect());

    result.bestMajorCharm = bestMajorCharm;
    result.bestMinorCharm = bestMinorCharm;
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

  // --- Ranked alternatives across the whole hunt (top charms regardless of creature).
  const rankedAlternatives = creatureResults
    .flatMap((r) => [...r.rankedMajorCharms, ...r.rankedMinorCharms])
    .sort((a, b) => b.scores.totalScore - a.scores.totalScore)
    .slice(0, 15);

  // --- Purchase suggestions for unspent Charm Points / Minor Charm Echoes.
  const charmPointSuggestions = buildPurchaseSuggestions(
    MAJOR_CHARM_LIST,
    'major',
    character.unlockedMajorCharms,
    creatureContexts,
    weights,
    character.availableCharmPoints,
    targetTier,
  );
  const minorEchoSuggestions = buildPurchaseSuggestions(
    MINOR_CHARM_LIST,
    'minor',
    character.unlockedMinorCharms,
    creatureContexts,
    weights,
    character.availableMinorCharmEchoes,
    targetTier,
  );

  // --- Reassignment suggestions: where the current loadout differs from the recommendation.
  const reassignmentSuggestions: CharmReassignmentSuggestion[] = [];
  for (const result of creatureResults) {
    if (!result.hasBestiaryData) continue;

    const recommendedMajor = result.bestMajorCharm;
    const currentMajorId = getAssignedCharmId(character.assignedMajorCharms, result.monsterName);
    if (recommendedMajor && recommendedMajor.charmId !== currentMajorId) {
      const currentScore = result.rankedMajorCharms.find((r) => r.charmId === currentMajorId)?.scores.totalScore ?? 0;
      reassignmentSuggestions.push({
        monsterName: result.monsterName,
        category: 'major',
        fromCharmId: currentMajorId,
        toCharmId: recommendedMajor.charmId,
        removalCost: currentMajorId ? calculateRemovalCost(character.level, character.hasCharmExpansion) : 0,
        netScoreGain: recommendedMajor.scores.totalScore - currentScore,
      });
    }

    const recommendedMinor = result.bestMinorCharm;
    const currentMinorId = getAssignedCharmId(character.assignedMinorCharms, result.monsterName);
    if (recommendedMinor && recommendedMinor.charmId !== currentMinorId) {
      const currentScore = result.rankedMinorCharms.find((r) => r.charmId === currentMinorId)?.scores.totalScore ?? 0;
      reassignmentSuggestions.push({
        monsterName: result.monsterName,
        category: 'minor',
        fromCharmId: currentMinorId,
        toCharmId: recommendedMinor.charmId,
        removalCost: currentMinorId ? calculateRemovalCost(character.level, character.hasCharmExpansion) : 0,
        netScoreGain: recommendedMinor.scores.totalScore - currentScore,
      });
    }
  }
  reassignmentSuggestions.sort((a, b) => b.netScoreGain - a.netScoreGain);

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
