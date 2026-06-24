import { ROLE_PRIORITY, getCharmDefinition } from '@/data/charms';
import { formatNumber, formatScore } from '@/lib/format';
import type { CharmId, CharmRecommendation, CharmRole, OptimisationMode, RecommendationView } from '@/types/charm';
import type { Dictionary } from '@/types/i18n';

export const PRIMARY_RECOMMENDATION_VIEWS: RecommendationView[] = [
  'damage_first',
  'damage',
  'budget_damage',
  'defensive',
  'sustain',
  'control',
  'manual',
];

/** Views that pin the comparison to one role. Absent => cross-role default (fixed role-priority order, see ROLE_PRIORITY). Exported so the UI can apply the same view->role mapping when reading the already assignment-solved `bestMajorCharmByRole`/`bestMinorCharmByRole` instead of re-ranking. */
export const VIEW_TO_ROLE: Partial<Record<OptimisationMode, CharmRole>> = {
  damage: 'damage',
  budget_damage: 'damage',
  defensive: 'defensive',
  sustain: 'sustain',
  control: 'control',
};

const MEANINGFUL_RAW_VALUE = 0.5;
const MEANINGFUL_UTILITY_VALUE = 0.001;
const SAME_RANK_THRESHOLD = 0.01;
const EFFECTIVE_TIE_THRESHOLD = 0.03;

export interface ComparisonRow {
  recommendation: CharmRecommendation;
  role: CharmRole;
  /** The recommendation's own roleMetric - the real, unweighted per-hour (or magnitude) number for its role. Never divided or blended for display; budget_damage only changes sort order, via `efficiency`. */
  mainGain: number;
  efficiency: number | null;
  cost: number;
  tieState: 'same_rank' | 'effectively_tied' | null;
  reasonKey: string;
}

function costToReachRecommendationTier(rec: CharmRecommendation): number {
  const charm = getCharmDefinition(rec.charmId);
  return charm.tiers.slice(0, rec.tier).reduce((sum, tier) => sum + tier.cost, 0);
}

/** Localised display name for a role - shared by every UI surface that shows one, so "Defensive" etc. is spelled consistently everywhere. */
export function roleLabel(role: CharmRole, t: Dictionary): string {
  return t.results.roles[role] ?? role;
}

/** Which real unit a role's gain is shown in - control without concrete prevented-damage data falls back to the Utility label, since its only nonzero field at that point is utilityMagnitude (see roleMetricFor in charmScoring.ts). */
export function primaryGainLabel(role: CharmRole, preventedPerHour: number, t: Dictionary): string {
  switch (role) {
    case 'defensive':
      return t.results.metrics.expectedDamagePreventedPerHour;
    case 'sustain':
      return t.results.metrics.expectedHealingSavedPerHour;
    case 'control':
      return preventedPerHour > 0.5 ? t.results.metrics.expectedDamagePreventedPerHour : roleLabel('utility', t);
    case 'loot_utility':
      return t.results.metrics.expectedProfitPerHour;
    case 'utility':
      return roleLabel('utility', t);
    case 'budget_damage':
    case 'damage':
    default:
      return t.results.metrics.expectedDamagePerHour;
  }
}

/** Utility/low-control gains are small 0-1ish magnitudes (formatScore's one-decimal form fits better); every other role is a real per-hour quantity (formatNumber's locale-grouped integer form). */
export function formatGain(role: CharmRole, gain: number, preventedPerHour: number, locale: string): string {
  if (role === 'utility' || (role === 'control' && preventedPerHour <= 0.5)) return formatScore(gain);
  return formatNumber(gain, locale);
}

export function sustainGain(rec: CharmRecommendation): number {
  return rec.effect.expectedHealingGainPerHour + rec.effect.expectedManaGainPerHour + rec.effect.expectedManaSavedPerHour;
}

export function isMeaningfulRecommendation(rec: CharmRecommendation): boolean {
  const e = rec.effect;
  return (
    e.expectedDamagePerHour > MEANINGFUL_RAW_VALUE ||
    e.expectedProfitPerHour > MEANINGFUL_RAW_VALUE ||
    e.expectedDamagePreventedPerHour > MEANINGFUL_RAW_VALUE ||
    sustainGain(rec) > MEANINGFUL_RAW_VALUE ||
    e.utilityMagnitude > MEANINGFUL_UTILITY_VALUE
  );
}

