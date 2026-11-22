import { ApiError, type InvitationPreview, type Membership } from '@soirely/api-client';
import { type InvitationOutcome, invitationRefusal, withManaged } from '@soirely/domain';
import { useEffect, useMemo, useState } from 'react';

import { api } from './api.ts';
import { joinOrganisation, settleInvitation, useSignedIn } from './signedIn.ts';

export interface WaitingInvitations {
  invitations: readonly InvitationPreview[];
  outcomes: Readonly<Record<string, InvitationOutcome>>;
  /** Resolves with what came of it, once the row says so. */
  answer: (
    invitation: InvitationPreview,
    choice: 'accept' | 'decline',
  ) => Promise<InvitationOutcome>;
}

/** The invitations to any verified address of this account, read with the account, so every frame on the stack shows the same ones. A managed one reads as managed only once its Join is refused, as sc-563's You are not in an organisation has it. */
export function useInvitationAnswers(): WaitingInvitations {
  const { invitations, invitationOutcomes } = useSignedIn();

  return {
    invitations,
    outcomes: invitationOutcomes,
    answer: (invitation, choice) =>
      answerInvitation(invitation, choice, settleInvitation, joinOrganisation),
  };
}

/** For the switcher and its openers: one the account cannot accept reads as managed from the moment it is listed, so it is never counted (sc-73668). */
export function useWaitingInvitations(): WaitingInvitations {
  const answers = useInvitationAnswers();
  const { invitations, outcomes } = answers;
  const known = useMemo(() => withManaged(invitations, outcomes), [invitations, outcomes]);

  return { ...answers, outcomes: known };
}

/** Behind the onboarding gate, where the account's organisations cannot be read: the list read once, when `load` is on at first render. */
export function useInvitationsOnOpen(load: boolean): WaitingInvitations & { read: boolean } {
  const [loading] = useState(load);
  const [read, setRead] = useState(!load);
  const [invitations, setInvitations] = useState<readonly InvitationPreview[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, InvitationOutcome>>({});

  useEffect(() => {
    if (!loading) return;

    let live = true;

    api.myInvitations().then(
      (found) => {
        if (!live) return;
        setInvitations(found);
        setRead(true);
      },
      () => {
        if (live) setRead(true);
      },
    );

    return () => {
      live = false;
    };
  }, [loading]);

  const settle = (id: string, outcome: InvitationOutcome): void =>
    setOutcomes((now) => ({ ...now, [id]: outcome }));

  return {
    invitations,
    read,
    outcomes,
    answer: (invitation, choice) => answerInvitation(invitation, choice, settle, () => {}),
  };
}

async function answerInvitation(
  invitation: InvitationPreview,
  choice: 'accept' | 'decline',
  settle: (id: string, outcome: InvitationOutcome) => void,
  joined: (membership: Membership) => void,
): Promise<InvitationOutcome> {
  settle(invitation.id, { kind: 'busy', answer: choice });

  let outcome: InvitationOutcome;

  try {
    if (choice === 'accept') {
      const membership = await api.acceptInvitation(invitation.id);
      joined(membership);
      outcome = { kind: 'accepted', organisationId: membership.id };
    } else {
      await api.declineInvitation(invitation.id);
      outcome = { kind: 'declined' };
    }
  } catch (error) {
    const refusal = error instanceof ApiError ? invitationRefusal((code) => error.is(code)) : null;

    outcome =
      error instanceof ApiError && error.is('domain_managed')
        ? {
            kind: 'managed',
            organisation: error.problem.organisation ?? '',
            message: error.problem.detail ?? '',
          }
        : refusal == null
          ? { kind: 'failed' }
          : { kind: 'refused', refusal };
  }

  settle(invitation.id, outcome);

  return outcome;
}
