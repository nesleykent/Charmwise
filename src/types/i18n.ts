// Shape of the translation dictionaries in src/locales. Keeping this as a
// type (rather than inferring from the English file) means a missing key in
// the Portuguese file is a compile error, not a silent fallback.
export type Locale = 'en-GB' | 'pt-BR';

export interface Dictionary {
  meta: { title: string; description: string };
  nav: { dashboard: string; character: string; hunt: string; recommendations: string; charms: string; tagline: string };
  language: { en: string; pt: string };
  common: {
    resetWorkspace: string;
    resetConfirm: string;
    privacyNote: string;
  };
  dataBadge: {
    measured: string;
    estimated: string;
    assumed: string;
    measuredHint: string;
    estimatedHint: string;
    assumedHint: string;
  };
  dashboard: {
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptyBody: string;
    emptyCtaHunt: string;
    emptyCtaCharacter: string;
    bestAssignmentsTitle: string;
    upgradeOpportunitiesTitle: string;
    viewAllLink: string;
    noUpgrades: string;
    scopeFullAnalysis: string;
    scopeMyCharms: string;
    scopeFullAnalysisHint: string;
    scopeMyCharmsHint: string;
    notUnlockedTag: string;
  };
  characterPage: {
    title: string;
    subtitle: string;
  };
  huntPage: {
    title: string;
    subtitle: string;
  };
  recommendationsPage: {
    title: string;
    subtitle: string;
    emptyTitle: string;
    emptyBody: string;
    emptyCta: string;
    modeLabel: string;
    modeDescriptions: Record<string, string>;
    modes: Record<string, string>;
    targetTierLabel: string;
    targetTierHint: string;
    sectionDetails: string;
  };
  charmLibrary: {
    title: string;
    subtitle: string;
    bestAgainst: string;
    worstAgainst: string;
    backToLibrary: string;
    tierCosts: string;
  };
  characterForm: {
    title: string;
    level: string;
    maxHitpoints: string;
    maxMana: string;
    criticalChance: string;
    criticalDamageBonus: string;
    helpCriticalChance: string;
    helpCriticalDamageBonus: string;
    lifeLeechPercent: string;
    manaLeechPercent: string;
    availableCharmPoints: string;
    availableMinorCharmEchoes: string;
    accountType: string;
    hasCharmExpansion: string;
    hasUsedFreeReset: string;
    isPromoted: string;
    useSuggestedValue: string;
    unlockedMajorCharms: string;
    unlockedMinorCharms: string;
    assignedMajorCharms: string;
    assignedMinorCharms: string;
    essentialsHelp: string;
    lookupToggle: string;
    lookupPlaceholder: string;
    lookupButton: string;
    lookupLoading: string;
    lookupPrivacyNote: string;
    advancedToggle: string;
    accountTypes: { free: string; premium: string };
    addRow: string;
    removeRow: string;
    creatureNamePlaceholder: string;
    charmFieldLabel: string;
    /** The three real in-game tier names (Bronze/Silver/Gold), not a generic "Tier 1/2/3". */
    tierNames: readonly [string, string, string];
    tierLocked: string;
    helpCharmPoints: string;
    helpMinorEchoes: string;
    validation: {
      levelRange: string;
      hitpointsPositive: string;
      manaNonNegative: string;
      percentRange: string;
      pointsNonNegative: string;
    };
  };
  huntAnalyserInput: {
    title: string;
    placeholder: string;
    loadSample: string;
    clear: string;
    parsedSummaryTitle: string;
    sessionDuration: string;
    killedMonstersFound: string;
    warningsTitle: string;
    noWarnings: string;
  };
  results: {
    bestMajor: string;
    bestMinor: string;
    allMajorCharms: string;
    allMinorCharms: string;
    /** Connector word in "{{charm}} for {{creature}}" suggestion rows. */
    linkingFor: string;
    perCreatureTitle: string;
    perCreatureDescription: string;
    fullHuntTitle: string;
    recommendedSetup: string;
    rankedAlternatives: string;
    rankedAlternativesDescription: string;
    charmPointBudget: string;
    minorEchoBudget: string;
    improvementSummary: string;
    improvementStateNothingUnlocked: string;
    improvementStateAlreadyOptimal: string;
    improvementStateHasGain: string;
    finalRecommendation: string;
    whyThisIsBest: string;
    whyThisIsBestBody: string;
    selectedComparison: string;
    chooseCharmsTitle: string;
    chooseCharmsDefaultNote: string;
    chooseCharmsManualEmptyNote: string;
    chooseCharmsManualNote: string;
    clearSelection: string;
    noUnlockedCharmNotice: string;
    noMeaningfulComparison: string;
    nonDamageReasonDisclosure: string;
    advancedFullRanking: string;
    formulaDebugDetails: string;
    noActionableUpgrades: string;
    sameRank: string;
    effectivelyTied: string;
    comparisonCharm: string;
    comparisonCreature: string;
    comparisonRole: string;
    comparisonTier: string;
    comparisonMainGain: string;
    comparisonCost: string;
    comparisonEfficiency: string;
    comparisonConfidence: string;
    comparisonReason: string;
    roles: Record<string, string>;
    /** One-line structural "why this role" explanations, keyed by CharmRole, with a {{charm}} placeholder - e.g. "Dodge is always Defensive...". Role is a fixed identity fact (see EFFECT_KIND_TO_ROLE), so this never varies by hunt. */
    roleExplanations: Record<string, string>;
    decisionReasons: Record<string, string>;
    economicsTitle: string;
    reassignmentsTitle: string;
    confidence: { high: string; medium: string; low: string; unknown: string };
    calculationDetailsTitle: string;
    effectModelTitle: string;
    modelHuntBasis: string;
    modelEffectFormula: string;
    modelDerivedOutputs: string;
    modelKillShare: string;
    modelKillsPerHour: string;
    modelAttacksPerHour: string;
    modelBaseDamage: string;
    modelCharmImpactFactor: string;
    modelDamageCap: string;
    modelSelectedBaseDamage: string;
    modelPerProcDamage: string;
    modelHourlyEstimate: string;
    modelUsed: string;
    modelNotUsed: string;
    modelNoSpecificFormula: string;
    metrics: {
      expectedDamagePerHour: string;
      expectedXpPerHour: string;
      expectedProfitPerHour: string;
      expectedDamagePreventedPerHour: string;
      expectedHealingSavedPerHour: string;
      roleMetricPerCharmPoint: string;
      roleMetricPerMinorCharmEcho: string;
    };
    noMajorUnlocked: string;
    noMinorUnlocked: string;
    slotLimitTitle: string;
    slotLimitDescription: string;
    slotsEmptyNothingUnlocked: string;
    slotsEmptyNoValue: string;
    removalCost: string;
    resetCost: string;
    resetFree: string;
    cheaperOption: { removals: string; reset: string; no_change: string };
    tiedRankHint: string;
    rankingCriterionNote: string;
  };
  missingData: {
    title: string;
    noIssues: string;
    caveatsNote: string;
    lackingBestiary: string;
    needsManualReview: string;
  };
  elements: { physical: string; fire: string; earth: string; energy: string; ice: string; holy: string; death: string };
  /** Templates for LocalisedMessage.code, with `{{param}}` placeholders - see src/lib/messages.ts. */
  messages: Record<string, string>;
  charms: Record<
    | 'carnage'
    | 'curse'
    | 'divine_wrath'
    | 'dodge'
    | 'enflame'
    | 'freeze'
    | 'low_blow'
    | 'overpower'
    | 'overflux'
    | 'parry'
    | 'poison'
    | 'savage_blow'
    | 'wound'
    | 'zap'
    | 'adrenaline_burst'
    | 'bless'
    | 'cleanse'
    | 'cripple'
    | 'gut'
    | 'numb'
    | 'scavenge'
    | 'fatal_hold'
    | 'vampiric_embrace'
    | 'void_inversion'
    | 'voids_call',
    { name: string; description: string }
  >;
}
