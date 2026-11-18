import { type CodeChoice, EVENT } from '../doorCode/DoorCodeModel.ts';
import { type Invite, type Place, sessionFor, VIEWER } from '../OrgSwitcherModel.ts';

/** `/me`'s `outsideEvents` entry (sc-71): its times in the event's own zone, with the offset. */
export interface OutsideEvent {
  id: string;
  name: string;
  organisationName: string;
  role: CodeChoice;
  jobLabel: string | null;
  startsAt: string;
  endsAt: string;
}

export const E1: OutsideEvent = {
  id: 'evt-congresso-enfermagem',
  name: 'Congresso Nacional de Enfermagem Perioperatória, dia de abertura',
  organisationName: 'Associação Portuguesa de Congressos e Celebrações Corporativas',
  role: 'Can check guests in',
  jobLabel: 'Acreditação',
  startsAt: '2026-11-07T08:30:00+00:00',
  endsAt: '2026-11-07T19:00:00+00:00',
};

export const E2: OutsideEvent = {
  id: EVENT.id,
  name: EVENT.name,
  organisationName: 'Lumen Feiras',
  role: 'Can check guests in',
  jobLabel: 'Bar and drinks',
  startsAt: '2026-11-14T15:00:00+00:00',
  endsAt: '2026-11-14T23:30:00+00:00',
};

export const E3: OutsideEvent = {
  id: 'evt-gala-beaux-arts',
  name: 'Soirée de gala de la Fondation des Amis du Musée des Beaux-Arts',
  organisationName: 'Les Salons de la Bastide Réceptions et Événements',
  role: 'Can view',
  jobLabel: null,
  startsAt: '2026-11-21T19:30:00+01:00',
  endsAt: '2026-11-22T01:00:00+01:00',
};

export const E4: OutsideEvent = {
  id: 'evt-cocktail-partenaires',
  name: 'Cocktail des partenaires',
  organisationName: 'Traiteur Marceau & Fils',
  role: 'Can edit',
  jobLabel: null,
  startsAt: '2026-11-21T19:30:00+01:00',
  endsAt: '2026-11-21T23:00:00+01:00',
};

/** Where each event is, for its card: demo sample, not in `outsideEvents`. */
export const VENUES: Readonly<Record<string, string>> = {
  [E1.id]: 'Centro de Congressos de Lisboa',
  [E2.id]: EVENT.venue,
  [E3.id]: 'Musée des Beaux-Arts, Bordeaux',
  [E4.id]: 'Hangar 14, Bordeaux',
};

/** The demo's now, 7 Nov 09:41 in Lisbon, as an instant. */
export const NOW = new Date('2026-11-07T09:41:00+00:00');

export function underWay(event: OutsideEvent, now: Date): boolean {
  const at = now.getTime();

  return Date.parse(event.startsAt) <= at && at < Date.parse(event.endsAt);
}

/** Under way first, then the API's own order, never sorted again. */
export function inOrder(events: readonly OutsideEvent[], now: Date): OutsideEvent[] {
  return [
    ...events.filter((event) => underWay(event, now)),
    ...events.filter((event) => !underWay(event, now)),
  ];
}

export function wallDay(at: string): string {
  return at.slice(0, 10);
}

export function wallTime(at: string): string {
  return at.slice(11, 16);
}

