import { describe, expect, it } from 'vitest';
import { calculateMajorCharmSlotLimit, calculateRemovalCost, calculateResetCost } from '@/lib/economy';

describe('calculateMajorCharmSlotLimit', () => {
  it('gives free accounts 2 slots and premium accounts 6', () => {
    expect(calculateMajorCharmSlotLimit('free', false)).toBe(2);
    expect(calculateMajorCharmSlotLimit('premium', false)).toBe(6);
  });

  it('removes the limit entirely with the Charm Expansion', () => {
    expect(calculateMajorCharmSlotLimit('free', true)).toBeNull();
    expect(calculateMajorCharmSlotLimit('premium', true)).toBeNull();
  });
});

describe('calculateRemovalCost', () => {
  it('is level * 100 gold without the Charm Expansion', () => {
    expect(calculateRemovalCost(200, false)).toBe(20_000);
  });

  it('is reduced by 25% with the Charm Expansion', () => {
    expect(calculateRemovalCost(200, true)).toBe(15_000);
  });
});

describe('calculateResetCost', () => {
  it('is free the first time', () => {
    expect(calculateResetCost(300, false)).toBe(0);
  });

  it('is a flat 100,000 gold at or below level 100 after the free reset', () => {
    expect(calculateResetCost(100, true)).toBe(100_000);
    expect(calculateResetCost(50, true)).toBe(100_000);
  });

  it('adds 11,000 gold per level above 100 after the free reset', () => {
    expect(calculateResetCost(101, true)).toBe(111_000);
    expect(calculateResetCost(103, true)).toBe(133_000);
  });
});
