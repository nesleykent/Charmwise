'use client';

import { useId } from 'react';
import { MAJOR_CHARM_LIST, MINOR_CHARM_LIST } from '@/data/charms';
import { useLocale } from '@/lib/i18n';
import { validateCharacterInput, type CharacterValidationIssue } from '@/lib/validation';
import { VOCATIONS } from '@/types/character';
import type { AccountType, AssignedCharm, CharacterInput, UnlockedCharm, Vocation } from '@/types/character';
import type { CharmDefinition, CharmId, CharmTier } from '@/types/charm';
import type { Dictionary } from '@/types/i18n';

interface Props {
  value: CharacterInput;
  onChange: (next: CharacterInput) => void;
}

function NumberField({
  id,
  label,
  value,
  onChange,
  error,
  min,
  step,
  help,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
  min?: number;
  step?: number;
  help?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-charm-muted">
        {label}
      </label>
      <input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : ''}
        min={min}
        step={step ?? 1}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
        className="mt-1 w-full rounded-md border border-charm-border bg-charm-bg px-3 py-2 text-sm text-white focus:border-charm-primary focus:outline-none focus:ring-1 focus:ring-charm-primary"
      />
      {help && !error && (
        <p id={`${id}-help`} className="mt-1 text-xs text-charm-muted">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-charm-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function getTier(list: UnlockedCharm[], charmId: CharmId): number {
  return list.find((u) => u.charmId === charmId)?.tier ?? 0;
}

function withTier(list: UnlockedCharm[], charmId: CharmId, tier: number): UnlockedCharm[] {
  const filtered = list.filter((u) => u.charmId !== charmId);
  return tier === 0 ? filtered : [...filtered, { charmId, tier: tier as CharmTier }];
}

function UnlockedCharmGrid({
  charms,
  list,
  onChange,
  t,
}: {
  charms: CharmDefinition[];
  list: UnlockedCharm[];
  onChange: (next: UnlockedCharm[]) => void;
  t: Dictionary;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {charms.map((charm) => (
        <div
          key={charm.id}
          className="flex items-center justify-between gap-2 rounded-md border border-charm-border bg-charm-bg px-3 py-2 text-sm"
        >
          <span className="truncate text-charm-muted">{t.charms[charm.id].name}</span>
          <select
            aria-label={t.charms[charm.id].name}
            value={getTier(list, charm.id)}
            onChange={(e) => onChange(withTier(list, charm.id, Number(e.target.value)))}
            className="rounded border border-charm-border bg-charm-surface px-2 py-1 text-xs text-white focus:border-charm-primary focus:outline-none"
          >
            <option value={0}>{t.characterForm.tierLocked}</option>
            <option value={1}>{t.characterForm.tierLabel} 1</option>
            <option value={2}>{t.characterForm.tierLabel} 2</option>
            <option value={3}>{t.characterForm.tierLabel} 3</option>
          </select>
        </div>
      ))}
    </div>
  );
}

function AssignedCharmRows({
  rows,
  charmOptions,
  onChange,
  t,
}: {
  rows: AssignedCharm[];
  charmOptions: CharmDefinition[];
  onChange: (next: AssignedCharm[]) => void;
  t: Dictionary;
}) {
  function updateRow(index: number, patch: Partial<AssignedCharm>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function addRow() {
    onChange([...rows, { charmId: charmOptions[0]!.id, creatureName: '' }]);
  }
  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            value={row.creatureName}
            onChange={(e) => updateRow(i, { creatureName: e.target.value })}
            placeholder={t.characterForm.creatureNamePlaceholder}
            aria-label={t.characterForm.creatureNamePlaceholder}
            className="min-w-0 flex-1 rounded-md border border-charm-border bg-charm-bg px-3 py-2 text-sm text-white focus:border-charm-primary focus:outline-none"
          />
          <select
            value={row.charmId}
            onChange={(e) => updateRow(i, { charmId: e.target.value as CharmId })}
            aria-label={t.characterForm.tierLabel}
            className="rounded-md border border-charm-border bg-charm-surface px-2 py-2 text-sm text-white focus:border-charm-primary focus:outline-none"
          >
            {charmOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {t.charms[c.id].name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => removeRow(i)}
            aria-label={t.characterForm.removeRow}
            className="rounded-md border border-charm-border px-3 text-charm-muted hover:border-charm-danger hover:text-charm-danger"
          >
            &times;
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="rounded-md border border-dashed border-charm-border px-3 py-1.5 text-sm text-charm-muted hover:border-charm-primary hover:text-white"
      >
        + {t.characterForm.addRow}
      </button>
    </div>
  );
}

function findError(issues: CharacterValidationIssue[], field: keyof CharacterInput, t: Dictionary): string | undefined {
  const issue = issues.find((i) => i.field === field);
  if (!issue) return undefined;
  return {
    level_range: t.characterForm.validation.levelRange,
    hitpoints_positive: t.characterForm.validation.hitpointsPositive,
    mana_non_negative: t.characterForm.validation.manaNonNegative,
    percent_range: t.characterForm.validation.percentRange,
    points_non_negative: t.characterForm.validation.pointsNonNegative,
  }[issue.code];
}

export function CharacterForm({ value, onChange }: Props) {
  const { t } = useLocale();
  const idPrefix = useId();
  const issues = validateCharacterInput(value);

  function set<K extends keyof CharacterInput>(key: K, val: CharacterInput[K]) {
    onChange({ ...value, [key]: val });
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField
          id={`${idPrefix}-level`}
          label={t.characterForm.level}
          value={value.level}
          onChange={(v) => set('level', v)}
          error={findError(issues, 'level', t)}
          min={1}
        />
        <div>
          <label htmlFor={`${idPrefix}-vocation`} className="block text-sm font-medium text-charm-muted">
            {t.characterForm.vocation}
          </label>
          <select
            id={`${idPrefix}-vocation`}
            value={value.vocation}
            onChange={(e) => set('vocation', e.target.value as Vocation)}
            className="mt-1 w-full rounded-md border border-charm-border bg-charm-bg px-3 py-2 text-sm text-white focus:border-charm-primary focus:outline-none"
          >
            {VOCATIONS.map((v) => (
              <option key={v} value={v}>
                {t.characterForm.vocations[v]}
              </option>
            ))}
          </select>
        </div>
        <NumberField
          id={`${idPrefix}-hp`}
          label={t.characterForm.maxHitpoints}
          value={value.maxHitpoints}
          onChange={(v) => set('maxHitpoints', v)}
          error={findError(issues, 'maxHitpoints', t)}
          min={1}
        />
        <NumberField
          id={`${idPrefix}-mana`}
          label={t.characterForm.maxMana}
          value={value.maxMana}
          onChange={(v) => set('maxMana', v)}
          error={findError(issues, 'maxMana', t)}
          min={0}
        />
        <NumberField
          id={`${idPrefix}-crit-chance`}
          label={t.characterForm.criticalChance}
          value={value.criticalChance}
          onChange={(v) => set('criticalChance', v)}
          error={findError(issues, 'criticalChance', t)}
          min={0}
          step={0.1}
        />
        <NumberField
          id={`${idPrefix}-crit-bonus`}
          label={t.characterForm.criticalDamageBonus}
          value={value.criticalDamageBonus}
          onChange={(v) => set('criticalDamageBonus', v)}
          error={findError(issues, 'criticalDamageBonus', t)}
          min={0}
          step={0.1}
        />
        <NumberField
          id={`${idPrefix}-life-leech`}
          label={t.characterForm.lifeLeechPercent}
          value={value.lifeLeechPercent}
          onChange={(v) => set('lifeLeechPercent', v)}
          error={findError(issues, 'lifeLeechPercent', t)}
          min={0}
          step={0.1}
        />
        <NumberField
          id={`${idPrefix}-mana-leech`}
          label={t.characterForm.manaLeechPercent}
          value={value.manaLeechPercent}
          onChange={(v) => set('manaLeechPercent', v)}
          error={findError(issues, 'manaLeechPercent', t)}
          min={0}
          step={0.1}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <NumberField
          id={`${idPrefix}-cp`}
          label={t.characterForm.availableCharmPoints}
          value={value.availableCharmPoints}
          onChange={(v) => set('availableCharmPoints', v)}
          error={findError(issues, 'availableCharmPoints', t)}
          min={0}
          help={t.characterForm.helpCharmPoints}
        />
        <NumberField
          id={`${idPrefix}-mce`}
          label={t.characterForm.availableMinorCharmEchoes}
          value={value.availableMinorCharmEchoes}
          onChange={(v) => set('availableMinorCharmEchoes', v)}
          error={findError(issues, 'availableMinorCharmEchoes', t)}
          min={0}
          help={t.characterForm.helpMinorEchoes}
        />
        <div>
          <label htmlFor={`${idPrefix}-account`} className="block text-sm font-medium text-charm-muted">
            {t.characterForm.accountType}
          </label>
          <select
            id={`${idPrefix}-account`}
            value={value.accountType}
            onChange={(e) => set('accountType', e.target.value as AccountType)}
            className="mt-1 w-full rounded-md border border-charm-border bg-charm-bg px-3 py-2 text-sm text-white focus:border-charm-primary focus:outline-none"
          >
            <option value="free">{t.characterForm.accountTypes.free}</option>
            <option value="premium">{t.characterForm.accountTypes.premium}</option>
          </select>
        </div>
        <div className="flex flex-col gap-3 self-end">
          <label className="flex items-center gap-2 text-sm text-charm-muted">
            <input
              type="checkbox"
              checked={value.hasCharmExpansion}
              onChange={(e) => set('hasCharmExpansion', e.target.checked)}
              className="h-4 w-4 rounded border-charm-border bg-charm-bg accent-charm-primary"
            />
            {t.characterForm.hasCharmExpansion}
          </label>
          <label className="flex items-center gap-2 text-sm text-charm-muted">
            <input
              type="checkbox"
              checked={value.hasUsedFreeReset}
              onChange={(e) => set('hasUsedFreeReset', e.target.checked)}
              className="h-4 w-4 rounded border-charm-border bg-charm-bg accent-charm-primary"
            />
            {t.characterForm.hasUsedFreeReset}
          </label>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-white">{t.characterForm.unlockedMajorCharms}</h3>
        <UnlockedCharmGrid charms={MAJOR_CHARM_LIST} list={value.unlockedMajorCharms} onChange={(v) => set('unlockedMajorCharms', v)} t={t} />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-white">{t.characterForm.unlockedMinorCharms}</h3>
        <UnlockedCharmGrid charms={MINOR_CHARM_LIST} list={value.unlockedMinorCharms} onChange={(v) => set('unlockedMinorCharms', v)} t={t} />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-white">{t.characterForm.assignedMajorCharms}</h3>
        <AssignedCharmRows
          rows={value.assignedMajorCharms}
          charmOptions={MAJOR_CHARM_LIST}
          onChange={(v) => set('assignedMajorCharms', v)}
          t={t}
        />
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-white">{t.characterForm.assignedMinorCharms}</h3>
        <AssignedCharmRows
          rows={value.assignedMinorCharms}
          charmOptions={MINOR_CHARM_LIST}
          onChange={(v) => set('assignedMinorCharms', v)}
          t={t}
        />
      </section>
    </div>
  );
}
