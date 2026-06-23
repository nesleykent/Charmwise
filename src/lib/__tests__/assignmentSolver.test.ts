import { describe, expect, it } from 'vitest';
import { solveAssignment } from '@/lib/assignmentSolver';

describe('solveAssignment', () => {
  it('gives each creature its own best item when there is no conflict', () => {
    // Creature 0 likes item 0 best, creature 1 likes item 1 best - no contention.
    const scores = [
      [10, 1],
      [1, 10],
    ];
    const result = solveAssignment(scores);
    expect(result.assignedItem).toEqual([0, 1]);
    expect(result.totalScore).toBe(20);
  });

  it('does not assign the same item to two creatures, even when both rank it best independently', () => {
    // Both creatures would independently pick item 0 - the bug this solver
    // exists to fix. The optimal global assignment gives item 0 to whichever
    // creature values it less and item 1 to the other if that is better
    // overall, or leaves the second creature unassigned if item 1 is bad for
    // everyone.
    const scores = [
      [100, 1],
      [90, 1],
    ];
    const result = solveAssignment(scores);
    // Total must reflect a *valid* assignment (each item used at most once).
    const usedItems = result.assignedItem.filter((i) => i !== null);
    expect(new Set(usedItems).size).toBe(usedItems.length);
    // Optimal total: creature 0 gets item 0 (100), creature 1 gets item 1 (1) = 101,
    // beats giving item 0 to creature 1 instead (90) + creature 0 gets item 1 (1) = 91.
    expect(result.assignedItem).toEqual([0, 1]);
    expect(result.totalScore).toBe(101);
  });

  it('picks the globally optimal swap even when it looks locally worse for one creature', () => {
    // Creature 0 alone would prefer item 0 (50) over item 1 (40).
    // Creature 1 can ONLY use item 0 (item 1 is worthless to it).
    // Globally optimal: creature 1 takes item 0 (90), creature 0 takes item 1 (40) = 130,
    // beating creature 0 keeping item 0 (50) and creature 1 getting nothing = 50.
    const scores = [
      [50, 40],
      [90, 0],
    ];
    const result = solveAssignment(scores);
    expect(result.assignedItem).toEqual([1, 0]);
    expect(result.totalScore).toBe(130);
  });

  it('respects a cap on the total number of assignments', () => {
    // Three creatures, three good items, but only 1 slot available - only the
    // single best (creature, item) pair across the whole matrix should be used.
    const scores = [
      [10, 1, 1],
      [1, 20, 1],
      [1, 1, 30],
    ];
    const result = solveAssignment(scores, 1);
    const assignedCount = result.assignedItem.filter((i) => i !== null).length;
    expect(assignedCount).toBe(1);
    expect(result.totalScore).toBe(30);
    expect(result.assignedItem[2]).toBe(2);
  });

  it('leaves extra creatures unassigned when there are more creatures than items', () => {
    const scores = [[5], [3], [8]];
    const result = solveAssignment(scores);
    const assignedCount = result.assignedItem.filter((i) => i !== null).length;
    expect(assignedCount).toBe(1);
    expect(result.assignedItem[2]).toBe(0); // the single item goes to whoever values it most
    expect(result.totalScore).toBe(8);
  });

  it('leaves extra items unused when there are more items than creatures', () => {
    const scores = [[5, 9, 1]];
    const result = solveAssignment(scores);
    expect(result.assignedItem).toEqual([1]);
    expect(result.totalScore).toBe(9);
  });

  it('never assigns a zero-value item when leaving it unassigned scores the same', () => {
    const scores = [[0, 0]];
    const result = solveAssignment(scores);
    expect(result.assignedItem).toEqual([null]);
    expect(result.totalScore).toBe(0);
  });

  it('handles no creatures or no items without crashing', () => {
    expect(solveAssignment([])).toEqual({ assignedItem: [], totalScore: 0 });
    expect(solveAssignment([[]])).toEqual({ assignedItem: [null], totalScore: 0 });
  });

  it('handles a cap of zero by assigning nothing', () => {
    const result = solveAssignment([[100], [200]], 0);
    expect(result.assignedItem).toEqual([null, null]);
    expect(result.totalScore).toBe(0);
  });
});
