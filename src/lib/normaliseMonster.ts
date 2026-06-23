// Safe adapter between the upstream bestiary.json export (tibiadraptor.com
// shape, see README "Data sources") and the MonsterProfile type the rest of
// the app depends on.
//
// Why this exists: the upstream file does NOT include loot value, creature
// product value, skinning/dusting data or flee thresholds under any key we
// could find. Rather than fabricate numbers, every field that cannot be
// sourced is left `null` and recorded in `missingFields` so the UI can show
// an honest "Missing data" warning instead of a silently wrong number.
import bestiaryFile from '@/data/bestiary.json';
import creatureProductsFile from '@/data/creatureProducts.json';
import dustingFile from '@/data/dusting.json';
import skinningFile from '@/data/skinning.json';
import type { ElementType } from '@/types/charm';
import type {
  BestiaryDifficulty,
  CorpseActionProfile,
  CorpseActionTool,
  CreatureProductDrop,
  DataConfidence,
  MonsterDamageProfile,
  MonsterProfile,
  MonsterResistances,
  RawBestiaryEntry,
  RawBestiaryFile,
} from '@/types/monster';

const DEFAULT_ENTRIES: RawBestiaryEntry[] = (bestiaryFile as unknown as RawBestiaryFile).data ?? [];

interface RawCreatureProductItem {
  itemId: string;
  itemName: string;
  npcPrice?: number | null;
  marketPriceByWorld?: Record<string, number | null>;
  weight?: number | null;
  sourceUrl?: string;
  lastVerifiedAt?: string;
  droppedBy?: {
    creatureId: string;
    creatureName: string;
    dropChance?: number | null;
    dropChanceConfidence?: DataConfidence;
  }[];
}

interface RawCreatureProductsFile {
  sourceUrl?: string;
  lastVerifiedAt?: string;
  items?: RawCreatureProductItem[];
}

interface RawCorpseActionEntry {
  creatureId: string;
  name: string;
  eligible: boolean;
  tool: CorpseActionTool;
  productItemId: string;
  productItemName: string;
  baseSuccessChance?: number | null;
  baseSuccessChanceConfidence?: DataConfidence;
  npcPrice?: number | null;
  marketPriceByWorld?: Record<string, number | null>;
  corpseEligibleSeconds?: number | null;
  specialCaseMultipleAttempts?: boolean;
  specialCaseGuaranteedSuccess?: boolean;
  sourceUrl?: string;
  lastVerifiedAt?: string;
  confidence?: DataConfidence;
}

interface RawCorpseActionFile {
  sourceUrl?: string;
  lastVerifiedAt?: string;
  entries?: RawCorpseActionEntry[];
}

const CREATURE_PRODUCT_FILE = creatureProductsFile as unknown as RawCreatureProductsFile;
const CREATURE_PRODUCT_ITEMS = CREATURE_PRODUCT_FILE.items ?? [];
const SKINNING_FILE = skinningFile as unknown as RawCorpseActionFile;
const SKINNING_ENTRIES = SKINNING_FILE.entries ?? [];
const DUSTING_FILE = dustingFile as unknown as RawCorpseActionFile;
const DUSTING_ENTRIES = DUSTING_FILE.entries ?? [];

const ELEMENT_TYPES: ElementType[] = [
  'physical',
  'fire',
  'earth',
  'energy',
  'ice',
  'holy',
  'death',
];

const DIFFICULTY_MAP: Record<string, BestiaryDifficulty> = {
  harmless: 'harmless',
  trivial: 'trivial',
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
  challenging: 'challenging',
};

export function getBestiaryEntries(): RawBestiaryEntry[] {
  return DEFAULT_ENTRIES;
}

/** lowercase, trim, collapse internal whitespace, drop a leading article. Used for matching only - display names are left untouched. */
export function normaliseNameForMatch(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^(a|an|the)\s+/, '')
    .replace(/\s+/g, ' ');
}

