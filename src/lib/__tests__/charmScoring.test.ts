import { describe, expect, it } from 'vitest';
import { getCharmDefinition } from '@/data/charms';
import {
  MODE_WEIGHTS,
  computeCharmEffect,
  computeMaxima,
  resistanceMultiplier,
  scoreEffect,
  type ScoringContext,
} from '@/lib/charmScoring';
import type { CharacterInput } from '@/types/character';
import type { OptimisationMode } from '@/types/charm';
import type { KilledMonsterStat } from '@/types/hunt';
import type { MonsterProfile } from '@/types/monster';

const character: CharacterInput = {
  level: 200,
  vocation: 'royal_paladin',
  maxHitpoints: 4000,
  maxMana: 2000,
  criticalChance: 20,
  criticalDamageBonus: 50,
  lifeLeechPercent: 10,
  manaLeechPercent: 5,
  availableCharmPoints: 0,
  availableMinorCharmEchoes: 0,
  accountType: 'premium',
  hasCharmExpansion: false,
  unlockedMajorCharms: [],
  unlockedMinorCharms: [],
  assignedMajorCharms: [],
  assignedMinorCharms: [],
  hasUsedFreeReset: false,
};

const neutralResistances = { physical: 1, fire: 1, earth: 1, energy: 1, ice: 1, holy: 1, death: 1 };

function makeMonster(overrides: Partial<MonsterProfile> = {}): MonsterProfile {
  return {
    name: 'test monster',
    hitpoints: 1000,
    experience: 500,
    difficulty: 'medium',
    charmPoints: 25,
    resistances: { ...neutralResistances },
    averageLootValue: 200,
    creatureProductValue: 50,
    supportsSkinning: true,
    supportsDusting: false,
    skinningValue: 30,
    dustingValue: 0,
    fleeHealthPercent: null,
    conditions: [],
    damageProfile: { attackType: 'melee', dealtElements: ['physical'], inflictsManaDrain: false, inflictsLifeDrain: false },
    missingFields: [],
    matchedBestiaryName: 'Test Monster',
    wasFuzzyMatched: false,
    ...overrides,
  };
}

const huntStat: KilledMonsterStat = {
  monsterName: 'test monster',
  kills: 100,
  killShare: 0.5,
  killsPerHour: 100,
  estimatedDamagePerKill: 1000,
  estimatedXpPerKill: 500,
  estimatedLootPerKill: 200,
};

function makeContext(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    character,
    monster: makeMonster(),
    huntStat,
    baseDamagePerHourAgainstMonster: 50_000,
    incomingDamagePerHourFromMonster: 10_000,
    manaDrainReceivedPerHour: 3_000,
    incomingDamageIsEstimated: true,
    ...overrides,
  };
}

describe('resistanceMultiplier', () => {
  it('assumes neutral resistance when the creature has no resistance data', () => {
    const result = resistanceMultiplier(makeMonster({ resistances: null }), 'fire');
    expect(result).toEqual({ multiplier: 1, wasAssumedNeutral: true });
  });
});

