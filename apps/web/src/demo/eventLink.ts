import type { DemoLink } from './settings.ts';

/** sc-80863: an event's link opened at a desk while working in Ire Events. The event is the Casa Lumen Eventos wedding, Folake an Admin there; `same` is one of Ire Events'. */
export const LINK_STATES = ['moved', 'loading', 'failed', 'unavailable', 'same'] as const;
export type LinkState = (typeof LINK_STATES)[number];

export function linkStateOf(value: string | null): LinkState | null {
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
export function moveOf(load: Load, eventOrg: string, current: string): string | null {
  return load === 'loaded' && eventOrg !== current ? eventOrg : null;
}

const WHAT: Record<LinkState, string> = {
  moved: 'Moved: loading in Ire Events, then Overview in Casa Lumen Eventos with Now working in',
  loading: 'Loading: the event loading, still in Ire Events',
  failed: 'Load failed: Try again, still in Ire Events; once it loads, the move',
  unavailable: 'Not available: the Events crumb back, still in Ire Events',
  same: 'Same organisation: Overview as today, no notice',
};

export const LINK_PAGE: { name: string; states: readonly DemoLink[] } = {
  name: 'An event’s link from another organisation (sc-80863)',
  states: LINK_STATES.map((state) => ({
    to: `/demo/events/evt-wed-4?state=${state}`,
    name: WHAT[state],
  })),
};