export function creatureIdFromName(name: string): string {
  return normaliseNameForMatch(name)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normaliseDifficulty(raw: string | undefined | null): BestiaryDifficulty {
  if (!raw) return 'unknown';
  return DIFFICULTY_MAP[raw.trim().toLowerCase()] ?? 'unknown';
}

export function normaliseResistances(
  raw: RawBestiaryEntry['resistances'],
): MonsterResistances | null {
  if (!raw || raw.length === 0) return null;
  const byType = new Map(raw.map((r) => [r.type?.toLowerCase(), r.value]));
  const fields: (keyof MonsterResistances)[] = [
    'physical',
    'fire',
    'earth',
    'energy',
    'ice',
    'holy',
    'death',
  ];
  // Require at least one recognised element before claiming we have
  // resistance data at all - an entry with an empty/garbage array should
  // still be treated as "missing" rather than "all neutral".
  if (!fields.some((f) => byType.has(f))) return null;
  const resistances = {} as MonsterResistances;
  for (const field of fields) {
    const value = byType.get(field);
    resistances[field] = typeof value === 'number' ? value / 100 : 1;
  }
  return resistances;
}

export function normaliseDamageProfile(entry: RawBestiaryEntry): MonsterDamageProfile | null {
  const attackTypeRaw = (entry.attack_type ?? '').toLowerCase();
  const damageTypes = (entry.damage_types ?? []).map((t) => t.toLowerCase());
  if (!attackTypeRaw && damageTypes.length === 0) return null;

  let attackType: MonsterDamageProfile['attackType'] = 'unknown';
  const hasMelee = attackTypeRaw.includes('melee');
  const hasRanged = attackTypeRaw.includes('ranged') || attackTypeRaw.includes('distance');
  if (hasMelee && hasRanged) attackType = 'mixed';
  else if (hasMelee) attackType = 'melee';
  else if (hasRanged) attackType = 'ranged';

  const dealtElements = damageTypes.filter((t): t is ElementType =>
    ELEMENT_TYPES.includes(t as ElementType),
  );

  return {
    attackType,
    dealtElements,
    inflictsManaDrain: damageTypes.includes('mana drain'),
    inflictsLifeDrain: damageTypes.includes('life drain'),
  };
}

/** Looks for a value under any of several plausible upstream key names. Returns undefined if none are present. */
function pickNumber(entry: RawBestiaryEntry, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return undefined;
}

function pickBoolean(entry: RawBestiaryEntry, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
  }
  return undefined;
}

function normaliseMarketPrices(raw: Record<string, number | null> | undefined): Record<string, number | null> {
  if (!raw) return {};
  return Object.fromEntries(Object.entries(raw).map(([world, value]) => [world, typeof value === 'number' ? value : null]));
}

function buildCreatureProducts(creatureId: string): CreatureProductDrop[] {
  const products: CreatureProductDrop[] = [];
  for (const item of CREATURE_PRODUCT_ITEMS) {
    for (const drop of item.droppedBy ?? []) {
      if (drop.creatureId !== creatureId) continue;
      products.push({
        itemId: item.itemId,
        itemName: item.itemName,
        npcPrice: typeof item.npcPrice === 'number' ? item.npcPrice : null,
        marketPrice: null,
        marketPriceByWorld: normaliseMarketPrices(item.marketPriceByWorld),
        weight: typeof item.weight === 'number' ? item.weight : null,
        dropChance: typeof drop.dropChance === 'number' ? drop.dropChance : null,
        dropChanceConfidence: drop.dropChanceConfidence ?? 'unknown',
        sourceUrl: item.sourceUrl ?? CREATURE_PRODUCT_FILE.sourceUrl ?? '',
        lastVerifiedAt: item.lastVerifiedAt ?? CREATURE_PRODUCT_FILE.lastVerifiedAt ?? '',
      });
    }
  }
  return products;
}

function buildCorpseAction(
  creatureId: string,
  entries: RawCorpseActionEntry[],
  source: RawCorpseActionFile,
): CorpseActionProfile | null {
  const entry = entries.find((candidate) => candidate.creatureId === creatureId);
  if (!entry || !entry.eligible) return null;
  return {
    eligible: true,
    tool: entry.tool,
    productItemId: entry.productItemId,
    productItemName: entry.productItemName,
    npcPrice: typeof entry.npcPrice === 'number' ? entry.npcPrice : null,
    marketPrice: null,
    marketPriceByWorld: normaliseMarketPrices(entry.marketPriceByWorld),
    baseSuccessChance: typeof entry.baseSuccessChance === 'number' ? entry.baseSuccessChance : null,
    baseSuccessChanceConfidence: entry.baseSuccessChanceConfidence ?? 'unknown',
    corpseEligibleSeconds: typeof entry.corpseEligibleSeconds === 'number' ? entry.corpseEligibleSeconds : null,
    specialCaseMultipleAttempts: entry.specialCaseMultipleAttempts ?? false,
    specialCaseGuaranteedSuccess: entry.specialCaseGuaranteedSuccess ?? false,
    sourceUrl: entry.sourceUrl ?? source.sourceUrl ?? '',
    lastVerifiedAt: entry.lastVerifiedAt ?? source.lastVerifiedAt ?? '',
    confidence: entry.confidence ?? 'low',
  };
}

