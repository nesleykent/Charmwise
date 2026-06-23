// Pure validation for the Character input form. Returns error codes rather
// than localised strings so the UI can map them through the active
// Dictionary (see CharacterForm.tsx).
import type { CharacterInput } from '@/types/character';

export type CharacterValidationErrorCode =
  | 'level_range'
  | 'hitpoints_positive'
  | 'mana_non_negative'
  | 'percent_range'
  | 'points_non_negative';

export interface CharacterValidationIssue {
  field: keyof CharacterInput;
  code: CharacterValidationErrorCode;
}

export function validateCharacterInput(character: CharacterInput): CharacterValidationIssue[] {
  const issues: CharacterValidationIssue[] = [];

  // No upper bound - Tibia has no real level cap, and the top of the
  // playerbase keeps climbing well past any number that would have looked
  // like a safe ceiling when this was written.
  if (!Number.isFinite(character.level) || character.level < 1) {
    issues.push({ field: 'level', code: 'level_range' });
  }
  if (!Number.isFinite(character.maxHitpoints) || character.maxHitpoints <= 0) {
    issues.push({ field: 'maxHitpoints', code: 'hitpoints_positive' });
  }
  if (!Number.isFinite(character.maxMana) || character.maxMana < 0) {
    issues.push({ field: 'maxMana', code: 'mana_non_negative' });
  }
  if (!Number.isFinite(character.criticalChance) || character.criticalChance < 0 || character.criticalChance > 100) {
    issues.push({ field: 'criticalChance', code: 'percent_range' });
  }
  if (!Number.isFinite(character.criticalDamageBonus) || character.criticalDamageBonus < 0) {
    issues.push({ field: 'criticalDamageBonus', code: 'percent_range' });
  }
  if (!Number.isFinite(character.lifeLeechPercent) || character.lifeLeechPercent < 0) {
    issues.push({ field: 'lifeLeechPercent', code: 'percent_range' });
  }
  if (!Number.isFinite(character.manaLeechPercent) || character.manaLeechPercent < 0) {
    issues.push({ field: 'manaLeechPercent', code: 'percent_range' });
  }
  if (!Number.isFinite(character.availableCharmPoints) || character.availableCharmPoints < 0) {
    issues.push({ field: 'availableCharmPoints', code: 'points_non_negative' });
  }
  if (!Number.isFinite(character.availableMinorCharmEchoes) || character.availableMinorCharmEchoes < 0) {
    issues.push({ field: 'availableMinorCharmEchoes', code: 'points_non_negative' });
  }

  return issues;
}
