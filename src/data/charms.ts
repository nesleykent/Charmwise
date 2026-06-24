// Static Charm catalogue. Costs, activation chances and effect magnitudes are
// transcribed from the official Charm system (see README "Data sources").
// All percentages are stored as fractions (0-1) so scoring code never needs
// to remember to divide by 100.
import type { CharmDefinition, CharmEffectKind, CharmRole, MajorCharmId, MinorCharmId } from '@/types/charm';

/** Shared cap used by Overpower and Overflux: proc damage never exceeds this share of the creature's total health. */
export const PERCENT_HP_DAMAGE_CAP = 0.08;

export const MAJOR_CHARMS: Record<MajorCharmId, CharmDefinition> = {
  carnage: {
    id: 'carnage',
    category: 'major',
    name: 'Carnage',
    descriptionKey: 'charms.carnage.description',
    currency: 'charm_points',
    effectKind: 'aoe_damage_on_kill',
    element: 'physical',
    tiers: [
      { tier: 1, cost: 600, activationChance: 0.1, value: 0.15 },
      { tier: 2, cost: 900, activationChance: 0.2, value: 0.15 },
      { tier: 3, cost: 3000, activationChance: 0.22, value: 0.15 },
    ],
  },
  curse: {
    id: 'curse',
    category: 'major',
    name: 'Curse',
    descriptionKey: 'charms.curse.description',
    currency: 'charm_points',
    effectKind: 'elemental_damage_on_attack',
    element: 'death',
    tiers: [
      { tier: 1, cost: 360, activationChance: 0.05, value: 0.05 },
      { tier: 2, cost: 540, activationChance: 0.1, value: 0.05 },
      { tier: 3, cost: 1800, activationChance: 0.11, value: 0.05 },
    ],
  },
  divine_wrath: {
    id: 'divine_wrath',
    category: 'major',
    name: 'Divine Wrath',
    descriptionKey: 'charms.divine_wrath.description',
    currency: 'charm_points',
    effectKind: 'elemental_damage_on_attack',
    element: 'holy',
    tiers: [
      { tier: 1, cost: 600, activationChance: 0.05, value: 0.05 },
      { tier: 2, cost: 900, activationChance: 0.1, value: 0.05 },
      { tier: 3, cost: 3000, activationChance: 0.11, value: 0.05 },
    ],
  },
  dodge: {
    id: 'dodge',
    category: 'major',
    name: 'Dodge',
    descriptionKey: 'charms.dodge.description',
    currency: 'charm_points',
    effectKind: 'dodge_incoming_damage',
    tiers: [
      { tier: 1, cost: 240, activationChance: 0.05, value: 1 },
      { tier: 2, cost: 360, activationChance: 0.1, value: 1 },
      { tier: 3, cost: 1200, activationChance: 0.11, value: 1 },
    ],
  },
  enflame: {
    id: 'enflame',
    category: 'major',
    name: 'Enflame',
    descriptionKey: 'charms.enflame.description',
    currency: 'charm_points',
    effectKind: 'elemental_damage_on_attack',
    element: 'fire',
    tiers: [
      { tier: 1, cost: 400, activationChance: 0.05, value: 0.05 },
      { tier: 2, cost: 600, activationChance: 0.1, value: 0.05 },
      { tier: 3, cost: 2000, activationChance: 0.11, value: 0.05 },
    ],
  },
  freeze: {
    id: 'freeze',
    category: 'major',
    name: 'Freeze',
    descriptionKey: 'charms.freeze.description',
    currency: 'charm_points',
    effectKind: 'elemental_damage_on_attack',
    element: 'ice',
    tiers: [
      { tier: 1, cost: 320, activationChance: 0.05, value: 0.05 },
      { tier: 2, cost: 480, activationChance: 0.1, value: 0.05 },
      { tier: 3, cost: 1600, activationChance: 0.11, value: 0.05 },
    ],
  },
  low_blow: {
    id: 'low_blow',
    category: 'major',
    name: 'Low Blow',
    descriptionKey: 'charms.low_blow.description',
    currency: 'charm_points',
    effectKind: 'critical_chance_bonus',
    tiers: [
      { tier: 1, cost: 800, value: 0.04 },
      { tier: 2, cost: 1200, value: 0.08 },
      { tier: 3, cost: 4000, value: 0.09 },
    ],
  },
  overpower: {
    id: 'overpower',
    category: 'major',
    name: 'Overpower',
    descriptionKey: 'charms.overpower.description',
    currency: 'charm_points',
    effectKind: 'percent_hitpoints_damage_on_attack',
    tiers: [
      { tier: 1, cost: 600, activationChance: 0.05, value: 0.05 },
      { tier: 2, cost: 900, activationChance: 0.1, value: 0.05 },
      { tier: 3, cost: 3000, activationChance: 0.11, value: 0.05 },
    ],
  },
  overflux: {
    id: 'overflux',
    category: 'major',
    name: 'Overflux',
    descriptionKey: 'charms.overflux.description',
    currency: 'charm_points',
    effectKind: 'percent_mana_damage_on_attack',
    tiers: [
      { tier: 1, cost: 600, activationChance: 0.05, value: 0.025 },
      { tier: 2, cost: 900, activationChance: 0.1, value: 0.025 },
      { tier: 3, cost: 3000, activationChance: 0.11, value: 0.025 },
    ],
  },
  parry: {
    id: 'parry',
    category: 'major',
    name: 'Parry',
    descriptionKey: 'charms.parry.description',
    currency: 'charm_points',
    effectKind: 'reflect_incoming_damage',
    tiers: [
      { tier: 1, cost: 400, activationChance: 0.05, value: 1 },
      { tier: 2, cost: 600, activationChance: 0.1, value: 1 },
      { tier: 3, cost: 2000, activationChance: 0.11, value: 1 },
    ],
  },
  poison: {
    id: 'poison',
    category: 'major',
    name: 'Poison',
    descriptionKey: 'charms.poison.description',
    currency: 'charm_points',
    effectKind: 'elemental_damage_on_attack',
    element: 'earth',
    tiers: [
      { tier: 1, cost: 240, activationChance: 0.05, value: 0.05 },
      { tier: 2, cost: 360, activationChance: 0.1, value: 0.05 },
      { tier: 3, cost: 1200, activationChance: 0.11, value: 0.05 },
    ],
  },
  savage_blow: {
    id: 'savage_blow',
    category: 'major',
    name: 'Savage Blow',
    descriptionKey: 'charms.savage_blow.description',
    currency: 'charm_points',
    effectKind: 'critical_damage_bonus',
    tiers: [
      { tier: 1, cost: 800, value: 0.2 },
      { tier: 2, cost: 1200, value: 0.4 },
      { tier: 3, cost: 4000, value: 0.44 },
    ],
  },
  wound: {
    id: 'wound',
    category: 'major',
    name: 'Wound',
    descriptionKey: 'charms.wound.description',
    currency: 'charm_points',
    effectKind: 'elemental_damage_on_attack',
    element: 'physical',
    tiers: [
      { tier: 1, cost: 240, activationChance: 0.05, value: 0.05 },
      { tier: 2, cost: 360, activationChance: 0.1, value: 0.05 },
      { tier: 3, cost: 1200, activationChance: 0.11, value: 0.05 },
    ],
  },
  zap: {
    id: 'zap',
    category: 'major',
    name: 'Zap',
    descriptionKey: 'charms.zap.description',
    currency: 'charm_points',
    effectKind: 'elemental_damage_on_attack',
    element: 'energy',
    tiers: [
      { tier: 1, cost: 320, activationChance: 0.05, value: 0.05 },
      { tier: 2, cost: 480, activationChance: 0.1, value: 0.05 },
      { tier: 3, cost: 1600, activationChance: 0.11, value: 0.05 },
    ],
  },
};