function productValue(npcPrice: number | null, marketPrice: number | null): number | null {
  return marketPrice ?? npcPrice;
}

function expectedCreatureProductValuePerKill(products: CreatureProductDrop[]): number | null {
  let total = 0;
  let hasKnownValue = false;
  for (const product of products) {
    const value = productValue(product.npcPrice, product.marketPrice);
    if (product.dropChance === null || value === null) continue;
    total += product.dropChance * value;
    hasKnownValue = true;
  }
  return hasKnownValue ? total : null;
}

/** Smallest edit distance between two strings - used only to catch minor typos/plurals in pasted monster names. */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let previousRow = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const currentRow = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow.push(
        Math.min(
          previousRow[j]! + 1, // deletion
          currentRow[j - 1]! + 1, // insertion
          previousRow[j - 1]! + cost, // substitution
        ),
      );
    }
    previousRow = currentRow;
  }
  return previousRow[n]!;
}

/** Accept a fuzzy match only when the edit distance is small relative to name length (typo/plural tolerance, not a different creature). */
function isCloseEnough(a: string, b: string): boolean {
  const distance = levenshteinDistance(a, b);
  const threshold = Math.max(1, Math.floor(Math.min(a.length, b.length) * 0.2));
  return distance <= threshold;
}

export interface BestiaryMatch {
  entry: RawBestiaryEntry | null;
  wasFuzzyMatched: boolean;
}

export function findBestiaryEntry(
  monsterName: string,
  entries: RawBestiaryEntry[] = DEFAULT_ENTRIES,
): BestiaryMatch {
  const target = normaliseNameForMatch(monsterName);

  for (const entry of entries) {
    if (normaliseNameForMatch(entry.name) === target) {
      return { entry, wasFuzzyMatched: false };
    }
  }

  let best: { entry: RawBestiaryEntry; distance: number } | null = null;
  for (const entry of entries) {
    const candidate = normaliseNameForMatch(entry.name);
    if (!isCloseEnough(target, candidate)) continue;
    const distance = levenshteinDistance(target, candidate);
    if (!best || distance < best.distance) best = { entry, distance };
  }

  return best ? { entry: best.entry, wasFuzzyMatched: true } : { entry: null, wasFuzzyMatched: false };
}

const MISSING_FIELD_CANDIDATE_KEYS: Record<string, string[]> = {
  averageLootValue: ['average_loot_value', 'loot_value', 'averageLootValue'],
  creatureProductValue: ['creature_product_value', 'creature_products_value', 'product_value'],
  skinningValue: ['skinning_value', 'skin_value'],
  dustingValue: ['dusting_value', 'dust_value'],
  fleeHealthPercent: ['flee_health_percent', 'flee_percent', 'flees_at'],
};

/**
 * Builds a MonsterProfile for `monsterName`. `huntDerivedLootValue` lets the
 * optimiser pass in a per-kill loot value estimated from the pasted Hunt
 * Analyser session, which is used as a fallback since bestiary.json carries
 * no loot data at all.
 */
