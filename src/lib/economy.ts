// Gold-cost mechanics around Charms: account slot limits, removal cost and
// the once-free, then level-scaled, full reset.
import type { AccountType, UnlockedCharm } from '@/types/character';
import type { CharmTier } from '@/types/charm';

export const FREE_ACCOUNT_MAJOR_CHARM_SLOTS = 2;
export const PREMIUM_ACCOUNT_MAJOR_CHARM_SLOTS = 6;
export const CHARM_EXPANSION_REMOVAL_DISCOUNT = 0.25;
export const RESET_BASE_COST = 100_000;
export const RESET_COST_PER_LEVEL_ABOVE_100 = 11_000;
export const RESET_LEVEL_THRESHOLD = 100;

/** Cumulative Minor Charm Echoes earned per Major Charm, by the tier it's unlocked to: 50 at Bronze, +100 at Silver, +200 at Gold. */
const CUMULATIVE_MCE_BY_TIER: Record<CharmTier, number> = { 1: 50, 2: 150, 3: 350 };
/** One-time Minor Charm Echo grant for promoting your character (Tibia gives 100 the moment you promote, in addition to whatever Major Charms have unlocked). */
export const PROMOTION_MINOR_CHARM_ECHO_BONUS = 100;

/**
 * How many Minor Charm Echoes a character should already have available,
 * derived from their currently-unlocked Major Charms (each one earns MCE as
 * it's upgraded) plus the one-time promotion bonus. This is a suggestion to
 * prefill/cross-check the manually-entered budget, not an override - players
 * may have spent some already.
 */
export function calculateAvailableMinorCharmEchoes(unlockedMajorCharms: UnlockedCharm[], isPromoted: boolean): number {
  const fromMajorCharms = unlockedMajorCharms.reduce((sum, charm) => sum + CUMULATIVE_MCE_BY_TIER[charm.tier], 0);
  return fromMajorCharms + (isPromoted ? PROMOTION_MINOR_CHARM_ECHO_BONUS : 0);
}

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