export const MINOR_CHARMS: Record<MinorCharmId, CharmDefinition> = {
  adrenaline_burst: {
    id: 'adrenaline_burst',
    category: 'minor',
    name: 'Adrenaline Burst',
    descriptionKey: 'charms.adrenaline_burst.description',
    currency: 'minor_charm_echoes',
    effectKind: 'movement_speed_on_hit_received',
    tiers: [
      { tier: 1, cost: 100, activationChance: 0.06, value: 1.5 },
      { tier: 2, cost: 150, activationChance: 0.09, value: 1.5 },
      { tier: 3, cost: 225, activationChance: 0.12, value: 1.5 },
    ],
  },
  bless: {
    id: 'bless',
    category: 'minor',
    name: 'Bless',
    descriptionKey: 'charms.bless.description',
    currency: 'minor_charm_echoes',
    effectKind: 'death_penalty_reduction',
    tiers: [
      { tier: 1, cost: 100, value: 0.06 },
      { tier: 2, cost: 150, value: 0.09 },
      { tier: 3, cost: 225, value: 0.12 },
    ],
  },
  cleanse: {
    id: 'cleanse',
    category: 'minor',
    name: 'Cleanse',
    descriptionKey: 'charms.cleanse.description',
    currency: 'minor_charm_echoes',
    effectKind: 'condition_cleanse_on_hit_received',
    tiers: [
      { tier: 1, cost: 100, activationChance: 0.06, value: 1 },
      { tier: 2, cost: 150, activationChance: 0.09, value: 1 },
      { tier: 3, cost: 225, activationChance: 0.12, value: 1 },
    ],
  },
  cripple: {
    id: 'cripple',
    category: 'minor',
    name: 'Cripple',
    descriptionKey: 'charms.cripple.description',
    currency: 'minor_charm_echoes',
    effectKind: 'paralyse_creature_on_attack',
    tiers: [
      { tier: 1, cost: 100, activationChance: 0.06, value: 10 },
      { tier: 2, cost: 150, activationChance: 0.09, value: 10 },
      { tier: 3, cost: 225, activationChance: 0.12, value: 10 },
    ],
  },
  gut: {
    id: 'gut',
    category: 'minor',
    name: 'Gut',
    descriptionKey: 'charms.gut.description',
    currency: 'minor_charm_echoes',
    effectKind: 'creature_product_bonus',
    tiers: [
      { tier: 1, cost: 100, value: 0.06 },
      { tier: 2, cost: 150, value: 0.09 },
      { tier: 3, cost: 225, value: 0.12 },
    ],
  },
  numb: {
    id: 'numb',
    category: 'minor',
    name: 'Numb',
    descriptionKey: 'charms.numb.description',
    currency: 'minor_charm_echoes',
    effectKind: 'paralyse_creature_on_hit_received',
    tiers: [
      { tier: 1, cost: 100, activationChance: 0.06, value: 10 },
      { tier: 2, cost: 150, activationChance: 0.09, value: 10 },
      { tier: 3, cost: 225, activationChance: 0.12, value: 10 },
    ],
  },
  scavenge: {
    id: 'scavenge',
    category: 'minor',
    name: 'Scavenge',
    descriptionKey: 'charms.scavenge.description',
    currency: 'minor_charm_echoes',
    effectKind: 'skinning_dusting_bonus',
    tiers: [
      { tier: 1, cost: 100, value: 0.6 },
      { tier: 2, cost: 150, value: 0.9 },
      { tier: 3, cost: 225, value: 1.2 },
    ],
  },
  fatal_hold: {
    id: 'fatal_hold',
    category: 'minor',
    name: 'Fatal Hold',
    descriptionKey: 'charms.fatal_hold.description',
    currency: 'minor_charm_echoes',
    effectKind: 'prevent_flee',
    tiers: [
      { tier: 1, cost: 100, activationChance: 0.3, value: 30 },
      { tier: 2, cost: 150, activationChance: 0.45, value: 30 },
      { tier: 3, cost: 225, activationChance: 0.6, value: 30 },
    ],
  },
  vampiric_embrace: {
    id: 'vampiric_embrace',
    category: 'minor',
    name: 'Vampiric Embrace',
    descriptionKey: 'charms.vampiric_embrace.description',
    currency: 'minor_charm_echoes',
    effectKind: 'life_leech_bonus',
    tiers: [
      { tier: 1, cost: 100, value: 0.016 },
      { tier: 2, cost: 150, value: 0.024 },
      { tier: 3, cost: 225, value: 0.032 },
    ],
  },
  void_inversion: {
    id: 'void_inversion',
    category: 'minor',
    name: 'Void Inversion',
    descriptionKey: 'charms.void_inversion.description',
    currency: 'minor_charm_echoes',
    effectKind: 'mana_drain_inversion',
    tiers: [
      { tier: 1, cost: 100, activationChance: 0.2, value: 1 },
      { tier: 2, cost: 150, activationChance: 0.3, value: 1 },
      { tier: 3, cost: 225, activationChance: 0.4, value: 1 },
    ],
  },
  voids_call: {
    id: 'voids_call',
    category: 'minor',
    name: "Void's Call",
    descriptionKey: 'charms.voids_call.description',
    currency: 'minor_charm_echoes',
    effectKind: 'mana_leech_bonus',
    tiers: [
      { tier: 1, cost: 100, value: 0.008 },
      { tier: 2, cost: 150, value: 0.012 },
      { tier: 3, cost: 225, value: 0.016 },
    ],
  },
};

