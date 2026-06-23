import { describe, expect, it } from 'vitest';
import { buildMonsterProfile, findBestiaryEntry, getBestiaryEntries, levenshteinDistance, normaliseMonster } from '@/lib/normaliseMonster';
import type { RawBestiaryEntry } from '@/types/monster';

const FIXTURE: RawBestiaryEntry[] = [
  {
    name: 'Toad',
    hitpoints: 135,
    experience: 60,
    difficulty: 'Easy',
    attack_type: 'Melee',
    damage_types: ['physical', 'earth'],
    negative_conditions: [],
    flee_percent: 15,
    // The upstream export stores this as a numeric string, not a number.
    mitigation: '0.36',
    resistances: [
      { type: 'physical', value: 100 },
      { type: 'earth', value: 80 },
      { type: 'fire', value: 110 },
      { type: 'death', value: 100 },
      { type: 'energy', value: 100 },
      { type: 'holy', value: 100 },
      { type: 'ice', value: 80 },
    ],
    charm_details: { first_stage: 25, second_stage: 250, third_stage: 500, charm_points: 15 },
  },
  {
    name: 'Abyssal Calamary',
    hitpoints: 9000,
    experience: 7000,
    difficulty: 'Challenging',
    attack_type: 'Melee, Ranged',
    damage_types: ['physical', 'energy', 'mana drain'],
    negative_conditions: ['drunkenness'],
    resistances: [
      { type: 'physical', value: 100 },
      { type: 'fire', value: -100 },
    ],
    charm_details: { charm_points: 100 },
  },
];

describe('normaliseMonster', () => {
  it('maps a matched entry into a MonsterProfile with fractional resistances', () => {
    const profile = buildMonsterProfile('toad', FIXTURE);
    expect(profile.matchedBestiaryName).toBe('Toad');
    expect(profile.wasFuzzyMatched).toBe(false);
    expect(profile.hitpoints).toBe(135);
    expect(profile.experience).toBe(60);
    expect(profile.difficulty).toBe('easy');
    expect(profile.charmPoints).toBe(15);
    expect(profile.resistances).toEqual({
      physical: 1,
      fire: 1.1,
      earth: 0.8,
      energy: 1,
      ice: 0.8,
      holy: 1,
      death: 1,
    });
    expect(profile.damageProfile?.attackType).toBe('melee');
  });

  it('parses the numeric-string mitigation field as a percentage, converting to a true fraction', () => {
    // Upstream stores 0.36 meaning "0.36%" (confirmed against TibiaWiki,
    // which displays this exact raw figure with a "%" suffix) - dividing by
    // 100 again gives the true 0-1 fraction this app's formulas expect.
    const profile = buildMonsterProfile('toad', FIXTURE);
    expect(profile.mitigation).toBeCloseTo(0.0036, 6);
    expect(profile.missingFields).not.toContain('mitigation');
  });

  it('normalises flee thresholds from percent values to fractions', () => {
    const profile = buildMonsterProfile('toad', FIXTURE);
    expect(profile.fleeHealthPercent).toBeCloseTo(0.15, 6);
    expect(profile.missingFields).not.toContain('fleeHealthPercent');
  });

  it('is case- and whitespace-insensitive and strips a leading article', () => {
    const a = buildMonsterProfile('  TOAD  ', FIXTURE);
    const b = buildMonsterProfile('a toad', FIXTURE);
    expect(a.matchedBestiaryName).toBe('Toad');
    expect(b.matchedBestiaryName).toBe('Toad');
  });

  it('detects mixed attack types and mana drain', () => {
    const profile = buildMonsterProfile('Abyssal Calamary', FIXTURE);
    expect(profile.damageProfile?.attackType).toBe('mixed');
    expect(profile.damageProfile?.inflictsManaDrain).toBe(true);
    expect(profile.conditions).toEqual(['drunkenness']);
  });

  it('treats a negative resistance value as a fractional multiplier below zero (the creature heals from it)', () => {
    const profile = buildMonsterProfile('Abyssal Calamary', FIXTURE);
    expect(profile.resistances?.fire).toBe(-1);
  });

  it('records mitigation as missing rather than guessing zero when the entry has none', () => {
    const profile = buildMonsterProfile('Abyssal Calamary', FIXTURE);
    expect(profile.mitigation).toBeNull();
    expect(profile.missingFields).toContain('mitigation');
  });

  it('lists every field it could not source as missing, for an unmatched creature', () => {
    const profile = buildMonsterProfile('totally fake monster xyz', FIXTURE);
    expect(profile.matchedBestiaryName).toBeNull();
    expect(profile.hitpoints).toBeNull();
    expect(profile.missingFields).toContain('hitpoints');
    expect(profile.missingFields).toContain('resistances');
  });

  it('falls back to the Hunt-Analyser-derived loot value when bestiary has none', () => {
    const profile = buildMonsterProfile('toad', FIXTURE, 42);
    expect(profile.averageLootValue).toBe(42);
    expect(profile.missingFields).not.toContain('averageLootValue');
  });

  it('fuzzy-matches a small typo but not a different word entirely', () => {
    const typo = findBestiaryEntry('Toade', FIXTURE);
    expect(typo.entry?.name).toBe('Toad');
    expect(typo.wasFuzzyMatched).toBe(true);

    const unrelated = findBestiaryEntry('Dragon Lord', FIXTURE);
    expect(unrelated.entry).toBeNull();
  });

  it('computes Levenshtein distance correctly', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(levenshteinDistance('toad', 'toad')).toBe(0);
  });
});

describe('normaliseMonster against the bundled bestiary.json', () => {
  it('loads the real bestiary file with a sane number of entries', () => {
    expect(getBestiaryEntries().length).toBeGreaterThan(100);
  });

  it('matches the creatures from the sample Hunt Analyser session', () => {
    const crusader = normaliseMonster('crusader');
    expect(crusader.matchedBestiaryName).toBe('Crusader');
    expect(crusader.hitpoints).toBe(3400);
    expect(crusader.charmPoints).toBe(50);

    const headwalker = normaliseMonster('headwalker');
    expect(headwalker.matchedBestiaryName).toBe('Headwalker');
    expect(headwalker.hitpoints).toBe(2460);
  });

  it('hydrates Skinning, Dusting, and Creature Product mappings for priority creatures', () => {
    const dragon = normaliseMonster('Dragon');
    expect(dragon.skinning?.productItemId).toBe('green_dragon_leather');
    expect(dragon.skinning?.baseSuccessChance).toBeNull();
    expect(dragon.missingFields).toContain('skinning.baseSuccessChance');
    expect(dragon.creatureProducts.some((product) => product.itemId === 'green_dragon_leather')).toBe(true);

    const dragonLord = normaliseMonster('Dragon Lord');
    expect(dragonLord.skinning?.productItemId).toBe('red_dragon_leather');
    expect(dragonLord.creatureProducts.some((product) => product.itemId === 'red_dragon_leather')).toBe(true);

    const vampire = normaliseMonster('Vampire');
    expect(vampire.dusting?.productItemId).toBe('vampire_dust');
    expect(vampire.dusting?.baseSuccessChance).toBeNull();
    expect(vampire.missingFields).toContain('dusting.baseSuccessChance');

    const demon = normaliseMonster('Demon');
    expect(demon.dusting?.productItemId).toBe('demon_dust');

    const albinoDragon = normaliseMonster('Albino Dragon');
    expect(albinoDragon.skinning?.productItemId).toBe('albino_dragon_leather');
    expect(albinoDragon.creatureProducts.some((product) => product.itemId === 'albino_dragon_leather')).toBe(true);
  });
});
