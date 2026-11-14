import type { EventPhase } from './eventStates.ts';
import type { MemberState } from './members.ts';

export type StatusTone = 'accent' | 'attention' | 'paused' | 'neutral';

/** The shape beside a status chip's word, so a state never rests on colour alone (WCAG 2.2, 1.4.1). */
export type StatusShape = 'ring' | 'dot' | 'half' | 'bars' | 'tick';

export interface StatusLook {
  tone: StatusTone;
  shape: StatusShape;
}

export const PHASE_LOOK: Record<EventPhase, StatusLook> = {
  draft: { tone: 'neutral', shape: 'ring' },
  live: { tone: 'accent', shape: 'dot' },
  happening_now: { tone: 'attention', shape: 'half' },
  paused: { tone: 'paused', shape: 'bars' },
  finished: { tone: 'neutral', shape: 'tick' },
};

const MEMBER_LOOK: Record<MemberState, StatusLook> = {
  active: { tone: 'accent', shape: 'dot' },
  pending_approval: { tone: 'attention', shape: 'half' },
  suspended: { tone: 'neutral', shape: 'bars' },
  left_or_removed: { tone: 'neutral', shape: 'ring' },
};

export function memberStatusLook(member: { status: MemberState }): StatusLook {
  return MEMBER_LOOK[member.status];
}

export type InvitationState = 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';

export const INVITATION_LOOK: Record<InvitationState, StatusLook> = {
  pending: { tone: 'attention', shape: 'half' },
  accepted: { tone: 'accent', shape: 'tick' },
  declined: { tone: 'neutral', shape: 'ring' },
  revoked: { tone: 'neutral', shape: 'ring' },
  expired: { tone: 'neutral', shape: 'ring' },
};
