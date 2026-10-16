import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { useSession } from '../../session.ts';

/** Where an account in no organisation lands. Its own account pages still work from here. */
export function NoOrganisation() {
  const { t } = useTranslation();
  const session = useSession();

  return (
    <section className="card no-organisation" aria-labelledby="no-organisation-title">
      <h1 id="no-organisation-title">{t('noOrganisation.title')}</h1>
      <p>{t('noOrganisation.body')}</p>
      <p>{t('noOrganisation.wayOn', { email: session.email })}</p>
      <div className="auth-footnote">
        <span>{t('noOrganisation.signedInAs', { email: session.email })}</span>
        <Link className="link-button" to="/app/account/security">
          {t('noOrganisation.account')}
        </Link>
      </div>
    </section>
  );
}
