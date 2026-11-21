import { useTranslation } from 'react-i18next';

/** A save button's label, which cross-fades to Saved with its check once the save is confirmed. */
export function SaveLabel({ words, saved }: { words: string; saved: boolean }) {
  const { t } = useTranslation();

  return (
    <span className="save-label" data-saved={saved}>
      <span className="save-label-words" aria-hidden={saved}>
        {words}
      </span>
      <span className="save-label-saved" aria-hidden={!saved}>
        <span aria-hidden="true">✓</span> {t('saveLabel.saved')}
      </span>
    </span>
  );
}
