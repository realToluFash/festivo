import { useTranslation } from 'react-i18next';

export function Invitation() {
  const { t } = useTranslation();

  return (
    <main id="content" className="guest-main">
      <h1>{t('guest.invitationTitle')}</h1>
      <p>{t('guest.invitationBody')}</p>
      <p className="muted">{t('guest.noAccountNeeded')}</p>
    </main>
  );
}
