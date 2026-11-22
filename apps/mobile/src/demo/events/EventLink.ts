import { type Session, pick } from '../OrgSwitcherModel.ts';

/** sc-80863: an event's link opened while working in Ire Events. The event is the Casa Lumen Eventos wedding, Folake an Admin there; `same` is one of Ire Events'. */
export const LINK_STATES = ['moved', 'loading', 'failed', 'unavailable', 'same'] as const;
export type LinkState = (typeof LINK_STATES)[number];

export function linkStateOf(value: string | undefined): LinkState | null {
  return LINK_STATES.find((state) => state === value) ?? null;
}

export type Load = 'loading' | 'loaded' | 'failed' | 'unavailable';

export const LOAD_MS = 1600;

export const WORKING_IN = 'org-ire-events';
export const EVENT_IN = 'org-casa-lumen';

export function eventOrgOf(state: LinkState): string {
  return state === 'same' ? WORKING_IN : EVENT_IN;
}

/** What the event's read answers: the first time, and after Try again (`attempt` counts those). */
export function answerOf(state: LinkState, attempt: number): Load {
  if (state === 'loading') return 'loading';
  if (state === 'unavailable') return 'unavailable';
  if (state === 'failed' && attempt === 0) return 'failed';

  return 'loaded';
}

/** The organisation the account moves into: only once the event has loaded, and only when it is not the one being worked in. */
export function moveOf(load: Load, eventOrg: string, current: string | null): string | null {
  return load === 'loaded' && eventOrg !== current ? eventOrg : null;
}

/** The session once the link has moved it: what every screen after it reads, Events included, until the account moves again. */
export function linkMoved(session: Session, id: string): Session {
  return pick(session, id);
}

const BOARD: Record<LinkState, readonly [string, string]> = {
  moved: [
    'Opened from its link · moved',
    'Loading in Ire Events, then Overview in Casa Lumen Eventos with Now working in',
  ],
  loading: ['Opened from its link · loading', 'The event loading, still in Ire Events'],
  failed: [
    'Opened from its link · load failed',
    'Try again, still in Ire Events; once it loads, the move',
  ],
  unavailable: [
    'Opened from its link · not available',
    'This event is not available, Back to Events, still in Ire Events',
  ],
  same: ['Opened from its link · same organisation', 'Overview as today, no notice'],
};

export const LINK_BOARDS: readonly { title: string; what: string; href: string }[] =
  LINK_STATES.map((state) => ({
    title: BOARD[state][0],
    what: BOARD[state][1],
    href: `/demo/events/evt-wed-4?link=${state}`,
  }));
