import { useTranslation } from 'react-i18next';

/**
 * A real page, not a blank screen.
 *
 * The person reading it has no account, did not choose the link, and cannot
 * debug anything — so it says what probably happened and exactly what to do,
 * which is ask for another one.
 */
export function InvalidInvitation() {
  const { t } = useTranslation();

  return (
    <main id="content" className="guest-main" role="alert">
      <h1>{t('guest.invalidTitle')}</h1>
      <p>{t('guest.invalidBody')}</p>
    </main>
  );
}