describe('computeCharmEffect - elemental damage charms', () => {
  it('matches the spec formula for Wound: hp * 0.05 * activation * resistance', () => {
    const ctx = makeContext();
    const { effect } = computeCharmEffect(getCharmDefinition('wound'), getCharmDefinition('wound').tiers[0], ctx);
    // 1000 * 0.05 * 0.05 * 1 = 2.5 per attack; attacksPerHour = killShare(0.5) * 1800 = 900
    expect(effect.expectedDamagePerHour).toBeCloseTo(2.5 * 900, 5);
    // extra kills/hour = 2250/1000 = 2.25 -> xp = 2.25*500, profit = 2.25*200
    expect(effect.expectedXpPerHour).toBeCloseTo(2.25 * 500, 5);
    expect(effect.expectedProfitPerHour).toBeCloseTo(2.25 * 200, 5);
  });

  it('clamps damage to zero and warns when the creature heals from the element', () => {
    const ctx = makeContext({ monster: makeMonster({ resistances: { ...neutralResistances, fire: -1 } }) });
    const { effect, warnings } = computeCharmEffect(getCharmDefinition('enflame'), getCharmDefinition('enflame').tiers[0], ctx);
    expect(effect.expectedDamagePerHour).toBe(0);
    expect(warnings.some((w) => w.code === 'heals_from_element')).toBe(true);
  });

  it('returns zero with a warning when monster hitpoints are unknown', () => {
    const ctx = makeContext({ monster: makeMonster({ hitpoints: null }) });
    const { effect, warnings, confidence } = computeCharmEffect(getCharmDefinition('curse'), getCharmDefinition('curse').tiers[0], ctx);
    expect(effect.expectedDamagePerHour).toBe(0);
    expect(confidence).toBe('low');
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('computeCharmEffect - Overpower and Overflux', () => {
  it('caps Overpower proc damage at 8% of monster hitpoints', () => {
    const ctx = makeContext();
    const { effect } = computeCharmEffect(getCharmDefinition('overpower'), getCharmDefinition('overpower').tiers[0], ctx);
    // char hp * 5% = 200, monster hp * 8% = 80 -> capped at 80; *activation 0.05 = 4/attack; *900/h = 3600
    expect(effect.expectedDamagePerHour).toBeCloseTo(80 * 0.05 * 900, 5);
  });

  it('caps Overflux proc damage at 8% of monster hitpoints', () => {
    const ctx = makeContext();
    const { effect } = computeCharmEffect(getCharmDefinition('overflux'), getCharmDefinition('overflux').tiers[0], ctx);
    // char mana * 2.5% = 50, monster hp * 8% = 80 -> not capped (50 < 80); *activation 0.05 = 2.5/attack; *900/h
    expect(effect.expectedDamagePerHour).toBeCloseTo(50 * 0.05 * 900, 5);
  });
});

describe('computeCharmEffect - Dodge and Parry', () => {
  it('Dodge prevents incoming damage rather than dealing it', () => {
    const ctx = makeContext();
    const { effect } = computeCharmEffect(getCharmDefinition('dodge'), getCharmDefinition('dodge').tiers[0], ctx);
    expect(effect.expectedDamagePreventedPerHour).toBeCloseTo(10_000 * 0.05, 5);
    expect(effect.expectedDamagePerHour).toBe(0);
  });

  it('Parry reflects damage to the attacker (counted as damage, not prevention)', () => {
    const ctx = makeContext();
    const { effect } = computeCharmEffect(getCharmDefinition('parry'), getCharmDefinition('parry').tiers[0], ctx);
    expect(effect.expectedDamagePerHour).toBeCloseTo(10_000 * 0.05, 5);
    expect(effect.expectedDamagePreventedPerHour).toBe(0);
  });
});

describe('computeCharmEffect - critical charms', () => {
  it('Low Blow scales with added crit chance and the character existing crit damage bonus', () => {
    const ctx = makeContext();
    const { effect } = computeCharmEffect(getCharmDefinition('low_blow'), getCharmDefinition('low_blow').tiers[0], ctx);
    expect(effect.expectedDamagePerHour).toBeCloseTo(50_000 * 0.04 * 0.5, 5);
  });

  it('Savage Blow scales with the character existing crit chance and added crit damage', () => {
    const ctx = makeContext();
    const { effect } = computeCharmEffect(getCharmDefinition('savage_blow'), getCharmDefinition('savage_blow').tiers[0], ctx);
    expect(effect.expectedDamagePerHour).toBeCloseTo(50_000 * 0.2 * 0.2, 5);
  });
});

describe('computeCharmEffect - leech and mana charms', () => {
  it('Vampiric Embrace requires existing Life Leech', () => {
    const withLeech = computeCharmEffect(getCharmDefinition('vampiric_embrace'), getCharmDefinition('vampiric_embrace').tiers[0], makeContext());
    expect(withLeech.effect.expectedHealingGainPerHour).toBeCloseTo(50_000 * 0.016, 5);

    const withoutLeech = computeCharmEffect(
      getCharmDefinition('vampiric_embrace'),
      getCharmDefinition('vampiric_embrace').tiers[0],
      makeContext({ character: { ...character, lifeLeechPercent: 0 } }),
    );
    expect(withoutLeech.effect.expectedHealingGainPerHour).toBe(0);
  });

  it("Void's Call requires existing Mana Leech", () => {
    const withoutLeech = computeCharmEffect(
      getCharmDefinition('voids_call'),
      getCharmDefinition('voids_call').tiers[0],
      makeContext({ character: { ...character, manaLeechPercent: 0 } }),
    );
    expect(withoutLeech.effect.expectedManaGainPerHour).toBe(0);
  });

  it('Void Inversion only has value against creatures with a Mana Drain attack', () => {
    const noDrain = computeCharmEffect(getCharmDefinition('void_inversion'), getCharmDefinition('void_inversion').tiers[0], makeContext());
    expect(noDrain.effect.expectedManaSavedPerHour).toBe(0);

    const withDrain = computeCharmEffect(
      getCharmDefinition('void_inversion'),
      getCharmDefinition('void_inversion').tiers[0],
      makeContext({
        monster: makeMonster({ damageProfile: { attackType: 'melee', dealtElements: [], inflictsManaDrain: true, inflictsLifeDrain: false } }),
      }),
    );
    expect(withDrain.effect.expectedManaSavedPerHour).toBeCloseTo(3_000 * 0.2, 5);
  });
});

describe('computeCharmEffect - profit charms', () => {
  it('Gut multiplies kills/hour by creature product value and the tier bonus', () => {
    const ctx = makeContext();
    const { effect } = computeCharmEffect(getCharmDefinition('gut'), getCharmDefinition('gut').tiers[0], ctx);
    expect(effect.expectedProfitPerHour).toBeCloseTo(100 * 50 * 0.06, 5);
  });

  it('Scavenge only counts the Skinning/Dusting values the creature actually supports', () => {
    const ctx = makeContext();
    const { effect } = computeCharmEffect(getCharmDefinition('scavenge'), getCharmDefinition('scavenge').tiers[0], ctx);
    // supportsDusting is false, so only skinningValue (30) counts even though dustingValue is set to 0 anyway.
    expect(effect.expectedProfitPerHour).toBeCloseTo(100 * 30 * 0.6, 5);
  });
});

describe('computeCharmEffect - Carnage (on-kill AoE)', () => {
  it('scales with kills/hour rather than attacks/hour', () => {
    const ctx = makeContext();
    const { effect } = computeCharmEffect(getCharmDefinition('carnage'), getCharmDefinition('carnage').tiers[0], ctx);
    expect(effect.expectedDamagePerHour).toBeCloseTo(1000 * 0.15 * 0.1 * 1 * 100, 5);
  });
});

describe('scoring normalisation', () => {
  it('every optimisation mode weight set sums to 1', () => {
    for (const mode of Object.keys(MODE_WEIGHTS) as OptimisationMode[]) {
      const w = MODE_WEIGHTS[mode];
      const sum = w.damage + w.xp + w.profit + w.safety + w.supplySaving + w.utility;
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it('min-max normalises the top candidate to 100 on its dominant metric', () => {
    const effects = [
      { expectedDamagePerHour: 1000, expectedXpPerHour: 0, expectedProfitPerHour: 0, expectedDamagePreventedPerHour: 0, expectedHealingGainPerHour: 0, expectedManaGainPerHour: 0, expectedManaSavedPerHour: 0, utilityMagnitude: 0 },
      { expectedDamagePerHour: 500, expectedXpPerHour: 0, expectedProfitPerHour: 0, expectedDamagePreventedPerHour: 0, expectedHealingGainPerHour: 0, expectedManaGainPerHour: 0, expectedManaSavedPerHour: 0, utilityMagnitude: 0 },
    ];
    const maxima = computeMaxima(effects);
    const scores = effects.map((e) => scoreEffect(e, maxima, MODE_WEIGHTS.balanced));
    expect(scores[0]?.damageScore).toBeCloseTo(100, 5);
    expect(scores[1]?.damageScore).toBeCloseTo(50, 5);
    expect(scores[0]?.totalScore).toBeCloseTo(100 * MODE_WEIGHTS.balanced.damage, 5);
  });
});
