import { LOCALES } from '@soirely/domain';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { chooseLanguage } from '../accountLanguage.ts';
import { currentLocale } from '../i18n/index.ts';
import { useSessionState } from '../session.ts';

/** `labelled` shows the group's name before the buttons, as it does at the foot of a phone's page. */
export function LanguageChoice({ labelled = false }: { labelled?: boolean }) {
  const { t } = useTranslation();
  const current = currentLocale();
  const signedIn = useSessionState().status === 'signedIn';
  const labelId = useId();

  return (
    <div
      className="language-choice"
      role="group"
      aria-label={labelled ? undefined : t('language.label')}
      aria-labelledby={labelled ? labelId : undefined}
    >
      {labelled && (
        <span id={labelId} className="language-choice-label">
          {t('language.label')}
        </span>
      )}
      {LOCALES.map((locale) => (
        <button
          key={locale.code}
          type="button"
          lang={locale.code}
          aria-pressed={locale.code === current}
          onClick={() => void chooseLanguage(locale.code, signedIn)}
        >
          {locale.nativeName}
        </button>
      ))}
    </div>
  );
}
