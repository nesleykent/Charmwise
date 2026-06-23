// Guards src/data/charms.ts against drift from the authoritative charms.json
// export. The JSON's `stages[].value` is the tier's activation chance for
// proc-based charms (e.g. Carnage: 10/20/22%) or the flat bonus itself for
// always-active charms (e.g. Low Blow: 4/8/9% crit chance) - which one
// applies is determined by whether charms.ts defines `activationChance` for
// that charm. Fixed magnitudes embedded only in the JSON's prose `effect`
// text (e.g. Carnage's "15% of its maximum health") aren't cross-checked
// here, since they're not exposed as structured data.
import { describe, expect, it } from 'vitest';
import { ALL_CHARM_LIST } from '@/data/charms';
import charmsJson from '@/data/charms.json';

interface JsonStage {
  cost: number;
  value: number;
}
interface JsonCharmEntry {
  id: number;
  name: string;
  type: 'Major' | 'Minor';
  stages: JsonStage[];
}

const jsonEntries = (charmsJson as { data: JsonCharmEntry[] }).data;

function findJsonEntry(name: string): JsonCharmEntry {
  const entry = jsonEntries.find((e) => e.name === name);
  if (!entry) throw new Error(`No charms.json entry named "${name}"`);
  return entry;
}

describe('charms.json cross-check', () => {
  it('has exactly one JSON entry per charm definition, matched by name', () => {
    expect(jsonEntries).toHaveLength(ALL_CHARM_LIST.length);
    for (const charm of ALL_CHARM_LIST) {
      expect(() => findJsonEntry(charm.name), charm.name).not.toThrow();
    }
  });

  it('matches category (Major/Minor)', () => {
    for (const charm of ALL_CHARM_LIST) {
      expect(findJsonEntry(charm.name).type.toLowerCase(), charm.name).toBe(charm.category);
    }
  });

  it('matches every tier cost exactly', () => {
    for (const charm of ALL_CHARM_LIST) {
      const jsonEntry = findJsonEntry(charm.name);
      charm.tiers.forEach((tier, i) => {
        expect(tier.cost, `${charm.name} tier ${i + 1} cost`).toBe(jsonEntry.stages[i]!.cost);
      });
    }
  });

  it('matches every tier activation chance (or flat bonus value) exactly', () => {
    for (const charm of ALL_CHARM_LIST) {
      const jsonEntry = findJsonEntry(charm.name);
      charm.tiers.forEach((tier, i) => {
        const jsonValue = jsonEntry.stages[i]!.value;
        const ourValue = (tier.activationChance ?? tier.value) * 100;
        expect(ourValue, `${charm.name} tier ${i + 1} value`).toBeCloseTo(jsonValue, 6);
      });
    }
  });
});
