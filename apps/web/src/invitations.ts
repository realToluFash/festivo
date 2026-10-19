import { ApiError, type InvitationPreview } from '@soirely/api-client';
import { type InvitationOutcome, invitationRefusal } from '@soirely/domain';
import { useEffect, useState } from 'react';

import { api } from './api.ts';
import { joinOrganisation } from './session.ts';

export interface WaitingInvitations {
  invitations: readonly InvitationPreview[];
  outcomes: Readonly<Record<string, InvitationOutcome>>;
  answer: (invitation: InvitationPreview, choice: 'accept' | 'decline') => Promise<void>;
}

/** The invitations to any verified address of this account, read once per visit (`GET /api/invitations`). */
export function useWaitingInvitations(): WaitingInvitations {
  const [invitations, setInvitations] = useState<readonly InvitationPreview[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, InvitationOutcome>>({});

  useEffect(() => {
    let live = true;

    api.myInvitations().then(
      (found) => {
        if (live) setInvitations(found);
      },
      () => {},
    );

    return () => {
      live = false;
    };
  }, []);

  const settle = (id: string, outcome: InvitationOutcome): void =>
    setOutcomes((now) => ({ ...now, [id]: outcome }));

  async function answer(
    invitation: InvitationPreview,
    choice: 'accept' | 'decline',
  ): Promise<void> {
    settle(invitation.id, { kind: 'busy', answer: choice });

    try {
      if (choice === 'accept') {
        const membership = await api.acceptInvitation(invitation.id);
        joinOrganisation(membership);
        settle(invitation.id, { kind: 'accepted', organisationId: membership.id });
      } else {
        await api.declineInvitation(invitation.id);
        settle(invitation.id, { kind: 'declined' });
      }
    } catch (error) {
      const refusal =
        error instanceof ApiError ? invitationRefusal((code) => error.is(code)) : null;

      settle(invitation.id, refusal == null ? { kind: 'failed' } : { kind: 'refused', refusal });
    }
  }

  return { invitations, outcomes, answer };
}
