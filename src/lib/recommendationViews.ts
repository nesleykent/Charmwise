import { getCharmDefinition } from '@/data/charms';
import type { CharmId, CharmRecommendation, CharmRole, OptimisationMode, RecommendationView, ScoreWeights } from '@/types/charm';

export const PRIMARY_RECOMMENDATION_VIEWS: RecommendationView[] = [
  'damage_first',
  'damage',
  'budget_damage',
  'defensive',
  'sustain',
  'control',
  'manual',
  'custom',
];

export const DEFAULT_CUSTOM_WEIGHTS: ScoreWeights = {
  damage: 0.7,
  xp: 0,
  profit: 0.05,
  safety: 0.1,
  supplySaving: 0.1,
  utility: 0.05,
};

const MEANINGFUL_RAW_VALUE = 0.5;
const MEANINGFUL_UTILITY_VALUE = 0.001;
const SAME_RANK_THRESHOLD = 0.01;
const EFFECTIVE_TIE_THRESHOLD = 0.03;

export interface ComparisonRow {
  recommendation: CharmRecommendation;
  role: CharmRole;
  score: number;
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

export function recommendationRole(rec: CharmRecommendation): CharmRole {
  const e = rec.effect;
  const sustain = sustainGain(rec);
  const damage = e.expectedDamagePerHour;
  const prevented = e.expectedDamagePreventedPerHour;
  const profitOnly = e.expectedProfitPerHour > MEANINGFUL_RAW_VALUE && damage <= MEANINGFUL_RAW_VALUE;

  if (rec.calculation.effectKind === 'paralyse_creature_on_attack' || rec.calculation.effectKind === 'paralyse_creature_on_hit_received' || rec.calculation.effectKind === 'prevent_flee') {
    return 'control';
  }
  if (profitOnly) return 'loot_utility';
  if (prevented > Math.max(damage, sustain, e.utilityMagnitude * 1000)) return 'defensive';
  if (sustain > Math.max(damage, prevented)) return 'sustain';
  if (rec.charmId === 'low_blow' || rec.charmId === 'savage_blow') return 'damage';
  return damage > MEANINGFUL_RAW_VALUE ? 'damage' : 'utility';
}

function customWeightedScore(rec: CharmRecommendation, customWeights: ScoreWeights): number {
  const scores = rec.scores;
  const raw =
    scores.damageScore * customWeights.damage +
    scores.xpScore * customWeights.xp +
    scores.profitScore * customWeights.profit +
    scores.safetyScore * customWeights.safety +
    scores.supplySavingScore * customWeights.supplySaving +
    scores.utilityScore * customWeights.utility;
  return raw * scores.confidenceMultiplier;
}

export function scoreRecommendationForView(rec: CharmRecommendation, view: OptimisationMode, customWeights: ScoreWeights = DEFAULT_CUSTOM_WEIGHTS): number {
  const e = rec.effect;
  const confidence = rec.scores.confidenceMultiplier;
  const damage = e.expectedDamagePerHour;
  const prevented = e.expectedDamagePreventedPerHour;
  const sustain = sustainGain(rec);
  const cost = Math.max(1, costToReachRecommendationTier(rec));
  const densityMultiplier = 0.9 + Math.min(0.2, rec.calculation.killShare * 0.2);

  switch (view) {
    case 'damage':
      return damage * confidence;
    case 'budget_damage':
      return (damage / cost) * confidence * 1000;
    case 'defensive':
      return (prevented + sustain * 0.15 + damage * 0.1) * confidence * densityMultiplier;
    case 'sustain':
      return (sustain + prevented * 0.1 + damage * 0.05) * confidence * densityMultiplier;
    case 'control':
      return (e.utilityMagnitude * 10_000 + prevented * 0.15 + damage * 0.05) * confidence * densityMultiplier;
    case 'custom':
      return customWeightedScore(rec, customWeights);
    case 'manual':
    case 'damage_first':
    case 'balanced':
    case 'xp':
    case 'profit':
    case 'safety':
    case 'low_supplies':
    default: {
      const support = prevented * 0.35 + sustain * 0.25 + e.expectedProfitPerHour * 0.02 + e.utilityMagnitude * 4_000;
      return (damage + support * 0.15) * confidence * densityMultiplier;
    }
  }
}

export function mainGainForRole(rec: CharmRecommendation, role: CharmRole): number {
  switch (role) {
    case 'defensive':
      return rec.effect.expectedDamagePreventedPerHour;
    case 'sustain':
      return sustainGain(rec);
    case 'control':
      return rec.effect.expectedDamagePreventedPerHour > MEANINGFUL_RAW_VALUE
        ? rec.effect.expectedDamagePreventedPerHour
        : rec.effect.utilityMagnitude;
    case 'loot_utility':
      return rec.effect.expectedProfitPerHour;
    case 'utility':
      return rec.effect.utilityMagnitude;
    case 'budget_damage':
    case 'damage':
    default:
      return rec.effect.expectedDamagePerHour;
  }
}

export function buildComparisonRows(
  recommendations: CharmRecommendation[],
  view: OptimisationMode,
  selectedCharmIds: CharmId[],
  customWeights: ScoreWeights = DEFAULT_CUSTOM_WEIGHTS,
  limit = 8,
): ComparisonRow[] {
  const selected = new Set(selectedCharmIds);
  const manualSelectionActive = selected.size > 0 || view === 'manual';
  const candidates = recommendations
    .filter(isMeaningfulRecommendation)
    .filter((rec) => (manualSelectionActive ? selected.has(rec.charmId) : true));

  const sorted = candidates
    .map((recommendation) => {
      const role = recommendationRole(recommendation);
      const score = scoreRecommendationForView(recommendation, view, customWeights);
      const cost = costToReachRecommendationTier(recommendation);
      return {
        recommendation,
        role,
        score,
        mainGain: mainGainForRole(recommendation, role),
        efficiency: cost > 0 ? score / cost : null,
        cost,
        tieState: null,
        reasonKey: reasonKeyForRecommendation(recommendation, role),
      } satisfies ComparisonRow;
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || b.mainGain - a.mainGain || a.cost - b.cost);

  const rows = sorted.slice(0, manualSelectionActive ? sorted.length : limit);
  const bestScore = rows[0]?.score ?? 0;
  return rows.map((row, index) => {
    if (index === 0 || bestScore <= 0) return row;
    const gap = (bestScore - row.score) / bestScore;
    return {
      ...row,
      tieState: gap < SAME_RANK_THRESHOLD ? 'same_rank' : gap < EFFECTIVE_TIE_THRESHOLD ? 'effectively_tied' : null,
    };
  });
}

function reasonKeyForRecommendation(rec: CharmRecommendation, role: CharmRole): string {
  if (role === 'defensive') return 'defensive_need';
  if (role === 'sustain') return 'sustain_need';
  if (role === 'control') return 'control_need';
  if (role === 'loot_utility') return 'loot_utility';
  if (!rec.unlocked) return 'unlock_candidate';
  if (rec.calculation.killShare >= 0.4) return 'creature_share';
  return 'damage_gain';
}

export function defaultSelectedCharmIds(recommendations: CharmRecommendation[], view: OptimisationMode, customWeights: ScoreWeights): CharmId[] {
  const seen = new Set<CharmId>();
  const rows = buildComparisonRows(recommendations, view, [], customWeights, 5);
  for (const row of rows) seen.add(row.recommendation.charmId);
  return [...seen];
}
