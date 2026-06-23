import { describe, expect, it } from 'vitest';
import { SAMPLE_HUNT_ANALYSER_TEXT } from '@/data/sampleHuntAnalyser';
import { optimiseHuntFromText } from '@/lib/optimiseCharms';
import { buildComparisonRows, DEFAULT_CUSTOM_WEIGHTS, isMeaningfulRecommendation } from '@/lib/recommendationViews';
import { DEFAULT_CHARACTER_INPUT } from '@/types/character';

function sampleRecommendations() {
  const summary = optimiseHuntFromText(
    { ...DEFAULT_CHARACTER_INPUT, unlockedMajorCharms: [], unlockedMinorCharms: [] },
    SAMPLE_HUNT_ANALYSER_TEXT,
  );
  return summary.creatureResults.flatMap((result) => [...result.rankedMajorCharms, ...result.rankedMinorCharms]);
}

describe('recommendation comparison views', () => {
  it('builds a damage-first shortlist without meaningless zero rows', () => {
    const rows = buildComparisonRows(sampleRecommendations(), 'damage_first', [], DEFAULT_CUSTOM_WEIGHTS, 5);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(5);
    expect(rows.every((row) => isMeaningfulRecommendation(row.recommendation))).toBe(true);
    expect(rows[0]?.mainGain).toBeGreaterThan(0);
  });

  it('keeps manual comparison empty until the user selects charms', () => {
    const rows = buildComparisonRows(sampleRecommendations(), 'manual', [], DEFAULT_CUSTOM_WEIGHTS, 5);

    expect(rows).toEqual([]);
  });

  it('filters comparison rows to the selected charm ids only', () => {
    const rows = buildComparisonRows(sampleRecommendations(), 'damage_first', ['savage_blow'], DEFAULT_CUSTOM_WEIGHTS, 20);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.recommendation.charmId === 'savage_blow')).toBe(true);
  });
});
