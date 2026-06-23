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
  isPromoted: false,
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
    mitigation: null,
    averageLootValue: 200,
    creatureProductValue: 50,
    supportsSkinning: true,
    supportsDusting: false,
    skinningValue: 30,
    dustingValue: 0,
    creatureProducts: [
      {
        itemId: 'test_product',
        itemName: 'Test Product',
        npcPrice: 50,
        marketPrice: null,
        marketPriceByWorld: {},
        weight: null,
        dropChance: 1,
        dropChanceConfidence: 'high',
        sourceUrl: 'test',
        lastVerifiedAt: '2026-06-23',
      },
    ],
    skinning: {
      eligible: true,
      tool: 'obsidian_knife',
      productItemId: 'test_leather',
      productItemName: 'Test Leather',
      npcPrice: 30,
      marketPrice: null,
      marketPriceByWorld: {},
      baseSuccessChance: 0.2,
      baseSuccessChanceConfidence: 'high',
      corpseEligibleSeconds: 300,
      specialCaseMultipleAttempts: false,
      specialCaseGuaranteedSuccess: false,
      sourceUrl: 'test',
      lastVerifiedAt: '2026-06-23',
      confidence: 'high',
    },
    dusting: null,
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
    // Matches the killShare(0.5) * 1800 used throughout the formula comments below.
    attacksPerHour: 900,
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

  it('caps base damage at 2x character level (Winter Update 2024) against very high-HP creatures', () => {
    // 100,000 hp * 5% = 5,000 uncapped, but level 50 caps it at 50*2=100.
    const ctx = makeContext({
      character: { ...character, level: 50 },
      monster: makeMonster({ hitpoints: 100_000 }),
    });
    const { effect, warnings } = computeCharmEffect(getCharmDefinition('wound'), getCharmDefinition('wound').tiers[0], ctx);
    // capped base 100 * activation 0.05 * resistance 1 * attacksPerHour 900 = 4500, not 5000*0.05*900=225000
    expect(effect.expectedDamagePerHour).toBeCloseTo(100 * 0.05 * 900, 5);
    expect(warnings.some((w) => w.code === 'damage_level_capped' && w.params?.multiplier === 2)).toBe(true);
  });

  it('does not cap or warn when the level cap does not bind', () => {
    const ctx = makeContext(); // level 200 -> cap 400; monster hp 1000 * 5% = 50, well under the cap
    const { warnings } = computeCharmEffect(getCharmDefinition('wound'), getCharmDefinition('wound').tiers[0], ctx);
    expect(warnings.some((w) => w.code === 'damage_level_capped')).toBe(false);
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

  it('Parry reduces reflected damage by the monster armour mitigation when known, and raises confidence to high', () => {
    const ctx = makeContext({ monster: makeMonster({ mitigation: 0.4 }), incomingDamageIsEstimated: false });
    const { effect, warnings, confidence } = computeCharmEffect(getCharmDefinition('parry'), getCharmDefinition('parry').tiers[0], ctx);
    expect(effect.expectedDamagePerHour).toBeCloseTo(10_000 * 0.05 * (1 - 0.4), 5);
    expect(confidence).toBe('high');
    expect(warnings.some((w) => w.code === 'parry_armour_note_with_mitigation')).toBe(true);
  });

  it('Parry treats unknown armour mitigation as a flat upper bound, with medium confidence', () => {
    const ctx = makeContext({ monster: makeMonster({ mitigation: null }) });
    const { effect, warnings, confidence } = computeCharmEffect(getCharmDefinition('parry'), getCharmDefinition('parry').tiers[0], ctx);
    expect(effect.expectedDamagePerHour).toBeCloseTo(10_000 * 0.05, 5);
    expect(confidence).toBe('medium');
    expect(warnings.some((w) => w.code === 'parry_armour_note')).toBe(true);
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
  it('Gut uses per-product drop EV rather than a generic creature product value', () => {
    const ctx = makeContext();
    const { effect } = computeCharmEffect(getCharmDefinition('gut'), getCharmDefinition('gut').tiers[0], ctx);
    expect(effect.expectedProfitPerHour).toBeCloseTo(100 * 50 * 0.06, 5);
  });

  it('Gut excludes products with unknown drop chance instead of inventing EV', () => {
    const ctx = makeContext({
      monster: makeMonster({
        creatureProductValue: null,
        creatureProducts: [
          {
            itemId: 'unknown_drop_product',
            itemName: 'Unknown Drop Product',
            npcPrice: 1000,
            marketPrice: null,
            marketPriceByWorld: {},
            weight: null,
            dropChance: null,
            dropChanceConfidence: 'unknown',
            sourceUrl: 'test',
            lastVerifiedAt: '2026-06-23',
          },
        ],
      }),
    });
    const { effect, warnings, confidence } = computeCharmEffect(getCharmDefinition('gut'), getCharmDefinition('gut').tiers[0], ctx);
    expect(effect.expectedProfitPerHour).toBe(0);
    expect(confidence).toBe('unknown');
    expect(warnings.some((w) => w.code === 'unknown_creature_product_drop_chance')).toBe(true);
  });

  it('Gut handles high-value low-drop creature products', () => {
    const ctx = makeContext({
      monster: makeMonster({
        creatureProducts: [
          {
            itemId: 'boss_trophy',
            itemName: 'Boss Trophy',
            npcPrice: 50_000,
            marketPrice: null,
            marketPriceByWorld: {},
            weight: null,
            dropChance: 0.01,
            dropChanceConfidence: 'medium',
            sourceUrl: 'test',
            lastVerifiedAt: '2026-06-23',
          },
        ],
      }),
    });
    const { effect, confidence } = computeCharmEffect(getCharmDefinition('gut'), getCharmDefinition('gut').tiers[0], ctx);
    expect(effect.expectedProfitPerHour).toBeCloseTo(100 * 0.01 * 50_000 * 0.06, 5);
    expect(confidence).toBe('medium');
  });

  it('Gut keeps known zero-price products in the model without fabricating price', () => {
    const ctx = makeContext({
      monster: makeMonster({
        creatureProducts: [
          {
            itemId: 'zero_price_product',
            itemName: 'Zero Price Product',
            npcPrice: 0,
            marketPrice: null,
            marketPriceByWorld: {},
            weight: null,
            dropChance: 1,
            dropChanceConfidence: 'high',
            sourceUrl: 'test',
            lastVerifiedAt: '2026-06-23',
          },
        ],
      }),
    });
    const { effect, warnings, confidence } = computeCharmEffect(getCharmDefinition('gut'), getCharmDefinition('gut').tiers[0], ctx);
    expect(effect.expectedProfitPerHour).toBe(0);
    expect(confidence).toBe('high');
    expect(warnings.some((w) => w.code === 'missing_product_price')).toBe(false);
  });

  it('Scavenge uses success chance delta, not a direct product-value multiplier', () => {
    const ctx = makeContext();
    const { effect } = computeCharmEffect(getCharmDefinition('scavenge'), getCharmDefinition('scavenge').tiers[0], ctx);
    // 20% base success chance * 60% Bronze relative increase * 30 gp product value * 100 kills/hour.
    expect(effect.expectedProfitPerHour).toBeCloseTo(100 * 0.2 * 0.6 * 30, 5);
  });

  it('Scavenge excludes mapped actions when base success chance is unknown', () => {
    const ctx = makeContext({
      monster: makeMonster({
        skinning: makeMonster().skinning
          ? {
              ...makeMonster().skinning!,
              baseSuccessChance: null,
              baseSuccessChanceConfidence: 'unknown',
            }
          : null,
      }),
    });
    const { effect, warnings, confidence } = computeCharmEffect(getCharmDefinition('scavenge'), getCharmDefinition('scavenge').tiers[0], ctx);
    expect(effect.expectedProfitPerHour).toBe(0);
    expect(confidence).toBe('unknown');
    expect(warnings.some((w) => w.code === 'unknown_scavenge_base_chance')).toBe(true);
  });
});

describe('computeCharmEffect - Carnage (on-kill AoE)', () => {
  it('scales with kills/hour rather than attacks/hour', () => {
    const ctx = makeContext();
    const { effect } = computeCharmEffect(getCharmDefinition('carnage'), getCharmDefinition('carnage').tiers[0], ctx);
    expect(effect.expectedDamagePerHour).toBeCloseTo(1000 * 0.15 * 0.1 * 1 * 100, 5);
  });

  it('caps base damage at 6x character level (3x the elemental cap, matching its 3x higher percentage)', () => {
    // 100,000 hp * 15% = 15,000 uncapped, but level 50 caps it at 50*6=300.
    const ctx = makeContext({
      character: { ...character, level: 50 },
      monster: makeMonster({ hitpoints: 100_000 }),
    });
    const { effect, warnings } = computeCharmEffect(getCharmDefinition('carnage'), getCharmDefinition('carnage').tiers[0], ctx);
    expect(effect.expectedDamagePerHour).toBeCloseTo(300 * 0.1 * 1 * 100, 5);
    expect(warnings.some((w) => w.code === 'damage_level_capped' && w.params?.multiplier === 6)).toBe(true);
  });

  it('reduces the AoE estimate by the killed creature armour mitigation as a stand-in, but never exceeds medium confidence', () => {
    // Even with both resistance and mitigation known, the cross-creature gap
    // (the splash hits a DIFFERENT, unknown nearby creature) can't be
    // resolved by better data about the one that died.
    const ctx = makeContext({ monster: makeMonster({ mitigation: 0.3 }) });
    const { effect, warnings, confidence } = computeCharmEffect(getCharmDefinition('carnage'), getCharmDefinition('carnage').tiers[0], ctx);
    expect(effect.expectedDamagePerHour).toBeCloseTo(1000 * 0.15 * 0.1 * 1 * 100 * (1 - 0.3), 5);
    expect(confidence).toBe('medium');
    expect(warnings.some((w) => w.code === 'carnage_aoe_note_with_mitigation')).toBe(true);
  });

  it('applies no mitigation reduction when the killed creature has no known armour data', () => {
    const ctx = makeContext({ monster: makeMonster({ mitigation: null }) });
    const { effect, warnings } = computeCharmEffect(getCharmDefinition('carnage'), getCharmDefinition('carnage').tiers[0], ctx);
    expect(effect.expectedDamagePerHour).toBeCloseTo(1000 * 0.15 * 0.1 * 1 * 100, 5);
    expect(warnings.some((w) => w.code === 'carnage_aoe_note')).toBe(true);
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
    expect(scores[0]?.rawTotalScore).toBeCloseTo(100 * MODE_WEIGHTS.balanced.damage, 5);
    expect(scores[0]?.totalScore).toBeCloseTo(100 * MODE_WEIGHTS.balanced.damage, 5);
    expect(scores[0]?.normalisationBasis.damage).toBe(1000);
    expect(scores[0]?.weights).toEqual(MODE_WEIGHTS.balanced);
  });

  it('applies confidence multipliers only to total ranking score', () => {
    const effect = {
      expectedDamagePerHour: 1000,
      expectedXpPerHour: 0,
      expectedProfitPerHour: 0,
      expectedDamagePreventedPerHour: 0,
      expectedHealingGainPerHour: 0,
      expectedManaGainPerHour: 0,
      expectedManaSavedPerHour: 0,
      utilityMagnitude: 0,
    };
    const maxima = computeMaxima([effect]);
    const low = scoreEffect(effect, maxima, MODE_WEIGHTS.balanced, 'low');
    const unknown = scoreEffect(effect, maxima, MODE_WEIGHTS.balanced, 'unknown');

    expect(low.rawTotalScore).toBeCloseTo(100 * MODE_WEIGHTS.balanced.damage, 5);
    expect(low.confidenceMultiplier).toBe(0.6);
    expect(low.totalScore).toBeCloseTo(low.rawTotalScore * 0.6, 5);
    expect(unknown.rawTotalScore).toBeCloseTo(low.rawTotalScore, 5);
    expect(unknown.confidenceMultiplier).toBe(0);
    expect(unknown.totalScore).toBe(0);
  });
});
