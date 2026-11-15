import type { Membership } from '@soirely/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { CreateOrganisation, StartYourOwn } from '../../components/CreateOrganisation.tsx';
import { InvitationRows } from '../../components/InvitationRows.tsx';
import type { WaitingInvitations } from '../../invitations.ts';
import { joinOrganisation, useSession } from '../../session.ts';

/** Where an account in no organisation lands, with any invitation waiting for it and a way to start its own. Its own account pages still work from here. */
export function NoOrganisation({
  waiting,
  onOpen,
  onStarted,
}: {
  waiting: WaitingInvitations;
  onOpen: (organisationId: string) => void;
  onStarted: (started: Membership) => void;
}) {
  const { t } = useTranslation();
  const session = useSession();
  const [creating, setCreating] = useState(false);

  return (
    <section className="card no-organisation" aria-labelledby="no-organisation-title">
      <h1 id="no-organisation-title" tabIndex={-1}>
        {t('noOrganisation.title')}
      </h1>
      <p>{t('noOrganisation.body')}</p>
      {waiting.invitations.length > 0 ? (
        <div className="no-organisation-invitations">
          <p className="no-organisation-heading">{t('invitations.heading')}</p>
          <InvitationRows waiting={waiting} place="page" after={{ open: onOpen }} />
        </div>
      ) : (
        <p>{t('noOrganisation.wayOn', { email: session.email })}</p>
      )}
      <StartYourOwn onStart={() => setCreating(true)} />
      <div className="auth-footnote no-organisation-footnote">
        <span>{t('noOrganisation.signedInAs', { email: session.email })}</span>
        <Link className="link-button" to="/app/account/security">
          {t('noOrganisation.account')}
        </Link>
      </div>
      {creating && (
        <CreateOrganisation
          email={session.email}
          onCancel={() => setCreating(false)}
          onCreated={(started) => {
            setCreating(false);
            joinOrganisation(started);
            onStarted(started);
          }}
        />
      )}
    </section>
  );
}
