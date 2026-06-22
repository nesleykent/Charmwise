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

  it('picks the only unlocked charm as "best" regardless of its rank, and proposes purchases for the rest', () => {
    const character = baseCharacter({
      unlockedMajorCharms: [{ charmId: 'wound', tier: 3 }],
      unlockedMinorCharms: [{ charmId: 'gut', tier: 3 }],
      availableCharmPoints: 10_000,
      availableMinorCharmEchoes: 1_000,
    });
    const summary = optimiseCharms(character, parseHuntAnalyser(SAMPLE_HUNT_ANALYSER_TEXT));
    for (const result of summary.creatureResults) {
      expect(result.bestMajorCharm?.charmId).toBe('wound');
      expect(result.bestMinorCharm?.charmId).toBe('gut');
    }
    expect(summary.charmPointBudget.suggestions.length).toBeGreaterThan(0);
    expect(summary.charmPointBudget.suggestions.every((s) => s.charmId !== 'wound' || s.toTier !== 3)).toBe(true);
  });

  it('respects the free account Major Charm slot limit across creatures', () => {
    const text = ['Killed Monsters:', '  10x Crusader', '  10x Headwalker', '  10x Dragon'].join('\n');
    const character = baseCharacter({ accountType: 'free', hasCharmExpansion: false, unlockedMajorCharms: [{ charmId: 'wound', tier: 3 }] });
    const summary = optimiseCharms(character, parseHuntAnalyser(text));

    expect(summary.majorCharmSlotPlan.slotLimit).toBe(2);
    expect(summary.majorCharmSlotPlan.recommendedSlots).toHaveLength(2);
    expect(summary.majorCharmSlotPlan.unassignedCandidates).toHaveLength(1);
    expect(summary.majorCharmSlotPlan.unassignedCandidates[0]?.reason.code).toBe('slot_limit_reached');
  });

  it('lifts the Major Charm slot limit entirely with the Charm Expansion', () => {
    const text = ['Killed Monsters:', '  10x Crusader', '  10x Headwalker', '  10x Dragon'].join('\n');
    const character = baseCharacter({ accountType: 'free', hasCharmExpansion: true, unlockedMajorCharms: [{ charmId: 'wound', tier: 3 }] });
    const summary = optimiseCharms(character, parseHuntAnalyser(text));

    expect(summary.majorCharmSlotPlan.slotLimit).toBeNull();
    expect(summary.majorCharmSlotPlan.recommendedSlots).toHaveLength(3);
    expect(summary.majorCharmSlotPlan.unassignedCandidates).toHaveLength(0);
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
    const frailDamage = frail.bestMajorCharm!.effect.expectedDamagePerHour;
    const tankyDamage = tanky.bestMajorCharm!.effect.expectedDamagePerHour;

    expect(tankyDamage / frailDamage).toBeCloseTo(81, 1);
  });
});
