import { describe, expect, it } from 'vitest';
import { SAMPLE_HUNT_ANALYSER_TEXT } from '@/data/sampleHuntAnalyser';
import { parseHuntAnalyser } from '@/lib/parseHuntAnalyser';

describe('parseHuntAnalyser', () => {
  it('parses session totals from the sample session', () => {
    const result = parseHuntAnalyser(SAMPLE_HUNT_ANALYSER_TEXT);

    expect(result.isValid).toBe(true);
    expect(result.totals.rawXpGain).toBe(2_384_014);
    expect(result.totals.xpGain).toBe(3_576_018);
    expect(result.totals.rawXpPerHour).toBe(3_309_339);
    expect(result.totals.xpPerHour).toBe(4_964_004);
    expect(result.totals.loot).toBe(744_885);
    expect(result.totals.supplies).toBe(111_246);
    expect(result.totals.balance).toBe(633_639);
    expect(result.totals.damage).toBe(2_574_617);
    expect(result.totals.damagePerHour).toBe(3_606_129);
    expect(result.totals.healing).toBe(247_093);
    expect(result.totals.healingPerHour).toBe(346_090);
    expect(result.totals.sessionDurationHours).toBeCloseTo(43 / 60, 5);
  });

  it('parses session start/end timestamps', () => {
    const result = parseHuntAnalyser(SAMPLE_HUNT_ANALYSER_TEXT);
    // The pasted text has no timezone marker, so it is parsed (and asserted
    // here) as local time - using local getters keeps this test stable
    // regardless of which timezone it runs in.
    const start = result.totals.sessionStart!;
    expect(`${start.getFullYear()}-${start.getMonth() + 1}-${start.getDate()}`).toBe('2026-6-20');
    expect(result.totals.sessionEnd).not.toBeNull();
    expect(result.totals.sessionEnd!.getTime()).toBeGreaterThan(result.totals.sessionStart!.getTime());
  });

  it('extracts killed monsters with kill share and rates', () => {
    const result = parseHuntAnalyser(SAMPLE_HUNT_ANALYSER_TEXT);

    expect(result.killedMonsters).toHaveLength(2);
    const crusader = result.killedMonsters.find((m) => m.monsterName === 'crusader');
    const headwalker = result.killedMonsters.find((m) => m.monsterName === 'headwalker');

    expect(crusader?.kills).toBe(440);
    expect(headwalker?.kills).toBe(414);

    const totalShare = result.killedMonsters.reduce((sum, m) => sum + m.killShare, 0);
    expect(totalShare).toBeCloseTo(1, 10);

    expect(crusader?.killsPerHour).toBeCloseTo(440 / (43 / 60), 5);
    expect(crusader?.estimatedDamagePerKill).toBeCloseTo(2_574_617 / 854, 5);
  });

  it('preserves duplicate looted item lines instead of merging them', () => {
    const result = parseHuntAnalyser(SAMPLE_HUNT_ANALYSER_TEXT);
    const pearlLines = result.lootedItems.filter((i) => i.name === 'a giant shimmering pearl');
    expect(pearlLines).toHaveLength(2);
    expect(pearlLines.map((p) => p.quantity).sort()).toEqual([12, 16]);
    expect(result.lootedItems).toHaveLength(13);
  });

  it('flags an empty session as invalid with a warning', () => {
    const result = parseHuntAnalyser('');
    expect(result.isValid).toBe(false);
    expect(result.killedMonsters).toHaveLength(0);
    expect(result.warnings.some((w) => w.code === 'no_killed_monsters')).toBe(true);
  });

  it('still parses kills when the session header is missing', () => {
    const result = parseHuntAnalyser('Killed Monsters:\n  10x rat');
    expect(result.isValid).toBe(true);
    expect(result.killedMonsters).toEqual([
      expect.objectContaining({ monsterName: 'rat', kills: 10 }),
    ]);
    expect(result.warnings.some((w) => w.code === 'no_session_header')).toBe(true);
  });

  it('falls back to deriving duration from timestamps when "Session:" is malformed', () => {
    const text = [
      'Session data: From 2026-01-01, 10:00:00 to 2026-01-01, 12:00:00',
      'Killed Monsters:',
      '  5x rat',
    ].join('\n');
    const result = parseHuntAnalyser(text);
    expect(result.totals.sessionDurationHours).toBeCloseTo(2, 5);
  });

  it('merges duplicate monster lines for the same species', () => {
    const text = 'Killed Monsters:\n  5x rat\n  3x Rat';
    const result = parseHuntAnalyser(text);
    expect(result.killedMonsters).toHaveLength(1);
    expect(result.killedMonsters[0]?.kills).toBe(8);
  });

  it('parses a negative balance', () => {
    const text = 'Balance: -111,246\nKilled Monsters:\n  1x rat';
    const result = parseHuntAnalyser(text);
    expect(result.totals.balance).toBe(-111_246);
  });
});
