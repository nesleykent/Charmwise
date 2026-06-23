import { describe, expect, it } from 'vitest';
import { detectBaseVocation, estimateHitpointsAndMana } from '@/lib/vocationFormulas';

describe('detectBaseVocation', () => {
  it('matches the base vocation inside a promoted title', () => {
    expect(detectBaseVocation('Elite Knight')).toBe('knight');
    expect(detectBaseVocation('Royal Paladin')).toBe('paladin');
    expect(detectBaseVocation('Elder Druid')).toBe('druid');
    expect(detectBaseVocation('Master Sorcerer')).toBe('sorcerer');
    expect(detectBaseVocation('Exalted Monk')).toBe('monk');
  });

  it('matches an unpromoted vocation too', () => {
    expect(detectBaseVocation('Knight')).toBe('knight');
  });

  it('returns null for "None" (no vocation chosen yet)', () => {
    expect(detectBaseVocation('None')).toBeNull();
  });
});

describe('estimateHitpointsAndMana', () => {
  it('agrees on the shared level-8 baseline across every vocation', () => {
    for (const vocation of ['Knight', 'Paladin', 'Druid', 'Sorcerer', 'Monk']) {
      expect(estimateHitpointsAndMana(8, vocation)).toEqual({ hitpoints: 185, mana: 90 });
    }
  });

  it('applies the correct per-level gain rate past level 8', () => {
    expect(estimateHitpointsAndMana(108, 'Elite Knight')).toEqual({ hitpoints: 185 + 100 * 15, mana: 90 + 100 * 5 });
    expect(estimateHitpointsAndMana(108, 'Royal Paladin')).toEqual({ hitpoints: 185 + 100 * 10, mana: 90 + 100 * 15 });
    expect(estimateHitpointsAndMana(108, 'Elder Druid')).toEqual({ hitpoints: 185 + 100 * 5, mana: 90 + 100 * 30 });
    expect(estimateHitpointsAndMana(108, 'Master Sorcerer')).toEqual({ hitpoints: 185 + 100 * 5, mana: 90 + 100 * 30 });
    expect(estimateHitpointsAndMana(108, 'Exalted Monk')).toEqual({ hitpoints: 185 + 100 * 10, mana: 90 + 100 * 10 });
  });

  it('returns null below level 8, where growth is not vocation-specific', () => {
    expect(estimateHitpointsAndMana(7, 'Elite Knight')).toBeNull();
  });

  it('returns null for an unrecognised or absent vocation', () => {
    expect(estimateHitpointsAndMana(200, 'None')).toBeNull();
  });
});
