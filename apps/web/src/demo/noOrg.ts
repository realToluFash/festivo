import {
  CLOAKROOM,
  BAR,
  DOOR_EVENT_ID,
  DOOR_VENUE,
  EVENT_ENDS,
  EVENT_STARTS,
  type DoorCode,
  clockOf,
  dayOf,
  doorStartOf,
} from './doorCode.ts';
import type { DemoLink } from './settings.ts';

/** An account with no organisation, inside the event it joined by a door code (sc-71, "Decided, 7 Nov 2026 (pm): no organisation at a desk"). */
export const NO_ORG_STATES = ['no-org', 'no-org-check-in', 'no-org-menu'] as const;
export type NoOrgState = (typeof NO_ORG_STATES)[number];

export function noOrgStateOf(name: string | null): NoOrgState | null {
  return NO_ORG_STATES.find((one) => one === name) ?? null;
}

export const NO_ORG = {
  checkIn: 'Check guests in',
  overview: 'Overview',
  guests: 'Guests',
  schedule: 'Schedule',
  seating: 'Seating',
  people: 'People',
  guestsLine: 'Names and replies, no contact details',
  onEvent: (n: number) => `${n} on this event`,
  yourAccount: 'Your account',
  signOut: 'Sign out',
  later: (what: string) => `${what} has its own design.`,
} as const;

export type NoOrgArea = 'checkIn' | 'overview' | 'guests' | 'schedule' | 'seating' | 'people';

/** What a level opens (sc-72): Can view reads the event; Can check guests in has Check guests in first. */
const VIEW_AREAS: readonly NoOrgArea[] = ['overview', 'guests', 'schedule', 'seating', 'people'];

export interface NoOrgStart {
  name: string;
  initials: string;
  tone: number;
  code: DoorCode;
  areas: readonly NoOrgArea[];
  menu: boolean;
  onEvent: number;
}

const JOINED = { lara: ['Lara Monteiro', 'LM', 0], joao: ['João Pereira', 'JP', 4] } as const;

export function noOrgStart(state: NoOrgState): NoOrgStart {
  const checkIn = state === 'no-org-check-in';
  const [name, initials, tone] = checkIn ? JOINED.joao : JOINED.lara;

  return {
    name,
    initials,
    tone,
    code: checkIn ? BAR : CLOAKROOM,
    areas: checkIn ? ['checkIn', ...VIEW_AREAS] : VIEW_AREAS,
    menu: state === 'no-org-menu',
    onEvent:
      doorStartOf({ state: 'code-two', code: null, hold: null, print: null })?.onEvent.length ?? 0,
  };
}

export const whenLine = () =>
  `${dayOf(EVENT_STARTS)} · ${clockOf(EVENT_STARTS)} to ${clockOf(EVENT_ENDS)}`;

export const levelLine = (code: DoorCode) =>
  [code.role, code.label, `until ${clockOf(EVENT_ENDS)}`].filter(Boolean).join(' · ');

export const NO_ORG_VENUE = DOOR_VENUE;

const inside = (state: NoOrgState, name: string): DemoLink => ({
  to: `/demo/events/${DOOR_EVENT_ID}?state=${state}`,
  name,
});

export const NO_ORG_PAGE: { name: string; states: readonly DemoLink[] } = {
  name: 'Inside the event, with no organisation',
  states: [
    inside('no-org', 'Can view, from the Cloakroom code'),
    inside('no-org-check-in', 'Can check guests in, from the Bar and drinks code'),
    inside('no-org-menu', 'The person button: Your account and Sign out'),
  ],
};
