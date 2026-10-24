import { LOCALES } from '@soirely/domain';
import { useTranslation } from 'react-i18next';

import { chooseLanguage } from '../accountLanguage.ts';
import { currentLocale, storedLanguage } from '../i18n/index.ts';
import { useSessionState } from '../session.ts';

/**
 * Reachable from the public pages too, and that is the point.
 *
 * Somebody who cannot read the marketing copy cannot sign up, so putting the
 * switcher only behind the sign-in is a language barrier in front of the one
 * page that has to work for everybody.
 *
 * Each language is listed in ITS OWN language. A reader looking for Português
 * is not helped by a list that says "Portuguese".
 */
export function LanguagePicker() {
  const { t } = useTranslation();
  const stored = storedLanguage();
  const signedIn = useSessionState().status === 'signedIn';

  return (
    <label className="language-picker">
      <span className="visually-hidden">{t('language.label')}</span>
      <select
        value={stored ?? ''}
        onChange={(e) =>
          void chooseLanguage(e.target.value === '' ? null : e.target.value, signedIn)
        }
        aria-label={t('language.label')}
      >
        <option value="" title={t('language.automaticHint')}>
          {t('language.automatic')} ({currentLocale()})
        </option>
        {LOCALES.map((locale) => (
          <option key={locale.code} value={locale.code}>
            {locale.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
