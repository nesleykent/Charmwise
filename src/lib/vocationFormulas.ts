// Base-vocation Hit Point / Mana growth, used only to prefill a sensible
// starting estimate when looking up a character by name - the result stays
// fully editable, since the Wheel of Destiny (Dedication perks) and Gems
// (Basic Mods) can both push real characters above this baseline and aren't
// modelled here. Promotion and Loyalty do NOT affect max HP/Mana (verified -
// Promotion only improves regen rate/soul points/death penalty, Loyalty only
// affects skills), so they're correctly absent from this list.
//
// Verified against three independent sources before implementing (see the
// chat for the research trail): Tibia.com's own game manual (per-level HP/
// Mana gain for Knight/Paladin/Druid/Sorcerer/Monk), a second independent
// Monk guide confirming +10 HP/+10 Mana per level, and TibiaWiki's Formulae
// page (closed-form level->HP/Mana formulas for the first four vocations).
// All three agree that every vocation shares the same growth up to level 8
// (185 HP / 90 Mana), diverging only afterwards - this anchor-and-rate model
// reproduces TibiaWiki's closed-form formulas exactly for Knight, Paladin,
// Druid and Sorcerer, so the same anchor is used for Monk's confirmed rate
// rather than a single, harder-to-cross-check intercept for that vocation.
const SHARED_BASELINE_LEVEL = 8;
const SHARED_BASELINE_HP = 185;
const SHARED_BASELINE_MANA = 90;

export type BaseVocation = 'knight' | 'paladin' | 'druid' | 'sorcerer' | 'monk';

const GAIN_PER_LEVEL: Record<BaseVocation, { hp: number; mana: number }> = {
  knight: { hp: 15, mana: 5 },
  paladin: { hp: 10, mana: 15 },
  druid: { hp: 5, mana: 30 },
  sorcerer: { hp: 5, mana: 30 },
  monk: { hp: 10, mana: 10 },
};

/** Tibia reports the promoted title (e.g. "Elder Druid", "Royal Paladin") - match the base vocation word it contains rather than requiring an exact string. */
export function detectBaseVocation(vocation: string): BaseVocation | null {
  const lower = vocation.toLowerCase();
  if (lower.includes('knight')) return 'knight';
  if (lower.includes('paladin')) return 'paladin';
  if (lower.includes('druid')) return 'druid';
  if (lower.includes('sorcerer')) return 'sorcerer';
  if (lower.includes('monk')) return 'monk';
  return null;
}

/** Null below level 8 (shared, vocation-independent growth that isn't modelled here) or for an unrecognised vocation string. */
export function estimateHitpointsAndMana(level: number, vocation: string): { hitpoints: number; mana: number } | null {
  if (!Number.isFinite(level) || level < SHARED_BASELINE_LEVEL) return null;
  const baseVocation = detectBaseVocation(vocation);
  if (!baseVocation) return null;

  const rate = GAIN_PER_LEVEL[baseVocation];
  const levelsAboveBaseline = level - SHARED_BASELINE_LEVEL;
  return {
    hitpoints: SHARED_BASELINE_HP + levelsAboveBaseline * rate.hp,
    mana: SHARED_BASELINE_MANA + levelsAboveBaseline * rate.mana,
  };
}
