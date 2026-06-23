'use client';

import { useId, useState } from 'react';
import { CreatureNameInput } from '@/components/CreatureNameInput';
import { MAJOR_CHARM_LIST, MINOR_CHARM_LIST } from '@/data/charms';
import { useLocale } from '@/lib/i18n';
import { formatMessage } from '@/lib/messages';
import { fetchCharacterByName } from '@/lib/tibiaDataApi';
import { validateCharacterInput, type CharacterValidationIssue } from '@/lib/validation';
import { estimateHitpointsAndMana } from '@/lib/vocationFormulas';
import type { AccountType, AssignedCharm, CharacterInput, UnlockedCharm } from '@/types/character';
import type { CharmDefinition, CharmId, CharmTier } from '@/types/charm';
import type { Dictionary } from '@/types/i18n';

interface Props {
  value: CharacterInput;
  onChange: (next: CharacterInput) => void;
}

function CharacterLookup({
  t,
  onApply,
}: {
  t: Dictionary;
  onApply: (level: number, hitpoints: number | null, mana: number | null) => void;
}) {
  const id = useId();
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function handleLookup() {
    const trimmed = name.trim();
    if (!trimmed || isLoading) return;
    setIsLoading(true);
    setFeedback(null);
    const result = await fetchCharacterByName(trimmed);
    setIsLoading(false);

    if (!result) {
      setFeedback({ tone: 'error', message: formatMessage(t, { code: 'lookup_error' }) });
      return;
    }
    const estimate = estimateHitpointsAndMana(result.level, result.vocation);
    onApply(result.level, estimate?.hitpoints ?? null, estimate?.mana ?? null);
    setFeedback({
      tone: 'success',
      message: estimate
        ? formatMessage(t, { code: 'lookup_success', params: { name: trimmed, level: result.level, vocation: result.vocation } })
        : formatMessage(t, { code: 'lookup_success_no_estimate', params: { name: trimmed, level: result.level } }),
    });
  }

  return (
    <details className="group card mb-4 overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-charm-primary marker:content-none">
        <span className="inline-block text-charm-muted transition-transform group-open:rotate-90">&rsaquo;</span>
        {t.characterForm.lookupToggle}
      </summary>
      <div className="flex flex-col gap-2 border-t border-white/10 p-4 sm:flex-row">
        <input
          id={id}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleLookup();
            }
          }}
          placeholder={t.characterForm.lookupPlaceholder}
          aria-label={t.characterForm.lookupPlaceholder}
          className="field-input flex-1"
        />
        <button
          type="button"
          onClick={() => void handleLookup()}
          disabled={isLoading || name.trim().length === 0}
          className="btn-secondary whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? t.characterForm.lookupLoading : t.characterForm.lookupButton}
        </button>
      </div>
      <p className="px-4 pb-3 text-[11px] leading-relaxed text-charm-subtle">{t.characterForm.lookupPrivacyNote}</p>
      {feedback && (
        <p
          role="status"
          className={`px-4 pb-4 text-xs leading-relaxed ${feedback.tone === 'error' ? 'text-charm-danger' : 'text-charm-minor'}`}
        >
          {feedback.message}
        </p>
      )}
    </details>
  );
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
      <label htmlFor={id} className="field-label">
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
        className={`field-input mt-1.5 ${error ? 'border-charm-danger' : ''}`}
      />
      {help && !error && (
        <p id={`${id}-help`} className="mt-1.5 text-xs text-charm-subtle">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-charm-danger">
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
          className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
        >
          <span className="truncate text-charm-muted">{t.charms[charm.id].name}</span>
          <select
            aria-label={t.charms[charm.id].name}
            value={getTier(list, charm.id)}
            onChange={(e) => onChange(withTier(list, charm.id, Number(e.target.value)))}
            className="field-select py-1.5 text-xs"
          >
            <option value={0}>{t.characterForm.tierLocked}</option>
            <option value={1}>{t.characterForm.tierNames[0]}</option>
            <option value={2}>{t.characterForm.tierNames[1]}</option>
            <option value={3}>{t.characterForm.tierNames[2]}</option>
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
          <CreatureNameInput
            value={row.creatureName}
            onChange={(v) => updateRow(i, { creatureName: v })}
            placeholder={t.characterForm.creatureNamePlaceholder}
            ariaLabel={t.characterForm.creatureNamePlaceholder}
          />
          <select
            value={row.charmId}
            onChange={(e) => updateRow(i, { charmId: e.target.value as CharmId })}
            aria-label={t.characterForm.charmFieldLabel}
            className="field-select"
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
            className="rounded-lg border border-white/10 px-3 text-charm-muted transition-colors hover:border-charm-danger hover:text-charm-danger"
          >
            &times;
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="w-full rounded-lg border border-dashed border-white/15 px-3 py-2 text-sm text-charm-muted transition-colors hover:border-charm-primary hover:text-white sm:w-auto"
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

function SubsectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-sm font-semibold text-white">{children}</h3>;
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
      {/* Essentials: the only inputs that feed the formulas directly (Overpower/Overflux read
          hitpoints/mana, level drives the gold formulas) - everything else has a working default. */}
      <section>
        <p className="mb-3 text-sm leading-relaxed text-charm-muted">{t.characterForm.essentialsHelp}</p>
        <CharacterLookup
          t={t}
          onApply={(level, hitpoints, mana) => {
            onChange({
              ...value,
              level,
              ...(hitpoints !== null ? { maxHitpoints: hitpoints } : {}),
              ...(mana !== null ? { maxMana: mana } : {}),
            });
          }}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <NumberField
            id={`${idPrefix}-level`}
            label={t.characterForm.level}
            value={value.level}
            onChange={(v) => set('level', v)}
            error={findError(issues, 'level', t)}
            min={1}
          />
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
        </div>
      </section>

      <details className="group card overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3.5 text-sm font-semibold text-charm-primary marker:content-none">
          <span className="inline-block text-charm-muted transition-transform group-open:rotate-90">&rsaquo;</span>
          {t.characterForm.advancedToggle}
        </summary>
        <div className="space-y-7 border-t border-white/10 p-4 sm:p-5">
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberField
              id={`${idPrefix}-crit-chance`}
              label={t.characterForm.criticalChance}
              value={value.criticalChance}
              onChange={(v) => set('criticalChance', v)}
              error={findError(issues, 'criticalChance', t)}
              min={0}
              step={0.1}
              help={t.characterForm.helpCriticalChance}
            />
            <NumberField
              id={`${idPrefix}-crit-damage`}
              label={t.characterForm.criticalDamageBonus}
              value={value.criticalDamageBonus}
              onChange={(v) => set('criticalDamageBonus', v)}
              error={findError(issues, 'criticalDamageBonus', t)}
              min={0}
              step={0.1}
              help={t.characterForm.helpCriticalDamageBonus}
            />
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <label htmlFor={`${idPrefix}-account`} className="field-label">
                {t.characterForm.accountType}
              </label>
              <select
                id={`${idPrefix}-account`}
                value={value.accountType}
                onChange={(e) => set('accountType', e.target.value as AccountType)}
                className="field-select mt-1.5 w-full py-2.5"
              >
                <option value="free">{t.characterForm.accountTypes.free}</option>
                <option value="premium">{t.characterForm.accountTypes.premium}</option>
              </select>
            </div>
            <div className="flex flex-col justify-center gap-3">
              <label className="flex items-center gap-2.5 text-sm text-charm-muted">
                <input
                  type="checkbox"
                  checked={value.hasCharmExpansion}
                  onChange={(e) => set('hasCharmExpansion', e.target.checked)}
                  className="h-4 w-4 rounded border-charm-border bg-charm-bg accent-charm-primary"
                />
                {t.characterForm.hasCharmExpansion}
              </label>
              <label className="flex items-center gap-2.5 text-sm text-charm-muted">
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
            <SubsectionHeading>{t.characterForm.unlockedMajorCharms}</SubsectionHeading>
            <UnlockedCharmGrid charms={MAJOR_CHARM_LIST} list={value.unlockedMajorCharms} onChange={(v) => set('unlockedMajorCharms', v)} t={t} />
          </section>

          <section>
            <SubsectionHeading>{t.characterForm.unlockedMinorCharms}</SubsectionHeading>
            <UnlockedCharmGrid charms={MINOR_CHARM_LIST} list={value.unlockedMinorCharms} onChange={(v) => set('unlockedMinorCharms', v)} t={t} />
          </section>

          <section>
            <SubsectionHeading>{t.characterForm.assignedMajorCharms}</SubsectionHeading>
            <AssignedCharmRows
              rows={value.assignedMajorCharms}
              charmOptions={MAJOR_CHARM_LIST}
              onChange={(v) => set('assignedMajorCharms', v)}
              t={t}
            />
          </section>

          <section>
            <SubsectionHeading>{t.characterForm.assignedMinorCharms}</SubsectionHeading>
            <AssignedCharmRows
              rows={value.assignedMinorCharms}
              charmOptions={MINOR_CHARM_LIST}
              onChange={(v) => set('assignedMinorCharms', v)}
              t={t}
            />
          </section>
        </div>
      </details>
    </div>
  );
}
