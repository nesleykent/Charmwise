import { describe, expect, it } from 'vitest';
import { EFFECT_KIND_TO_ROLE, ROLE_PRIORITY, getCharmDefinition } from '@/data/charms';
import { SAMPLE_HUNT_ANALYSER_TEXT } from '@/data/sampleHuntAnalyser';
import { optimiseHuntFromText } from '@/lib/optimiseCharms';
import { buildComparisonRows, isMeaningfulRecommendation, VIEW_TO_ROLE } from '@/lib/recommendationViews';
import { DEFAULT_CHARACTER_INPUT } from '@/types/character';

function sampleRecommendations() {
  const summary = optimiseHuntFromText(
    { ...DEFAULT_CHARACTER_INPUT, unlockedMajorCharms: [], unlockedMinorCharms: [] },
    SAMPLE_HUNT_ANALYSER_TEXT,
  );
  return summary.creatureResults.flatMap((result) => [...result.rankedMajorCharms, ...result.rankedMinorCharms]);
}

describe('EFFECT_KIND_TO_ROLE', () => {
  it('is a deterministic, charm-identity lookup - never derived from a hunt\'s magnitudes', () => {
    // Spot-check a representative charm per role, independent of any computed effect.
    expect(EFFECT_KIND_TO_ROLE[getCharmDefinition('wound').effectKind]).toBe('damage');
    expect(EFFECT_KIND_TO_ROLE[getCharmDefinition('low_blow').effectKind]).toBe('damage');
    expect(EFFECT_KIND_TO_ROLE[getCharmDefinition('dodge').effectKind]).toBe('defensive');
    expect(EFFECT_KIND_TO_ROLE[getCharmDefinition('parry').effectKind]).toBe('defensive');
    expect(EFFECT_KIND_TO_ROLE[getCharmDefinition('vampiric_embrace').effectKind]).toBe('sustain');
    expect(EFFECT_KIND_TO_ROLE[getCharmDefinition('cripple').effectKind]).toBe('control');
    expect(EFFECT_KIND_TO_ROLE[getCharmDefinition('gut').effectKind]).toBe('loot_utility');
    expect(EFFECT_KIND_TO_ROLE[getCharmDefinition('bless').effectKind]).toBe('utility');
  });

  it('every CharmRole used by VIEW_TO_ROLE is a real, assignable role (never budget_damage, a view-only concept)', () => {
    expect(Object.values(VIEW_TO_ROLE)).not.toContain('budget_damage');
  });

  it('ROLE_PRIORITY is damage-first and covers every role VIEW_TO_ROLE can produce', () => {
    expect(ROLE_PRIORITY[0]).toBe('damage');
    for (const role of Object.values(VIEW_TO_ROLE)) {
      expect(ROLE_PRIORITY).toContain(role);
    }
  });
});

describe('recommendation comparison views', () => {
  it('builds a damage-first shortlist without meaningless zero rows', () => {
    const rows = buildComparisonRows(sampleRecommendations(), 'damage_first', [], 5);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(5);
    expect(rows.every((row) => isMeaningfulRecommendation(row.recommendation))).toBe(true);
    expect(rows[0]?.mainGain).toBeGreaterThan(0);
  });

  it('keeps manual comparison empty until the user selects charms', () => {
    const rows = buildComparisonRows(sampleRecommendations(), 'manual', [], 5);

    expect(rows).toEqual([]);
  });

  it('filters comparison rows to the selected charm ids only', () => {
    const rows = buildComparisonRows(sampleRecommendations(), 'damage_first', ['savage_blow'], 20);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.recommendation.charmId === 'savage_blow')).toBe(true);
  });

  it('role-pinned views (e.g. damage) only ever return that role\'s charms - never a cross-unit mix', () => {
    const rows = buildComparisonRows(sampleRecommendations(), 'damage', [], 20);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.role === 'damage')).toBe(true);
  });

  it('the cross-role default groups by ROLE_PRIORITY first, never interleaving roles', () => {
    const rows = buildComparisonRows(sampleRecommendations(), 'damage_first', [], 20);
    const seenRoles: string[] = [];
    for (const row of rows) {
      if (seenRoles[seenRoles.length - 1] !== row.role) seenRoles.push(row.role);
    }
    // Each role can only appear as one contiguous run - if a role reappears
    // after another role started, roles were interleaved instead of grouped.
    expect(new Set(seenRoles).size).toBe(seenRoles.length);
  });
});
