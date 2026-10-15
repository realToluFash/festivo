import { LOCALES } from '@soirely/domain';
import { useTranslation } from 'react-i18next';

import { currentLocale, setLanguage } from '../i18n/index.ts';

export function LanguageChoice() {
  const { t } = useTranslation();
  const current = currentLocale();

  return (
    <div className="language-choice" role="group" aria-label={t('language.label')}>
      {LOCALES.map((locale) => (
        <button
          key={locale.code}
          type="button"
          lang={locale.code}
          aria-pressed={locale.code === current}
          onClick={() => void setLanguage(locale.code)}
        >
          {locale.nativeName}
        </button>
      ))}
    </div>
  );
}
