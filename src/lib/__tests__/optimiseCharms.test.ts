import { describe, expect, it } from 'vitest';
import { SAMPLE_HUNT_ANALYSER_TEXT } from '@/data/sampleHuntAnalyser';
import { calculateRemovalCost } from '@/lib/economy';
import { optimiseCharms, optimiseHuntFromText } from '@/lib/optimiseCharms';
import { parseHuntAnalyser } from '@/lib/parseHuntAnalyser';
import { DEFAULT_CHARACTER_INPUT, type CharacterInput } from '@/types/character';
import type { RawBestiaryEntry } from '@/types/monster';

function baseCharacter(overrides: Partial<CharacterInput> = {}): CharacterInput {
  return { ...DEFAULT_CHARACTER_INPUT, ...overrides };
}

describe('optimiseCharms - end to end with the sample session', () => {
  it('produces a result for every killed creature, all matched against the Bestiary', () => {
    const summary = optimiseHuntFromText(baseCharacter(), SAMPLE_HUNT_ANALYSER_TEXT);
    expect(summary.creatureResults).toHaveLength(2);
    expect(summary.creatureResults.every((r) => r.hasBestiaryData)).toBe(true);
    expect(summary.creaturesLackingBestiaryData).toHaveLength(0);
  });

  it('ranks every Major/Minor Charm even when none are unlocked, but recommends none as "best"', () => {
    const summary = optimiseHuntFromText(baseCharacter({ unlockedMajorCharms: [], unlockedMinorCharms: [] }), SAMPLE_HUNT_ANALYSER_TEXT);
    const crusader = summary.creatureResults.find((r) => r.monsterName === 'crusader')!;
    expect(crusader.rankedMajorCharms).toHaveLength(14);
    expect(crusader.rankedMinorCharms).toHaveLength(11);
    expect(crusader.bestMajorCharm).toBeNull();
    expect(crusader.bestMinorCharm).toBeNull();
  });

  it('includes model-calculation inputs on recommendations, not only final scores', () => {
    const summary = optimiseHuntFromText(baseCharacter({ unlockedMajorCharms: [], unlockedMinorCharms: [] }), SAMPLE_HUNT_ANALYSER_TEXT);
    const crusader = summary.creatureResults.find((r) => r.monsterName === 'crusader')!;
    const carnage = crusader.rankedMajorCharms.find((r) => r.charmId === 'carnage')!;

    expect(carnage.calculation.effectKind).toBe('aoe_damage_on_kill');
    expect(carnage.calculation.hitpoints).toBe(3400);
    expect(carnage.calculation.kills).toBe(440);
    expect(carnage.calculation.uncappedBaseDamage).toBeCloseTo(510, 5);
    expect(carnage.calculation.levelCapDamage).toBe(1200);
    expect(carnage.calculation.baseDamage).toBeCloseTo(510, 5);
    expect(carnage.calculation.wasLevelCapped).toBe(false);
    expect(carnage.calculation.perProcDamage).toBeGreaterThan(0);
    expect(carnage.calculation.triggersPerHour).toBe(carnage.calculation.killsPerHour);
  });

  it('picks the only unlocked charm as "best" for whichever single creature it helps most, never both at once', () => {
    // A Charm can only be active on one creature at a time, so with only one
    // Major and one Minor Charm unlocked, exactly one of the two creatures in
    // the sample session gets each - not both, even though both would
    // independently rank it as their best option.
    const character = baseCharacter({
      unlockedMajorCharms: [{ charmId: 'wound', tier: 3 }],
      // Cripple (paralyse on attack) scores from kills/hour and incoming
      // damage, both always present in a parsed session - unlike Gut, which
      // needs Creature Product data the Bestiary doesn't have for either
      // sample creature, so it would score zero (and rightly go unassigned)
      // for both, defeating the point of this test.
      unlockedMinorCharms: [{ charmId: 'cripple', tier: 3 }],
      availableCharmPoints: 10_000,
      availableMinorCharmEchoes: 1_000,
    });
    const summary = optimiseCharms(character, parseHuntAnalyser(SAMPLE_HUNT_ANALYSER_TEXT));

    const majorRecipients = summary.creatureResults.filter((r) => r.bestMajorCharm?.charmId === 'wound');
    const minorRecipients = summary.creatureResults.filter((r) => r.bestMinorCharm?.charmId === 'cripple');
    expect(majorRecipients).toHaveLength(1);
    expect(minorRecipients).toHaveLength(1);

    expect(summary.charmPointBudget.suggestions.length).toBeGreaterThan(0);
    expect(summary.charmPointBudget.suggestions.every((s) => s.charmId !== 'wound' || s.toTier !== 3)).toBe(true);
  });

  it('respects the free account Major Charm slot limit across creatures', () => {
    // Three distinct unlocked charms, one per creature, so the slot limit
    // (not charm contention - each charm here is only good for one creature
    // anyway) is the constraint actually being exercised.
    const text = ['Killed Monsters:', '  10x Crusader', '  10x Headwalker', '  10x Dragon'].join('\n');
    const character = baseCharacter({
      accountType: 'free',
      hasCharmExpansion: false,
      unlockedMajorCharms: [
        { charmId: 'wound', tier: 3 },
        { charmId: 'poison', tier: 3 },
        { charmId: 'freeze', tier: 3 },
      ],
    });
    const summary = optimiseCharms(character, parseHuntAnalyser(text));

    expect(summary.majorCharmSlotPlan.slotLimit).toBe(2);
    expect(summary.majorCharmSlotPlan.recommendedSlots).toHaveLength(2);
    expect(summary.majorCharmSlotPlan.unassignedCandidates).toHaveLength(1);
    expect(summary.majorCharmSlotPlan.unassignedCandidates[0]?.reason.code).toBe('slot_limit_reached');
  });

  it('lifts the Major Charm slot limit entirely with the Charm Expansion', () => {
    const text = ['Killed Monsters:', '  10x Crusader', '  10x Headwalker', '  10x Dragon'].join('\n');
    const character = baseCharacter({
      accountType: 'free',
      hasCharmExpansion: true,
      unlockedMajorCharms: [
        { charmId: 'wound', tier: 3 },
        { charmId: 'poison', tier: 3 },
        { charmId: 'freeze', tier: 3 },
      ],
    });
    const summary = optimiseCharms(character, parseHuntAnalyser(text));

    expect(summary.majorCharmSlotPlan.slotLimit).toBeNull();
    expect(summary.majorCharmSlotPlan.recommendedSlots).toHaveLength(3);
    expect(summary.majorCharmSlotPlan.unassignedCandidates).toHaveLength(0);
  });

  it('never assigns the same Major Charm to two different creatures at once', () => {
    const character = baseCharacter({
      unlockedMajorCharms: [
        { charmId: 'wound', tier: 3 },
        { charmId: 'poison', tier: 3 },
        { charmId: 'freeze', tier: 3 },
      ],
    });
    const summary = optimiseCharms(character, parseHuntAnalyser(SAMPLE_HUNT_ANALYSER_TEXT));

    const assignedCharmIds = summary.creatureResults
      .map((r) => r.bestMajorCharm?.charmId)
      .filter((id): id is NonNullable<typeof id> => id != null);
    expect(new Set(assignedCharmIds).size).toBe(assignedCharmIds.length);
  });

  it('flags creatures with no matching Bestiary entry instead of guessing', () => {
    const text = ['Killed Monsters:', '  5x Crusader', '  3x Xyzonian Blob'].join('\n');
    const summary = optimiseCharms(baseCharacter(), parseHuntAnalyser(text));

    expect(summary.creaturesLackingBestiaryData).toContain('Xyzonian Blob');
    const blob = summary.creatureResults.find((r) => r.monsterName === 'Xyzonian Blob')!;
    expect(blob.hasBestiaryData).toBe(false);
    expect(blob.bestMajorCharm).toBeNull();
  });

  it('suggests reassigning away from a currently-assigned Charm that scores lower, with the correct removal cost', () => {
    // Overflux is unlocked but guaranteed to score exactly zero (no mana to
    // proc with), so Wound - also unlocked - must be strictly preferred.
    const character = baseCharacter({
      level: 150,
      hasCharmExpansion: false,
      maxMana: 0,
      unlockedMajorCharms: [
        { charmId: 'wound', tier: 3 },
        { charmId: 'overflux', tier: 1 },
      ],
      assignedMajorCharms: [{ charmId: 'overflux', creatureName: 'crusader' }],
    });
    const summary = optimiseCharms(character, parseHuntAnalyser(SAMPLE_HUNT_ANALYSER_TEXT));

    const crusader = summary.creatureResults.find((r) => r.monsterName === 'crusader')!;
    expect(crusader.bestMajorCharm?.charmId).toBe('wound');

    const suggestion = summary.reassignmentSuggestions.find((s) => s.monsterName === 'crusader' && s.category === 'major');
    expect(suggestion).toBeDefined();
    expect(suggestion?.fromCharmId).toBe('overflux');
    expect(suggestion?.toCharmId).toBe('wound');
    expect(suggestion?.removalCost).toBe(calculateRemovalCost(150, false));
    expect(summary.economics.totalRemovalCost).toBeGreaterThanOrEqual(suggestion!.removalCost);
  });

  it('returns an empty, well-formed summary when there is nothing to optimise', () => {
    const summary = optimiseCharms(baseCharacter(), parseHuntAnalyser(''));
    expect(summary.creatureResults).toHaveLength(0);
    expect(summary.majorCharmSlotPlan.recommendedSlots).toHaveLength(0);
    expect(summary.economics.cheaperOption).toBe('no_change');
  });

  it('chains multiple tiers of the same charm within budget instead of only ever suggesting Tier 1s', () => {
    // A generous Charm Point budget and nothing unlocked yet: the best use of
    // money is very likely to fully max out at least one charm (Bronze then
    // Silver then Gold), not just buy Bronze of many different charms - the
    // exact behaviour that used to be impossible (every suggestion was an
    // independent, unchained "next tier" lookup).
    const character = baseCharacter({ unlockedMajorCharms: [], availableCharmPoints: 6000 });
    const summary = optimiseCharms(character, parseHuntAnalyser(SAMPLE_HUNT_ANALYSER_TEXT));

    const totalSpend = summary.charmPointBudget.suggestions.reduce((sum, s) => sum + s.cost, 0);
    expect(totalSpend).toBeLessThanOrEqual(6000);

    const byCharm = new Map<string, number[]>();
    for (const s of summary.charmPointBudget.suggestions) {
      byCharm.set(s.charmId, [...(byCharm.get(s.charmId) ?? []), s.toTier]);
    }
    const chainedSomeCharm = [...byCharm.values()].some((tiers) => tiers.length >= 2);
    expect(chainedSomeCharm).toBe(true);
  });

  it('never suggests a tier-up that costs more than the remaining budget', () => {
    const character = baseCharacter({ unlockedMajorCharms: [], availableCharmPoints: 1000 });
    const summary = optimiseCharms(character, parseHuntAnalyser(SAMPLE_HUNT_ANALYSER_TEXT));

    let remaining = 1000;
    for (const s of summary.charmPointBudget.suggestions) {
      expect(s.cost).toBeLessThanOrEqual(remaining);
      remaining -= s.cost;
    }
  });

  it('still offers an advisory suggestion list when no budget has been entered (defaults to 0)', () => {
    const character = baseCharacter({ unlockedMajorCharms: [], availableCharmPoints: 0 });
    const summary = optimiseCharms(character, parseHuntAnalyser(SAMPLE_HUNT_ANALYSER_TEXT));
    expect(summary.charmPointBudget.suggestions.length).toBeGreaterThan(0);
  });

  it('attributes more attack opportunities (and so more elemental Charm damage) to a tankier creature at an equal kill share', () => {
    // Frail and Tanky are killed in equal numbers, so the old killShare-only
    // model would have given them identical attacksPerHour. Tanky has 9x the
    // hitpoints, so it should now receive 9x the attack-opportunity share AND
    // 9x the per-proc base damage - an 81x combined damage/hour ratio.
    const fixture: RawBestiaryEntry[] = [
      { name: 'Frail Critter', hitpoints: 1000, experience: 100, difficulty: 'Medium', resistances: [{ type: 'physical', value: 100 }] },
      { name: 'Tanky Critter', hitpoints: 9000, experience: 900, difficulty: 'Hard', resistances: [{ type: 'physical', value: 100 }] },
    ];
    const text = ['Killed Monsters:', '  100x Frail Critter', '  100x Tanky Critter'].join('\n');
    const character = baseCharacter({ level: 300, unlockedMajorCharms: [{ charmId: 'wound', tier: 1 }] });
    const summary = optimiseCharms(character, parseHuntAnalyser(text), 'balanced', fixture);

    const frail = summary.creatureResults.find((r) => r.monsterName === 'Frail Critter')!;
    const tanky = summary.creatureResults.find((r) => r.monsterName === 'Tanky Critter')!;
    // Independent per-creature score, not bestMajorCharm - this one Charm can
    // only end up actively assigned to one of the two creatures, but this
    // test is about how it *scores* for each of them in isolation.
    const frailDamage = frail.rankedMajorCharms.find((r) => r.charmId === 'wound')!.effect.expectedDamagePerHour;
    const tankyDamage = tanky.rankedMajorCharms.find((r) => r.charmId === 'wound')!.effect.expectedDamagePerHour;

    expect(tankyDamage / frailDamage).toBeCloseTo(81, 1);
  });

  it('evaluates locked charms at the configured target tier, not always Gold', () => {
    const character = baseCharacter({ unlockedMajorCharms: [] });
    const summaryGold = optimiseCharms(character, parseHuntAnalyser(SAMPLE_HUNT_ANALYSER_TEXT), 'balanced', undefined, 3);
    const summaryBronze = optimiseCharms(character, parseHuntAnalyser(SAMPLE_HUNT_ANALYSER_TEXT), 'balanced', undefined, 1);

    const crusaderGold = summaryGold.creatureResults.find((r) => r.monsterName === 'crusader')!;
    const crusaderBronze = summaryBronze.creatureResults.find((r) => r.monsterName === 'crusader')!;
    const wound = (s: typeof crusaderGold) => s.rankedMajorCharms.find((r) => r.charmId === 'wound')!;

    expect(wound(crusaderGold).tier).toBe(3);
    expect(wound(crusaderBronze).tier).toBe(1);
    // Compare raw damage/hour, not the normalised 0-100 score - the two runs
    // rank against different maxima (every locked charm is evaluated at a
    // different tier in each run), so their *normalised* scores aren't
    // directly comparable, but the underlying activation-chance difference
    // (11% at Gold vs 5% at Bronze) must still show up in the raw EV.
    expect(wound(crusaderGold).effect.expectedDamagePerHour).toBeGreaterThan(wound(crusaderBronze).effect.expectedDamagePerHour);
  });

  it('never suggests a purchase past the configured target tier', () => {
    const character = baseCharacter({ unlockedMajorCharms: [], availableCharmPoints: 10_000 });
    const summary = optimiseCharms(character, parseHuntAnalyser(SAMPLE_HUNT_ANALYSER_TEXT), 'balanced', undefined, 2);

    expect(summary.charmPointBudget.suggestions.length).toBeGreaterThan(0);
    expect(summary.charmPointBudget.suggestions.every((s) => s.toTier <= 2)).toBe(true);
  });
});