export function buildMonsterProfile(
  monsterName: string,
  entries: RawBestiaryEntry[] = DEFAULT_ENTRIES,
  huntDerivedLootValue: number | null = null,
): MonsterProfile {
  const { entry, wasFuzzyMatched } = findBestiaryEntry(monsterName, entries);
  const missingFields: string[] = [];

  if (!entry) {
    return {
      name: monsterName,
      hitpoints: null,
      experience: null,
      difficulty: 'unknown',
      charmPoints: null,
      resistances: null,
      averageLootValue: huntDerivedLootValue,
      creatureProductValue: null,
      supportsSkinning: null,
      supportsDusting: null,
      skinningValue: null,
      dustingValue: null,
      creatureProducts: [],
      skinning: null,
      dusting: null,
      fleeHealthPercent: null,
      conditions: [],
      damageProfile: null,
      missingFields: [
        'hitpoints',
        'experience',
        'difficulty',
        'charmPoints',
        'resistances',
        'creatureProductValue',
        'supportsSkinning',
        'supportsDusting',
        'skinningValue',
        'dustingValue',
        'creatureProducts',
        'skinning',
        'dusting',
        'fleeHealthPercent',
        'conditions',
        'damageProfile',
      ],
      matchedBestiaryName: null,
      wasFuzzyMatched: false,
    };
  }

  const hitpoints = typeof entry.hitpoints === 'number' ? entry.hitpoints : null;
  if (hitpoints === null) missingFields.push('hitpoints');

  const experience = typeof entry.experience === 'number' ? entry.experience : null;
  if (experience === null) missingFields.push('experience');

  const charmPoints =
    typeof entry.charm_details?.charm_points === 'number' ? entry.charm_details.charm_points : null;
  if (charmPoints === null) missingFields.push('charmPoints');

  const resistances = normaliseResistances(entry.resistances);
  if (resistances === null) missingFields.push('resistances');

  const damageProfile = normaliseDamageProfile(entry);
  if (damageProfile === null) missingFields.push('damageProfile');

  const averageLootValue = pickNumber(entry, MISSING_FIELD_CANDIDATE_KEYS.averageLootValue!) ?? huntDerivedLootValue;
  if (averageLootValue === null || averageLootValue === undefined) missingFields.push('averageLootValue');

  const creatureId = creatureIdFromName(entry.name);
  const creatureProducts = buildCreatureProducts(creatureId);
  const creatureProductValue =
    expectedCreatureProductValuePerKill(creatureProducts) ?? pickNumber(entry, MISSING_FIELD_CANDIDATE_KEYS.creatureProductValue!) ?? null;
  if (creatureProducts.length === 0 && creatureProductValue === null) missingFields.push('creatureProducts');
  if (creatureProducts.some((product) => product.dropChance === null)) missingFields.push('creatureProducts.dropChance');
  if (creatureProducts.some((product) => productValue(product.npcPrice, product.marketPrice) === null)) {
    missingFields.push('creatureProducts.price');
  }

  const skinning = buildCorpseAction(creatureId, SKINNING_ENTRIES, SKINNING_FILE);
  const dusting = buildCorpseAction(creatureId, DUSTING_ENTRIES, DUSTING_FILE);

  const supportsSkinning = skinning?.eligible ?? pickBoolean(entry, ['supports_skinning', 'skinning', 'can_skin']) ?? null;
  if (supportsSkinning === null) missingFields.push('supportsSkinning');

  const supportsDusting = dusting?.eligible ?? pickBoolean(entry, ['supports_dusting', 'dusting', 'can_dust']) ?? null;
  if (supportsDusting === null) missingFields.push('supportsDusting');

  const skinningValue = skinning ? productValue(skinning.npcPrice, skinning.marketPrice) : pickNumber(entry, MISSING_FIELD_CANDIDATE_KEYS.skinningValue!) ?? null;
  if (skinningValue === null) missingFields.push('skinningValue');
  if (skinning && skinning.baseSuccessChance === null) missingFields.push('skinning.baseSuccessChance');

  const dustingValue = dusting ? productValue(dusting.npcPrice, dusting.marketPrice) : pickNumber(entry, MISSING_FIELD_CANDIDATE_KEYS.dustingValue!) ?? null;
  if (dustingValue === null) missingFields.push('dustingValue');
  if (dusting && dusting.baseSuccessChance === null) missingFields.push('dusting.baseSuccessChance');

  const fleeHealthPercent = pickNumber(entry, MISSING_FIELD_CANDIDATE_KEYS.fleeHealthPercent!) ?? null;
  if (fleeHealthPercent === null) missingFields.push('fleeHealthPercent');

  return {
    name: monsterName,
    hitpoints,
    experience,
    difficulty: normaliseDifficulty(entry.difficulty),
    charmPoints,
    resistances,
    averageLootValue: averageLootValue ?? null,
    creatureProductValue,
    supportsSkinning,
    supportsDusting,
    skinningValue,
    dustingValue,
    creatureProducts,
    skinning,
    dusting,
    fleeHealthPercent,
    conditions: entry.negative_conditions ?? [],
    damageProfile,
    missingFields,
    matchedBestiaryName: entry.name,
    wasFuzzyMatched,
  };
}

export function normaliseMonster(
  monsterName: string,
  entries: RawBestiaryEntry[] = DEFAULT_ENTRIES,
  huntDerivedLootValue: number | null = null,
): MonsterProfile {
  return buildMonsterProfile(monsterName, entries, huntDerivedLootValue);
}
