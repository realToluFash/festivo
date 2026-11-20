import { type InvitationPreview, primaryEmailAddress } from '@soirely/api-client';
import { formatDay, type InvitationOutcome, invitationWording, roleName } from '@soirely/domain';
import { router } from 'expo-router';
import { type ReactNode, type RefObject, useRef, useState } from 'react';
import type { ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateLocale } from '../i18n/index.ts';
import { type WaitingInvitations, useWaitingInvitations } from '../invitations.ts';
import { DESTINATION_HREF } from '../kit/appNav.ts';
import { invitationRowOf } from '../kit/noOrgInvitations.ts';
import { noOrganisationEnd } from '../kit/orgSwitcher.ts';
import { signOutHere, useSignedIn } from '../signedIn.ts';
import { useOpenJoined, useStartOrganisation } from './AppFrame.tsx';
import { InvitationFailedNotice, InvitationRefusalNotice } from './InvitationNotices.tsx';
import { ManagedBanner } from './ManagedBanner.tsx';
import { NoOrgInvitationList, NoOrgInvitationRow } from './NoOrgInvitations.tsx';
import { NoOrgPage, NoOrgWayOn, SignedInWays, StartYourOwn } from './NoOrganisationParts.tsx';
import type { TextHandle } from './Text.tsx';

/** Where an account in no organisation lands, as `/demo/today?orgs=none` draws it: no header, card or tab bar; any invitation waiting for it, Start your own or sc-563's banner in its place, and Your account beside Sign out (sc-75471). */
export function NoOrganisation({
  titleRef,
  notices,
}: {
  /** For focus to land on once a notice above closes. */
  titleRef?: RefObject<TextHandle | null> | undefined;
  notices?: ReactNode;
} = {}) {
  const { account } = useSignedIn();
  const waiting = useWaitingInvitations();
  const startOrganisation = useStartOrganisation();
  const startButton = useRef<ViewInstance>(null);
  const email = account == null ? '' : (primaryEmailAddress(account) ?? '');
  const end = noOrganisationEnd(startOrganisation?.managed);

  return (
    <NoOrgPage titleRef={titleRef} notices={notices}>
      {waiting.invitations.length > 0 ? (
        <NoOrgInvitationList>
          {waiting.invitations.map((invitation) => (
            <Waiting key={invitation.id} invitation={invitation} waiting={waiting} />
          ))}
        </NoOrgInvitationList>
      ) : (
        <NoOrgWayOn email={email} />
      )}
      {end === 'managed' && startOrganisation?.managed != null && (
        <ManagedBanner
          organisation={startOrganisation.managed.organisation.name}
          message={startOrganisation.managed.message}
          testID="noOrganisation.managed"
        />
      )}
      {end === 'start' && startOrganisation != null && (
        <StartYourOwn startRef={startButton} onStart={() => startOrganisation.open(startButton)} />
      )}
      <SignedInWays
        email={email}
        onAccount={() => router.navigate(DESTINATION_HREF.settings)}
        onSignOut={signOutHere}
      />
    </NoOrgPage>
  );
}

/** One invitation waiting, answered through the API; a refusal or a failed answer reads in the switcher's words. */
function Waiting({
  invitation,
  waiting,
}: {
  invitation: InvitationPreview;
  waiting: WaitingInvitations;
}) {
  const { t } = useTranslation();
  const outcome = waiting.outcomes[invitation.id];
  const keys = invitationWording(invitation);
  const organisation = invitation.organisation.name;
  const inviter = invitation.invitedBy?.name ?? '';
  const role = invitation.role == null ? '' : roleName(t, invitation.role);
  const [answered, setAnswered] = useState<InvitationOutcome | null>(null);
  const openJoined = useOpenJoined();
  const answer = outcome === answered ? outcome : undefined;
  const said =
    outcome?.kind === 'failed' ? (
      <InvitationFailedNotice answer={answer} />
    ) : outcome?.kind === 'managed' ? (
      <ManagedBanner
        organisation={outcome.organisation}
        message={outcome.message}
        testID={`noOrganisation.invitation.${invitation.id}.managed`}
      />
    ) : outcome?.kind === 'refused' ? (
      <InvitationRefusalNotice
        refusal={outcome.refusal}
        organisation={organisation}
        invitation={invitation}
        answer={answer}
      />
    ) : undefined;

  return (
    <NoOrgInvitationRow
      id={invitation.id}
      organisation={organisation}
      role={role}
      line={t(keys.line, { inviter, role })}
      until={t(keys.until, {
        date: formatDay(invitation.expiresAt, dateLocale()),
        email: invitation.email,
      })}
      note={t(keys.declineNote, { inviter })}
      declined={t(keys.declined, { inviter })}
      row={invitationRowOf(outcome)}
      said={said}
      answer={answer}
      onAnswer={(yes) =>
        void waiting.answer(invitation, yes ? 'accept' : 'decline').then(setAnswered)
      }
      onOpen={() => {
        if (outcome?.kind === 'accepted') openJoined?.(outcome.organisationId);
      }}
    />
  );
}
