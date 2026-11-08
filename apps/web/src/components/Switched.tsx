import { useTranslation } from 'react-i18next';

import { Notice } from './Notice.tsx';

/** "Now working in ‹name›." on the page a switch happened on. One the person asked for takes focus; one that happened to them is read as it lands. */
export function Switched({ name, takesFocus = false }: { name: string; takesFocus?: boolean }) {
  const { t } = useTranslation();

  return (
    <div key={name} className="sw-switched">
      <Notice kind="done" takesFocus={takesFocus}>
        {t('switcher.switched', { name })}
      </Notice>
    </div>
  );
}
