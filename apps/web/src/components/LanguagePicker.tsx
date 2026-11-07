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
 *
 * The signed-in app's has no Automatic: a choice there is saved to the account,
 * and the browser's language cannot be (sc-9797).
 */
export function LanguagePicker({
  automatic = true,
  pill = false,
}: {
  automatic?: boolean;
  /** Drawn as a pill naming the language shown, with the native select laid over it. */
  pill?: boolean;
}) {
  const { t } = useTranslation();
  const stored = storedLanguage();
  const signedIn = useSessionState().status === 'signedIn';
  const shown = LOCALES.find((locale) => locale.code === currentLocale());

  return (
    <label className={pill ? 'button language-pill' : 'language-picker'}>
      <span className="visually-hidden">{t('language.label')}</span>
      {pill && shown != null && (
        <span className="language-pill-face" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor">
            <circle cx="8" cy="8" r="6.25" />
            <path d="M1.75 8h12.5M8 1.75c1.75 1.9 2.5 4 2.5 6.25S9.75 12.35 8 14.25C6.25 12.35 5.5 10.25 5.5 8S6.25 3.65 8 1.75Z" />
          </svg>
          <span className="language-pill-name">{shown.nativeName}</span>
          <span className="language-pill-code">{shown.code.toUpperCase()}</span>
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor">
            <path d="m4 6 4 4 4-4" strokeWidth="1.5" />
          </svg>
        </span>
      )}
      <select
        value={stored ?? (automatic ? '' : currentLocale())}
        onChange={(e) =>
          void chooseLanguage(e.target.value === '' ? null : e.target.value, signedIn)
        }
        aria-label={t('language.label')}
      >
        {automatic && (
          <option value="" title={t('language.automaticHint')}>
            {t('language.automatic')} ({currentLocale()})
          </option>
        )}
        {LOCALES.map((locale) => (
          <option key={locale.code} value={locale.code}>
            {locale.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
