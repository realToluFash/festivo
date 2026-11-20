import type { InvitationOutcome } from '@soirely/domain';

export interface AnswerButton {
  label: string;
  accessibilityLabel: string;
  off: boolean;
  busy: boolean;
}

export type InvitationRow =
  | { kind: 'joined' }
  | { kind: 'declined' }
  | { kind: 'refused' }
  | { kind: 'answers'; accept: AnswerButton; decline: AnswerButton };

/** A declined one keeps its row with the notice; while either answer is in flight both are off and the pressed one says what it is doing (sc-75471). */
export function invitationRowOf(outcome: InvitationOutcome | undefined): InvitationRow {
  if (outcome?.kind === 'accepted') return { kind: 'joined' };
  if (outcome?.kind === 'declined') return { kind: 'declined' };
  if (outcome?.kind === 'refused' || outcome?.kind === 'managed') return { kind: 'refused' };
  const busy = outcome?.kind === 'busy' ? outcome.answer : null;

  return {
    kind: 'answers',
    accept: {
      label: busy === 'accept' ? 'invitations.joining' : 'invitations.accept',
      accessibilityLabel: busy === 'accept' ? 'invitations.joining' : 'invitations.acceptLabel',
      off: busy != null,
      busy: busy === 'accept',
    },
    decline: {
      label: busy === 'decline' ? 'invitations.declining' : 'invitations.decline',
      accessibilityLabel: busy === 'decline' ? 'invitations.declining' : 'invitations.declineLabel',
      off: busy != null,
      busy: busy === 'decline',
    },
  };
}

/** The way-on line shows only with nothing waiting; the invitations take its place. */
export function wayOnShows(invitations: readonly unknown[]): boolean {
  return invitations.length === 0;
}

export const NO_ORG_IDS = {
  list: 'noOrganisation.invitations',
  row: (id: string) => `noOrganisation.invitation.${id}`,
  accept: (id: string) => `noOrganisation.invitation.${id}.accept`,
  decline: (id: string) => `noOrganisation.invitation.${id}.decline`,
  open: (id: string) => `noOrganisation.invitation.${id}.open`,
};
