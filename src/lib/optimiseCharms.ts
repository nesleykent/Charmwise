// Orchestrates the whole pipeline: parsed Hunt Analyser data + character
// input + bestiary profiles -> ranked Charm recommendations for each
// creature and for the hunt as a whole.
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

function buildReason(rankIndex: number, unlocked: boolean, dominant: string): LocalisedMessage {
  if (rankIndex === 0 && unlocked) return { code: 'reason_top_unlocked', params: { dominant } };
  if (rankIndex === 0 && !unlocked) return { code: 'reason_top_locked', params: { dominant } };
  if (unlocked) return { code: 'reason_ranked_unlocked', params: { rank: rankIndex + 1, dominant } };
  return { code: 'reason_ranked_locked', params: { rank: rankIndex + 1, dominant } };
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
  best: CharmRecommendation | null;
  maxima: ScoreMaxima;
}

/** Ranks every charm in `charmList` for one creature: unlocked charms use the tier the player owns, locked charms are evaluated at Tier 1 (the cheapest entry point) purely so they can be compared and surfaced as purchase candidates. */
function rankCharmGroup(
  charmList: CharmDefinition[],
  category: CharmCategory,
  unlockedList: UnlockedCharm[],
  ctx: ScoringContext,
  weights: ScoreWeights,
): RankedGroup {
  const evaluations = charmList.map((charm) => {
    const ownedTier = getUnlockedTier(unlockedList, charm.id);
    const unlocked = ownedTier !== null;
    const tier = ownedTier ?? 1;
    const { effect, warnings, confidence } = computeCharmEffect(charm, getTierDefinition(charm, tier), ctx);
    return { charm, tier, unlocked, effect, warnings, confidence };
  });

  const maxima = computeMaxima(evaluations.map((e) => e.effect));
  const scored = evaluations.map((e) => ({ ...e, scores: scoreEffect(e.effect, maxima, weights) }));

  // Deterministic ranking: total score desc, ties broken by charm id so output never reorders between runs.
  scored.sort((a, b) => b.scores.totalScore - a.scores.totalScore || a.charm.id.localeCompare(b.charm.id));

  const recommendations: CharmRecommendation[] = scored.map((entry, index) => {
    const dominant = dominantScoreLabel(entry.scores, weights);
    return {
      charmId: entry.charm.id,
      category,
      name: entry.charm.name,
      tier: entry.tier,
      unlocked: entry.unlocked,
      effect: entry.effect,
      scores: entry.scores,
      scorePerCharmPoint:
        entry.charm.currency === 'charm_points' ? entry.scores.totalScore / getTierDefinition(entry.charm, entry.tier).cost : null,
      scorePerMinorCharmEcho:
        entry.charm.currency === 'minor_charm_echoes'
          ? entry.scores.totalScore / getTierDefinition(entry.charm, entry.tier).cost
          : null,
      confidence: entry.confidence,
      reason: buildReason(index, entry.unlocked, dominant),
      warnings: entry.warnings,
    };
  });

  const best = recommendations.find((r) => r.unlocked) ?? null;
  return { recommendations, best, maxima };
}

interface CreatureContext {
  monsterName: string;
  profile: MonsterProfile;
  ctx: ScoringContext;
  majorMaxima: ScoreMaxima;
  minorMaxima: ScoreMaxima;
}