export function dayIn(at: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${wallDay(at)}T00:00Z`));
}

export function rowLine(event: OutsideEvent, locale: string): string {
  return `${event.organisationName} · ${dayIn(event.startsAt, locale)} · ${wallTime(event.startsAt)}`;
}

export const WORDS = {
  yourEvents: 'Your events',
  fromOutside: 'Events from outside',
  yourOrganisations: 'Your organisations',
  underWay: 'Under way',
  here: 'You’re here',
} as const;

export function rowLabel(
  event: OutsideEvent,
  locale: string,
  marks: { underWay: boolean; here: boolean },
): string {
  return [
    event.name,
    rowLine(event, locale),
    marks.underWay ? WORDS.underWay : null,
    marks.here ? WORDS.here : null,
  ]
    .filter((part) => part != null)
    .join('. ');
}

export function backTo(name: string): string {
  return `Back to ${name}`;
}

export const OUTSIDE_STATES = [
  'one',
  'two',
  'several',
  'gone',
  'switcher-outside',
  'switcher-outside-one-org',
  'inside-member',
  'inside-member-one',
] as const;
export type OutsideState = (typeof OUTSIDE_STATES)[number];

export function outsideStateOf(param: string | undefined): OutsideState {
  return OUTSIDE_STATES.find((state) => state === param) ?? 'several';
}

export const JOAO = 'João Pereira';
export const MEMBER = VIEWER.name;

const POPULATED = sessionFor('populated');
const ONE = sessionFor('one');

export interface Outside {
  member: boolean;
  /** The live grants, in the API's order. */
  events: readonly OutsideEvent[];
  /** Grants ended or revoked while the list was open: still listed until the next request. */
  revoked: readonly string[];
  /** The event the person is inside; none while the switcher is open. */
  here: string | null;
  places: readonly Place[];
  current: string;
  invitations: readonly Invite[];
}

export function outsideOf(state: OutsideState): Outside {
  const joao: Outside = {
    member: false,
    events: [E1, E2, E3, E4],
    revoked: [],
    here: E2.id,
    places: [],
    current: '',
    invitations: [],
  };
  const member: Outside = {
    member: true,
    events: [E1, E2, E3],
    revoked: [],
    here: E2.id,
    places: POPULATED.places,
    current: POPULATED.current,
    invitations: POPULATED.invitations,
  };

  switch (state) {
    case 'one':
      return { ...joao, events: [E2] };
    case 'two':
      return { ...joao, events: [E2, E3] };
    case 'several':
      return joao;
    case 'gone':
      return { ...joao, revoked: [E4.id] };
    case 'switcher-outside':
      return { ...member, here: null };
    case 'switcher-outside-one-org':
      return { ...member, events: [E2], here: null, places: ONE.places, invitations: [] };
    case 'inside-member':
      return member;
    case 'inside-member-one':
      return { ...member, events: [E2] };
  }
}

/** The next request after the not-found page: the grant that ended is gone from the list. */
export function afterRequest(outside: Outside): Outside {
  return {
    ...outside,
    events: outside.events.filter((event) => !outside.revoked.includes(event.id)),
    revoked: [],
  };
}

export type Choice =
  | { kind: 'close' }
  | { kind: 'open'; event: OutsideEvent }
  | { kind: 'notFound'; event: OutsideEvent };

export function choose(outside: Outside, event: OutsideEvent): Choice {
  if (outside.revoked.includes(event.id)) return { kind: 'notFound', event };

  return event.id === outside.here ? { kind: 'close' } : { kind: 'open', event };
}

export function listsEvents(outside: Outside): boolean {
  return outside.events.length >= 2;
}

export function hereEvent(outside: Outside): OutsideEvent | null {
  return outside.events.find((event) => event.id === outside.here) ?? null;
}

const BOARD: Record<OutsideState, readonly [string, string]> = {
  one: ['No organisation · one event', 'E2 only: More as today, no group'],
  two: ['No organisation · two events', 'Your events: Joana & Rui’s wedding here, the gala'],
  several: [
    'No organisation · several',
    'The congress under way first, the wedding keeps its place',
  ],
  gone: ['No organisation · a grant gone', 'The cocktail opens not available, back drops it'],
  'switcher-outside': ['Member · the switcher', 'Organisations, Events from outside, invitations'],
  'switcher-outside-one-org': ['Member · one organisation', 'Ire Events, one event from outside'],
  'inside-member': ['Member · inside the wedding', 'More: Your organisations, then Your events'],
  'inside-member-one': ['Member · inside, one event', 'More: Your organisations only'],
};

export const OUTSIDE_BOARDS: readonly { title: string; what: string; href: string }[] =
  OUTSIDE_STATES.map((state) => ({
    title: BOARD[state][0],
    what: BOARD[state][1],
    href: `/demo/outside-events?state=${state}`,
  }));
