// Shape of the translation dictionaries in src/locales. Keeping this as a
// type (rather than inferring from the English file) means a missing key in
// the Portuguese file is a compile error, not a silent fallback.
export type Locale = 'en-GB' | 'pt-BR';

export interface Dictionary {
  meta: { title: string; description: string };
  nav: { home: string; optimiser: string; tagline: string };
  language: { en: string; pt: string };
  home: {
    heroEyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    heroTagline: string;
    ctaPrimary: string;
    ctaSecondary: string;
    inputsTitle: string;
    inputsSubtitle: string;
    inputs: { title: string; description: string }[];
    howTitle: string;
    howSteps: { title: string; description: string }[];
    outputsTitle: string;
    outputsSubtitle: string;
    outputs: string[];
    footerNote: string;
  };
  optimiser: {
    title: string;
    subtitle: string;
    modeLabel: string;
    modeDescriptions: Record<string, string>;
    modes: { balanced: string; xp: string; profit: string; safety: string; low_supplies: string };
    sectionCharacter: string;
    sectionHunt: string;
    sectionCharms: string;
    sectionResults: string;
    sectionDetails: string;
    runButton: string;
    resetButton: string;
    emptyState: string;
  };
  characterForm: {
    title: string;
    level: string;
    maxHitpoints: string;
    maxMana: string;
    lifeLeechPercent: string;
    manaLeechPercent: string;
    availableCharmPoints: string;
    availableMinorCharmEchoes: string;
    accountType: string;
    hasCharmExpansion: string;
    hasUsedFreeReset: string;
    unlockedMajorCharms: string;
    unlockedMinorCharms: string;
    assignedMajorCharms: string;
    assignedMinorCharms: string;
    essentialsHelp: string;
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
    perCreatureTitle: string;
    fullHuntTitle: string;
    recommendedSetup: string;
    rankedAlternatives: string;
    charmPointBudget: string;
    minorEchoBudget: string;
    improvementSummary: string;
    economicsTitle: string;
    reassignmentsTitle: string;
    confidence: { high: string; medium: string; low: string };
    metrics: {
      expectedDamagePerHour: string;
      expectedProfitPerHour: string;
      expectedDamagePreventedPerHour: string;
      expectedHealingSavedPerHour: string;
      scorePerCharmPoint: string;
      scorePerMinorCharmEcho: string;
    };
    noMajorUnlocked: string;
    noMinorUnlocked: string;
    slotLimitTitle: string;
    slotLimitDescription: string;
    removalCost: string;
    resetCost: string;
    resetFree: string;
    cheaperOption: { removals: string; reset: string; no_change: string };
  };
  missingData: {
    title: string;
    noIssues: string;
    lackingBestiary: string;
    needsManualReview: string;
  };
  scoreDimensions: {
    damage: string;
    xp: string;
    profit: string;
    safety: string;
    supplySaving: string;
    utility: string;
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
