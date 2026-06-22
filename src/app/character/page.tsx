'use client';

import { CharacterForm } from '@/components/CharacterForm';
import { useLocale } from '@/lib/i18n';
import { useWorkspace } from '@/lib/workspace';

export default function CharacterPage() {
  const { t } = useLocale();
  const { character, setCharacter, resetWorkspace } = useWorkspace();

  function handleResetClick() {
    if (window.confirm(t.common.resetConfirm)) resetWorkspace();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">{t.characterPage.title}</h1>
          <p className="mt-1.5 text-charm-muted">{t.characterPage.subtitle}</p>
        </div>
        <button type="button" onClick={handleResetClick} className="btn-secondary text-xs text-charm-muted">
          {t.common.resetWorkspace}
        </button>
      </div>

      <div className="card mt-8 p-5 sm:p-6">
        <CharacterForm value={character} onChange={setCharacter} />
      </div>
    </div>
  );
}
