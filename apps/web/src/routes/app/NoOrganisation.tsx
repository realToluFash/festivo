import type { Membership } from '@soirely/api-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { CreateOrganisation, StartYourOwn } from '../../components/CreateOrganisation.tsx';
import { ManagedBanner, useManaged } from '../../components/Managed.tsx';
import { SignedIn, WaitingList, WaitingRow } from '../../components/NoOrganisationParts.tsx';
import { InvitationPanel } from '../../components/OrganisationSwitcher.tsx';
import { StillSignedIn } from '../../components/StillSignedIn.tsx';
import type { WaitingInvitations } from '../../invitations.ts';
import { joinOrganisation, useSession } from '../../session.ts';
import { useSignOut } from '../../signOut.ts';

/** Where an account in no organisation lands, as `/demo/today?orgs=none` draws it: any invitation waiting for it, a way to start its own or sc-563's banner in its place, and Your account and Sign out (sc-75471). */
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
  const managed = useManaged();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { signOut, unreached } = useSignOut(() => void navigate('/sign-in'));

  return (
    <div className="cw-none">
      <h1 id="no-organisation-title" tabIndex={-1}>
        {t('noOrganisation.title')}
      </h1>
      <p className="cw-none-body">{t('noOrganisation.body')}</p>
      {waiting.invitations.length > 0 ? (
        <WaitingList>
          {waiting.invitations.map((invitation) => (
            <WaitingRow key={invitation.id} name={invitation.organisation.name}>
              <InvitationPanel invitation={invitation} waiting={waiting} onOpen={onOpen} />
            </WaitingRow>
          ))}
        </WaitingList>
      ) : (
        <p className="cw-none-body is-quiet">
          {t('noOrganisation.wayOn', { email: session.email })}
        </p>
      )}
      {managed != null ? (
        <ManagedBanner managed={managed} />
      ) : (
        managed === null && <StartYourOwn onStart={() => setCreating(true)} />
      )}
      <SignedIn line={t('noOrganisation.signedInAs', { email: session.email })}>
        <Link className="desk-text" to="/app/account/security">
          {t('noOrganisation.account')}
        </Link>
        <button type="button" className="desk-text" onClick={() => void signOut()}>
          {t('nav.signOut')}
        </button>
      </SignedIn>
      {unreached && <StillSignedIn />}
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
    </div>
  );
}