export const ALL_CHARMS: Record<MajorCharmId | MinorCharmId, CharmDefinition> = {
  ...MAJOR_CHARMS,
  ...MINOR_CHARMS,
};

export const MAJOR_CHARM_LIST: CharmDefinition[] = Object.values(MAJOR_CHARMS);
export const MINOR_CHARM_LIST: CharmDefinition[] = Object.values(MINOR_CHARMS);
export const ALL_CHARM_LIST: CharmDefinition[] = [...MAJOR_CHARM_LIST, ...MINOR_CHARM_LIST];

export function getCharmDefinition(id: MajorCharmId | MinorCharmId): CharmDefinition {
  return ALL_CHARMS[id];
}

/**
 * What kind of value a Charm provides, decided once from what it structurally
 * *is* (its effectKind), never from comparing magnitudes across hunts. This
 * is what makes role assignment deterministic instead of arbitrary: a Dodge
 * is Defensive because dodging incoming damage is what Dodge does, not
 * because its damage-prevented number happened to outscore its damage number
 * in this particular hunt. Every `CharmEffectKind` must have an entry here -
 * adding a new charm with a new effectKind requires adding it to this table.
 */
export const EFFECT_KIND_TO_ROLE: Record<CharmEffectKind, CharmRole> = {
  // Deals damage directly, or amplifies damage you already deal.
  elemental_damage_on_attack: 'damage',
  aoe_damage_on_kill: 'damage',
  percent_hitpoints_damage_on_attack: 'damage',
  percent_mana_damage_on_attack: 'damage',
  critical_chance_bonus: 'damage',
  critical_damage_bonus: 'damage',
  // Reduces damage you take.
  dodge_incoming_damage: 'defensive',
  reflect_incoming_damage: 'defensive',
  // Restores or saves a supply resource (HP/mana) instead of dealing or preventing damage.
  life_leech_bonus: 'sustain',
  mana_leech_bonus: 'sustain',
  mana_drain_inversion: 'sustain',
  // Disables the creature or denies it an escape, rather than damaging or out-tanking it.
  paralyse_creature_on_attack: 'control',
  paralyse_creature_on_hit_received: 'control',
  prevent_flee: 'control',
  // Increases gold/items earned, not combat performance.
  creature_product_bonus: 'loot_utility',
  skinning_dusting_bonus: 'loot_utility',
  // Situational value that isn't damage, defence, sustain, control, or loot.
  movement_speed_on_hit_received: 'utility',
  condition_cleanse_on_hit_received: 'utility',
  death_penalty_reduction: 'utility',
};

/**
 * Fixed precedence used whenever charms of different roles must appear in
 * one list (e.g. ranking every unlocked Major Charm for a creature, or the
 * damage-first default view) - damage-first per
 * `docs/charm-mechanics-research.md`'s stated philosophy, then the other
 * always-applicable economic role, then the situational roles that only
 * matter when this hunt's concrete data backs them. Within a role, ranking
 * is still purely by that role's own real metric - this only fixes the
 * *group* order, never blends across units.
 */
export const ROLE_PRIORITY: CharmRole[] = ['damage', 'loot_utility', 'defensive', 'sustain', 'control', 'utility', 'budget_damage'];
