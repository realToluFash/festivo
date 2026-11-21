import { ApiError, type InvitationPreview } from '@soirely/api-client';
import { type InvitationOutcome, invitationRefusal, withManaged } from '@soirely/domain';
import { useEffect, useMemo, useState } from 'react';

import { api } from './api.ts';
import { joinOrganisation } from './session.ts';

export interface WaitingInvitations {
  invitations: readonly InvitationPreview[];
  outcomes: Readonly<Record<string, InvitationOutcome>>;
  /** The organisation of the first invitation accepted this visit, set in the same update as its outcome. */
  firstJoined: string | null;
  /** Resolves with what came of it, once the row says so. */
  answer: (
    invitation: InvitationPreview,
    choice: 'accept' | 'decline',
  ) => Promise<InvitationOutcome>;
}

/** The invitations to any verified address of this account, read once per visit (`GET /api/invitations`), and only when `load` is on at first render. A managed one reads as managed only once its Join is refused, as sc-563's screens have it. */
export function useInvitationAnswers(load = true): WaitingInvitations {
  const [loading] = useState(load);
  const [invitations, setInvitations] = useState<readonly InvitationPreview[]>([]);
  const [outcomes, setOutcomes] = useState<Record<string, InvitationOutcome>>({});
  const [firstJoined, setFirstJoined] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) return;

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
  }, [loading]);

  const settle = (id: string, outcome: InvitationOutcome): void => {
    setOutcomes((now) => ({ ...now, [id]: outcome }));
    if (outcome.kind === 'accepted') setFirstJoined((first) => first ?? outcome.organisationId);
  };

  async function answer(
    invitation: InvitationPreview,
    choice: 'accept' | 'decline',
  ): Promise<InvitationOutcome> {
    settle(invitation.id, { kind: 'busy', answer: choice });

    let outcome: InvitationOutcome;

    try {
      if (choice === 'accept') {
        const membership = await api.acceptInvitation(invitation.id);
        joinOrganisation(membership);
        outcome = { kind: 'accepted', organisationId: membership.id };
      } else {
        await api.declineInvitation(invitation.id);
        outcome = { kind: 'declined' };
      }
    } catch (error) {
      const refusal =
        error instanceof ApiError ? invitationRefusal((code) => error.is(code)) : null;

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

  return { invitations, outcomes, firstJoined, answer };
}

/** For the switcher and its openers: one the account cannot accept reads as managed from the moment it is listed, so it is never counted (sc-73668). */
export function useWaitingInvitations(): WaitingInvitations {
  const answers = useInvitationAnswers();
  const { invitations, outcomes } = answers;
  const known = useMemo(() => withManaged(invitations, outcomes), [invitations, outcomes]);

  return { ...answers, outcomes: known };
}
