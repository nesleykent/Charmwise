// Gold-cost mechanics around Charms: account slot limits, removal cost and
// the once-free, then level-scaled, full reset.
import type { AccountType } from '@/types/character';

export const FREE_ACCOUNT_MAJOR_CHARM_SLOTS = 2;
export const PREMIUM_ACCOUNT_MAJOR_CHARM_SLOTS = 6;
export const CHARM_EXPANSION_REMOVAL_DISCOUNT = 0.25;
export const RESET_BASE_COST = 100_000;
export const RESET_COST_PER_LEVEL_ABOVE_100 = 11_000;
export const RESET_LEVEL_THRESHOLD = 100;

/** Number of creatures that may have an active Major Charm simultaneously. `null` means unlimited (Charm Expansion). */
export function calculateMajorCharmSlotLimit(accountType: AccountType, hasCharmExpansion: boolean): number | null {
  if (hasCharmExpansion) return null;
  return accountType === 'premium' ? PREMIUM_ACCOUNT_MAJOR_CHARM_SLOTS : FREE_ACCOUNT_MAJOR_CHARM_SLOTS;
}

/** Gold cost to unassign a Charm from a creature so a different one can take its place. */
export function calculateRemovalCost(level: number, hasCharmExpansion: boolean): number {
  const base = level * 100;
  return hasCharmExpansion ? base * (1 - CHARM_EXPANSION_REMOVAL_DISCOUNT) : base;
}

/** Gold cost of a full Charm reset. The first reset ever is free. */
export function calculateResetCost(level: number, hasUsedFreeReset: boolean): number {
  if (!hasUsedFreeReset) return 0;
  if (level <= RESET_LEVEL_THRESHOLD) return RESET_BASE_COST;
  return RESET_BASE_COST + (level - RESET_LEVEL_THRESHOLD) * RESET_COST_PER_LEVEL_ABOVE_100;
}