function reasonKeyForRecommendation(rec: CharmRecommendation): string {
  if (rec.role === 'defensive') return 'defensive_need';
  if (rec.role === 'sustain') return 'sustain_need';
  if (rec.role === 'control') return 'control_need';
  if (rec.role === 'loot_utility') return 'loot_utility';
  if (!rec.unlocked) return 'unlock_candidate';
  if (rec.calculation.killShare >= 0.4) return 'creature_share';
  return 'damage_gain';
}

/**
 * Orders rows within `buildComparisonRows`. When `roleFilter` is set every
 * row already shares one role (same real unit), so it's a plain descending
 * sort on `mainGain` - cost-divided for `budget_damage`, since "cheapest
 * good damage" is that view's whole point, still the same unit ratio rather
 * than a blend. Without a filter (the cross-role default/manual views), the
 * fixed `ROLE_PRIORITY` group order comes first - the only thing that's
 * ever "decided" across roles - and `mainGain` only breaks ties *within*
 * the same role.
 */
function compareRows(
  a: { recommendation: CharmRecommendation; role: CharmRole; mainGain: number; cost: number },
  b: { recommendation: CharmRecommendation; role: CharmRole; mainGain: number; cost: number },
  view: OptimisationMode,
  roleFilter: CharmRole | undefined,
): number {
  if (roleFilter) {
    const aKey = view === 'budget_damage' && a.cost > 0 ? a.mainGain / a.cost : a.mainGain;
    const bKey = view === 'budget_damage' && b.cost > 0 ? b.mainGain / b.cost : b.mainGain;
    return bKey - aKey || a.cost - b.cost || a.recommendation.charmId.localeCompare(b.recommendation.charmId);
  }
  const priorityDiff = ROLE_PRIORITY.indexOf(a.role) - ROLE_PRIORITY.indexOf(b.role);
  if (priorityDiff !== 0) return priorityDiff;
  return b.mainGain - a.mainGain || a.cost - b.cost || a.recommendation.charmId.localeCompare(b.recommendation.charmId);
}

export function buildComparisonRows(
  recommendations: CharmRecommendation[],
  view: OptimisationMode,
  selectedCharmIds: CharmId[],
  limit = 8,
): ComparisonRow[] {
  const selected = new Set(selectedCharmIds);
  const manualSelectionActive = selected.size > 0 || view === 'manual';
  const candidates = recommendations
    .filter(isMeaningfulRecommendation)
    .filter((rec) => (manualSelectionActive ? selected.has(rec.charmId) : true));

  const roleFilter = VIEW_TO_ROLE[view];
  const filtered = roleFilter ? candidates.filter((rec) => rec.role === roleFilter) : candidates;

  const rows = filtered
    .map((recommendation) => {
      const cost = costToReachRecommendationTier(recommendation);
      return {
        recommendation,
        role: recommendation.role,
        mainGain: recommendation.roleMetric,
        efficiency: cost > 0 ? recommendation.roleMetric / cost : null,
        cost,
        tieState: null as 'same_rank' | 'effectively_tied' | null,
        reasonKey: reasonKeyForRecommendation(recommendation),
      };
    })
    .filter((row) => row.mainGain > 0)
    .sort((a, b) => compareRows(a, b, view, roleFilter));

  const limited = rows.slice(0, manualSelectionActive ? rows.length : limit);

  // Tie detection only ever compares rows against their own role's leader -
  // "effectively tied" means interchangeable, which is only meaningful
  // between values in the same real unit. In the cross-role default view
  // this means a Defensive charm's tie state is judged against the best
  // Defensive charm shown, never against the top Damage charm's number.
  const roleLeaderGain = new Map<CharmRole, number>();
  return limited.map((row) => {
    const leaderGain = roleLeaderGain.get(row.role);
    if (leaderGain === undefined) {
      roleLeaderGain.set(row.role, row.mainGain);
      return row;
    }
    if (leaderGain <= 0) return row;
    const gap = (leaderGain - row.mainGain) / leaderGain;
    return { ...row, tieState: gap < SAME_RANK_THRESHOLD ? 'same_rank' : gap < EFFECTIVE_TIE_THRESHOLD ? 'effectively_tied' : null };
  });
}

export function defaultSelectedCharmIds(recommendations: CharmRecommendation[], view: OptimisationMode): CharmId[] {
  const seen = new Set<CharmId>();
  const rows = buildComparisonRows(recommendations, view, [], 5);
  for (const row of rows) seen.add(row.recommendation.charmId);
  return [...seen];
}
