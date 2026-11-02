import { LOCALES } from '@soirely/domain';
import { useTranslation } from 'react-i18next';

import { chooseLanguage } from '../accountLanguage.ts';
import { currentLocale } from '../i18n/index.ts';
import { useSessionState } from '../session.ts';

export function LanguageChoice() {
  const { t } = useTranslation();
  const current = currentLocale();
  const signedIn = useSessionState().status === 'signedIn';

  return (
    <div className="language-choice" role="group" aria-label={t('language.label')}>
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
