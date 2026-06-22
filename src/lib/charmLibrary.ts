// Hunt-independent "which creatures is this Charm actually good against"
// rankings for the Charm Library. Deliberately separate from
// charmScoring.ts: that module needs a parsed hunt session to produce an
// hourly expected value, but a library entry should be useful before you've
// pasted anything. Where the Bestiary genuinely has no signal for a charm
// (Gut/Scavenge - no creature in the source has product/skinning data; Low
// Blow/Savage Blow - scale with your own damage, not target resistance;
// Dodge/Parry - scale with incoming damage, which isn't a Bestiary field)
// this says so instead of fabricating a ranking.
import { getBestiaryEntries, normaliseResistances } from '@/lib/normaliseMonster';
import type { CharmDefinition, LocalisedMessage } from '@/types/charm';
import type { RawBestiaryEntry } from '@/types/monster';

export interface CreatureSuitabilityEntry {
  name: string;
  detail: string;
}

export interface CharmSuitability {
  rankable: boolean;
  unrankableReason?: LocalisedMessage;
  best: CreatureSuitabilityEntry[];
  worst: CreatureSuitabilityEntry[];
}

const TOP_N = 6;

function topAndBottom(
  entries: RawBestiaryEntry[],
  scoreFn: (entry: RawBestiaryEntry) => number | null,
  detailFn: (score: number) => string,
): { best: CreatureSuitabilityEntry[]; worst: CreatureSuitabilityEntry[] } {
  const scored = entries
    .map((entry) => ({ entry, score: scoreFn(entry) }))
    .filter((x): x is { entry: RawBestiaryEntry; score: number } => x.score !== null);
  scored.sort((a, b) => b.score - a.score);

  const best = scored.slice(0, TOP_N).map((x) => ({ name: x.entry.name, detail: detailFn(x.score) }));
  const worst = scored
    .slice(-TOP_N)
    .reverse()
    .map((x) => ({ name: x.entry.name, detail: detailFn(x.score) }));
  return { best, worst };
}

function unrankable(reasonCode: string): CharmSuitability {
  return { rankable: false, unrankableReason: { code: reasonCode }, best: [], worst: [] };
}

export function getCharmSuitability(charm: CharmDefinition, entries: RawBestiaryEntry[] = getBestiaryEntries()): CharmSuitability {
  switch (charm.effectKind) {
    case 'elemental_damage_on_attack':
    case 'aoe_damage_on_kill': {
      const element = charm.element ?? 'physical';
      const { best, worst } = topAndBottom(
        entries,
        (e) => normaliseResistances(e.resistances)?.[element] ?? null,
        (score) => `${Math.round(score * 100)}% ${element}`,
      );
      return best.length > 0 ? { rankable: true, best, worst } : unrankable('suitability_no_resistance_data');
    }

    case 'percent_hitpoints_damage_on_attack':
    case 'percent_mana_damage_on_attack': {
      const { best, worst } = topAndBottom(
        entries,
        (e) => (typeof e.hitpoints === 'number' ? e.hitpoints : null),
        (score) => `${score.toLocaleString('en-GB')} HP`,
      );
      return best.length > 0 ? { rankable: true, best, worst } : unrankable('suitability_no_hitpoints_data');
    }

    case 'critical_chance_bonus':
    case 'critical_damage_bonus':
      return unrankable('suitability_scales_with_own_damage');

    case 'dodge_incoming_damage':
    case 'reflect_incoming_damage':
      return unrankable('suitability_scales_with_incoming_damage');

    case 'creature_product_bonus':
    case 'skinning_dusting_bonus':
      return unrankable('suitability_no_product_data');

    default:
      return unrankable('suitability_not_creature_specific');
  }
}
