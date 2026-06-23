// Exact solver for the assignment problem: a specific unlocked Charm can
// only be actively assigned to one creature at a time in Tibia (confirmed -
// see README), so picking the "best charm" independently per creature (the
// old approach) can recommend the same charm for two different creatures at
// once, which is impossible in the game. This finds the assignment of items
// (charms) to creatures that maximises total score, with each creature
// getting at most one item, each item going to at most one creature, and
// optionally a cap on the total number of assignments made (the Major Charm
// slot limit).
//
// Implementation: bitmask DP over the item axis. Exact, not a heuristic -
// safe because the item axis here is always small (at most 14 Major or 11
// Minor Charms), so 2^14 states is cheap even multiplied by dozens of
// creatures and items.
export interface AssignmentResult {
  /** assignedItem[creatureIndex] = itemIndex, or null if that creature gets nothing. */
  assignedItem: (number | null)[];
  totalScore: number;
}

function countSetBits(mask: number): number {
  let count = 0;
  let m = mask;
  while (m > 0) {
    count += m & 1;
    m >>= 1;
  }
  return count;
}

/**
 * `scores[creatureIndex][itemIndex]` is the value of assigning that item to
 * that creature. `maxAssignments` caps the total number of creatures that
 * may receive a (non-null) item; omit for no cap beyond the natural
 * one-item-per-creature limit.
 */
export function solveAssignment(scores: number[][], maxAssignments?: number): AssignmentResult {
  const numCreatures = scores.length;
  const numItems = numCreatures > 0 ? scores[0]!.length : 0;

  if (numCreatures === 0 || numItems === 0) {
    return { assignedItem: new Array(numCreatures).fill(null), totalScore: 0 };
  }

  const cap = maxAssignments ?? numItems;
  const numMasks = 1 << numItems;

  // dp[mask] = best total score achievable using exactly the items in
  // `mask` (each assigned to a distinct creature among those processed so
  // far), or -Infinity if `mask` isn't reachable yet.
  let dp = new Float64Array(numMasks).fill(-Infinity);
  dp[0] = 0;

  // choice[creatureIndex][mask] = the item that creature picked on the step
  // that produced the winning value for `mask`, or -1 if it picked nothing.
  const choice: Int16Array[] = [];

  for (let creature = 0; creature < numCreatures; creature++) {
    const row = scores[creature]!;
    const newDp = dp.slice(); // default: this creature picks nothing
    const rowChoice = new Int16Array(numMasks).fill(-1);

    for (let mask = 0; mask < numMasks; mask++) {
      const base = dp[mask]!;
      if (base === -Infinity) continue;
      if (countSetBits(mask) >= cap) continue; // at the assignment cap, can't pick up another item

      for (let item = 0; item < numItems; item++) {
        if (mask & (1 << item)) continue; // item already used by an earlier creature
        const newMask = mask | (1 << item);
        const candidate = base + row[item]!;
        if (candidate > newDp[newMask]!) {
          newDp[newMask] = candidate;
          rowChoice[newMask] = item;
        }
      }
    }

    dp = newDp;
    choice.push(rowChoice);
  }

  let bestMask = 0;
  let bestScore = dp[0]!;
  for (let mask = 1; mask < numMasks; mask++) {
    if (dp[mask]! > bestScore) {
      bestScore = dp[mask]!;
      bestMask = mask;
    }
  }

  const assignedItem: (number | null)[] = new Array(numCreatures).fill(null);
  let mask = bestMask;
  for (let creature = numCreatures - 1; creature >= 0; creature--) {
    const item = choice[creature]![mask]!;
    if (item >= 0) {
      assignedItem[creature] = item;
      mask &= ~(1 << item);
    }
  }

  return { assignedItem, totalScore: bestScore === -Infinity ? 0 : bestScore };
}
