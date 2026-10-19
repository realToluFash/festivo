import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { InvitationRows } from '../../components/InvitationRows.tsx';
import type { WaitingInvitations } from '../../invitations.ts';
import { useSession } from '../../session.ts';

/** Where an account in no organisation lands, with any invitation waiting for it. Its own account pages still work from here. */
export function NoOrganisation({
  waiting,
  onOpen,
}: {
  waiting: WaitingInvitations;
  onOpen: (organisationId: string) => void;
}) {
  const { t } = useTranslation();
  const session = useSession();

  return (
    <section className="card no-organisation" aria-labelledby="no-organisation-title">
      <h1 id="no-organisation-title">{t('noOrganisation.title')}</h1>
      <p>{t('noOrganisation.body')}</p>
      {waiting.invitations.length > 0 ? (
        <div className="no-organisation-invitations">
          <p className="no-organisation-heading">{t('invitations.heading')}</p>
          <InvitationRows waiting={waiting} place="page" onOpen={onOpen} />
        </div>
      ) : (
        <p>{t('noOrganisation.wayOn', { email: session.email })}</p>
      )}
      <div className="auth-footnote">
        <span>{t('noOrganisation.signedInAs', { email: session.email })}</span>
        <Link className="link-button" to="/app/account/security">
          {t('noOrganisation.account')}
        </Link>
      </div>
    </section>
  );
}