function buildPurchaseSuggestions(
  charmList: CharmDefinition[],
  category: CharmCategory,
  unlockedList: UnlockedCharm[],
  creatureContexts: CreatureContext[],
  weights: ScoreWeights,
): CharmPurchaseSuggestion[] {
  const suggestions: CharmPurchaseSuggestion[] = [];

  for (const charm of charmList) {
    const currentTier = getUnlockedTier(unlockedList, charm.id) ?? 0;
    if (currentTier >= 3) continue;
    const nextTier = (currentTier + 1) as CharmTier;
    const cost = costToReachTier(charm, currentTier, nextTier);

    let best: { monsterName: string; scoreGain: number } | null = null;
    for (const { monsterName, ctx, majorMaxima, minorMaxima } of creatureContexts) {
      const maxima = category === 'major' ? majorMaxima : minorMaxima;
      const currentEffect =
        currentTier > 0 ? computeCharmEffect(charm, getTierDefinition(charm, currentTier as CharmTier), ctx).effect : emptyEffect();
      const nextEffect = computeCharmEffect(charm, getTierDefinition(charm, nextTier), ctx).effect;
      const gain = scoreEffect(nextEffect, maxima, weights).totalScore - scoreEffect(currentEffect, maxima, weights).totalScore;
      if (!best || gain > best.scoreGain) best = { monsterName, scoreGain: gain };
    }

    if (best && best.scoreGain > 0) {
      suggestions.push({
        charmId: charm.id,
        category,
        monsterName: best.monsterName,
        fromTier: currentTier,
        toTier: nextTier,
        cost,
        currency: charm.currency,
        scoreGain: best.scoreGain,
        scorePerCost: cost > 0 ? best.scoreGain / cost : best.scoreGain,
      });
    }
  }

  suggestions.sort((a, b) => b.scorePerCost - a.scorePerCost);
  return suggestions.slice(0, 10);
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

    const majorGroup = rankCharmGroup(MAJOR_CHARM_LIST, 'major', character.unlockedMajorCharms, ctx, weights);
    const minorGroup = rankCharmGroup(MINOR_CHARM_LIST, 'minor', character.unlockedMinorCharms, ctx, weights);

    creatureContexts.push({ monsterName: huntStat.monsterName, profile, ctx, majorMaxima: majorGroup.maxima, minorMaxima: minorGroup.maxima });

    const needsManualReview = profile.wasFuzzyMatched || profile.hitpoints === null || profile.resistances === null;
    if (needsManualReview) creaturesNeedingManualReview.push(huntStat.monsterName);

    const combinedEffect = addEffects(majorGroup.best?.effect ?? emptyEffect(), minorGroup.best?.effect ?? emptyEffect());
    const warnings: LocalisedMessage[] = [...(majorGroup.best?.warnings ?? []), ...(minorGroup.best?.warnings ?? [])];
    if (profile.wasFuzzyMatched) {
      warnings.push({ code: 'fuzzy_match_note', params: { matchedName: profile.matchedBestiaryName ?? '' } });
    }
    if (profile.missingFields.length > 0) {
      warnings.push({ code: 'missing_fields_note', params: { fields: profile.missingFields.join(', ') } });
    }

    creatureResults.push({
      monsterName: huntStat.monsterName,
      matchedProfile: profile,
      huntStat: refinedHuntStat,
      hasBestiaryData: true,
      bestMajorCharm: majorGroup.best,
      bestMinorCharm: minorGroup.best,
      rankedMajorCharms: majorGroup.recommendations,
      rankedMinorCharms: minorGroup.recommendations,
      expectedDamagePerHour: combinedEffect.expectedDamagePerHour,
      expectedProfitPerHour: combinedEffect.expectedProfitPerHour,
      expectedDamagePreventedPerHour: combinedEffect.expectedDamagePreventedPerHour,
      expectedHealingSavedPerHour: combinedEffect.expectedHealingGainPerHour,
      needsManualReview,
      warnings,
    });
  });

  // --- Major Charm slot plan (account-limited; Minor Charms are not limited
  // by account type beyond the usual one-per-creature rule).
  const slotLimit = calculateMajorCharmSlotLimit(character.accountType, character.hasCharmExpansion);
  const eligibleForMajorSlot = creatureResults
    .filter((r) => r.bestMajorCharm !== null)
    .sort(
      (a, b) =>
        b.bestMajorCharm!.scores.totalScore - a.bestMajorCharm!.scores.totalScore || a.monsterName.localeCompare(b.monsterName),
    );
  const slotCount = slotLimit ?? eligibleForMajorSlot.length;
  const majorCharmSlotPlan: MajorCharmSlotPlan = {
    recommendedSlots: eligibleForMajorSlot
      .slice(0, slotCount)
      .map((r) => ({ monsterName: r.monsterName, charmId: r.bestMajorCharm!.charmId })),
    unassignedCandidates: eligibleForMajorSlot.slice(slotCount).map((r) => ({
      monsterName: r.monsterName,
      charmId: r.bestMajorCharm!.charmId,
      reason: { code: 'slot_limit_reached', params: { slotCount } },
    })),
    slotLimit,
  };
  const majorSlotMonsterSet = new Set(majorCharmSlotPlan.recommendedSlots.map((s) => s.monsterName));

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
  );
  const minorEchoSuggestions = buildPurchaseSuggestions(
    MINOR_CHARM_LIST,
    'minor',
    character.unlockedMinorCharms,
    creatureContexts,
    weights,
  );

  // --- Reassignment suggestions: where the current loadout differs from the recommendation.
  const reassignmentSuggestions: CharmReassignmentSuggestion[] = [];
  for (const result of creatureResults) {
    if (!result.hasBestiaryData) continue;

    const recommendedMajor = majorSlotMonsterSet.has(result.monsterName) ? result.bestMajorCharm : null;
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

    // Major charm gains only count for creatures that actually have a slot under the account's limit.
    const recommendedMajorEffect = majorSlotMonsterSet.has(result.monsterName) ? result.bestMajorCharm?.effect ?? emptyEffect() : currentMajorEffect;
    const recommendedMinorEffect = result.bestMinorCharm?.effect ?? emptyEffect();

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
): HuntOptimisationSummary {
  const parseResult = parseHuntAnalyser(rawHuntAnalyserText);
  return optimiseCharms(character, parseResult, mode, bestiaryEntries);
}
