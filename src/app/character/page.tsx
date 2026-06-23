'use client';

import { CharacterForm } from '@/components/CharacterForm';
import { PageHeader } from '@/components/PageHeader';
import { useLocale } from '@/lib/i18n';
import { useWorkspace } from '@/lib/workspace';

export default function CharacterPage() {
  const { t } = useLocale();
  const { character, setCharacter, resetWorkspace } = useWorkspace();

  function handleResetClick() {
    if (window.confirm(t.common.resetConfirm)) resetWorkspace();
  }

  return (
    <div className="page-shell max-w-3xl">
      <PageHeader
        title={t.characterPage.title}
        subtitle={t.characterPage.subtitle}
        action={
          <button type="button" onClick={handleResetClick} className="btn-secondary text-xs text-charm-muted">
            {t.common.resetWorkspace}
          </button>
        }
      />

      <div className="card mt-8 p-5 sm:p-6">
        <CharacterForm value={character} onChange={setCharacter} />
      </div>
    </div>
  );
}
