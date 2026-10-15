import { LOCALES } from '@soirely/domain';
import { useTranslation } from 'react-i18next';

import { currentLocale, setLanguage } from '../i18n/index.ts';

/**
 * Four languages as four controls, which is the design's answer on the
 * sign-in screen and a better one than a menu: a reader sees their own
 * language on the page instead of having to open something to look for it.
 *
 * Each is named in its own language. Somebody looking for Português is not
 * helped by a list that says "Portuguese".
 */
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
