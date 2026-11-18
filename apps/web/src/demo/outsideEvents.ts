import { formattingLocale } from '@soirely/domain';
import { useSyncExternalStore } from 'react';

import { SIDE_AREAS, type SideArea } from '../components/eventSideAreas.ts';
import { meshFor } from '../mesh.ts';

import { DESK_NOW, DOOR_EVENT, DOOR_EVENT_ID, DOOR_VENUE } from './doorCode.ts';
import { noOrgStart } from './noOrg.ts';
import type { DemoLink } from './settings.ts';

export type Level = 'Can view' | 'Can check guests in' | 'Can edit';

/** One of `/me`'s `outsideEvents` (sc-71): its start and end are written in the event's own zone, with its offset. */
export interface OutsideEvent {
  id: string;
  name: string;
  organisationName: string;
  role: Level;
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
  id: DOOR_EVENT_ID,
  name: DOOR_EVENT,
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

/** The API's order: by start, and on the same start the grant made first (E3's before E4's). */
export const OUTSIDE_API: readonly OutsideEvent[] = [E1, E2, E3, E4];

export const VENUES: Readonly<Record<string, string>> = {
  [E1.id]: 'Centro de Congressos do Estoril',
  [E2.id]: DOOR_VENUE,
  [E3.id]: 'Palais de la Bourse, Bordeaux',
  [E4.id]: 'Hôtel de Ville, Bordeaux',
};

const PEOPLE: Readonly<Record<string, number>> = { [E1.id]: 24, [E3.id]: 9, [E4.id]: 6 };

export function onEventOf(id: string): number {
  return PEOPLE[id] ?? noOrgStart('no-org-check-in').onEvent;
}

export const OUTSIDE = {
  yourEvents: 'Your events',
  fromOutside: 'Events from outside',
  yourOrganisations: 'Your organisations',
  underWay: 'Under way',
  here: 'You’re here',
  notFound: 'This event is not available',
  backTo: (name: string) => `Back to ${name}`,
  invitationsLater: 'Invitations have their own design.',
} as const;

export function coverOf(event: OutsideEvent): string {
  return event.id === E2.id ? 'wed' : meshFor(event.id);
}

export function underWay(event: OutsideEvent, now: Date = new Date(DESK_NOW)): boolean {
  const at = now.getTime();

  return Date.parse(event.startsAt) <= at && at < Date.parse(event.endsAt);
}

/** Under way first, then the API's own order, never sorted again. */
export function inOrder(
  events: readonly OutsideEvent[],
  now: Date = new Date(DESK_NOW),
): OutsideEvent[] {
  return [
    ...events.filter((event) => underWay(event, now)),
    ...events.filter((event) => !underWay(event, now)),
  ];
}

export function wallDay(at: string, locale: string = navigator.language): string {
  return new Intl.DateTimeFormat(formattingLocale('en', locale), {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${at.slice(0, 10)}T00:00Z`));
}

export function wallClock(at: string): string {
  return at.slice(11, 16);
}

export function rowLine(event: OutsideEvent, locale?: string): string {
  return `${event.organisationName} · ${wallDay(event.startsAt, locale)} · ${wallClock(event.startsAt)}`;
}

export function rowLabel(event: OutsideEvent, marks: { now: boolean; here: boolean }): string {
  return [
    event.name,
    rowLine(event),
    marks.now ? OUTSIDE.underWay : null,
    marks.here ? OUTSIDE.here : null,
  ]
    .filter((part) => part != null)
    .join('. ');
}

export type OutsideArea = 'checkIn' | Exclude<SideArea, 'budget'>;

const READS: readonly OutsideArea[] = ['overview', 'guests', 'schedule', 'seating', 'people'];

const EDITS: readonly OutsideArea[] = SIDE_AREAS.filter(
  (area): area is Exclude<SideArea, 'budget'> => area !== 'budget',
);

export function areasAt(level: Level): readonly OutsideArea[] {
  if (level === 'Can edit') return EDITS;

  return level === 'Can check guests in' ? ['checkIn', ...READS] : READS;
}

export function whenLine(event: OutsideEvent): string {
  return `${wallDay(event.startsAt)} · ${wallClock(event.startsAt)} to ${wallClock(event.endsAt)}`;
}

export function levelLine(event: OutsideEvent): string {
  return [event.role, event.jobLabel, `until ${wallDay(event.endsAt)}, ${wallClock(event.endsAt)}`]
    .filter((part) => part != null)
    .join(' · ');
}

export const OUTSIDE_STATES = [
  'outside-one',
  'outside-two',
  'outside-several',
  'outside-gone',
  'inside-member',
  'inside-member-one',
] as const;
export type OutsideState = (typeof OUTSIDE_STATES)[number];

/** Opened from a list: the event at `:id`, with the list as it stood; and the not-found page of a grant gone meanwhile. */
export type OutsidePage = OutsideState | 'outside-in' | 'outside-gone-page';

export function outsidePageOf(name: string | null): OutsidePage | null {
  if (name === 'outside-in' || name === 'outside-gone-page') return name;

  return OUTSIDE_STATES.find((one) => one === name) ?? null;
}

export function isOutsideId(id: string | undefined): boolean {
  return OUTSIDE_API.some((event) => event.id === id);
}

export function outsideEvent(id: string | undefined): OutsideEvent {
  return OUTSIDE_API.find((event) => event.id === id) ?? E2;
}

export interface Outside {
  member: boolean;
  /** The list as the last request answered it, in the API's order. */
  held: readonly OutsideEvent[];
  /** Grants that ended or were revoked since: still listed until the next request. */
  gone: readonly string[];
}

export function outsideOf(state: OutsideState): Outside {
  switch (state) {
    case 'outside-one':
      return { member: false, held: [E2], gone: [] };
    case 'outside-two':
      return { member: false, held: [E2, E3], gone: [] };
    case 'outside-several':
      return { member: false, held: OUTSIDE_API, gone: [] };
    case 'outside-gone':
      return { member: false, held: OUTSIDE_API, gone: [E4.id] };
    case 'inside-member':
      return { member: true, held: [E1, E2, E3], gone: [] };
    case 'inside-member-one':
      return { member: true, held: [E2], gone: [] };
  }
}

let outside: Outside = outsideOf('outside-several');
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function useOutside(): Outside {
  return useSyncExternalStore(
    subscribe,
    () => outside,
    () => outside,
  );
}

function set(next: Outside): void {
  outside = next;
  for (const listener of listeners) listener();
}

export function startOutside(state: OutsideState): void {
  outside = outsideOf(state);
}

export function enterFromSwitcher(events: readonly OutsideEvent[]): void {
  set({ member: true, held: events, gone: [] });
}

/** The next request: a gone grant leaves the list. */
export function askAgain(): void {
  set({
    ...outside,
    held: outside.held.filter((event) => !outside.gone.includes(event.id)),
    gone: [],
  });
}

export function openingOf(event: OutsideEvent, from: string, now: Outside = outside): string {
  return now.gone.includes(event.id)
    ? `/demo/events/${event.id}?state=outside-gone-page&from=${from}`
    : `/demo/events/${event.id}?state=outside-in`;
}

const at = (state: OutsideState, name: string, id: string = E2.id): DemoLink => ({
  to: `/demo/events/${id}?state=${state}`,
  name,
});

export const OUTSIDE_PAGE: { name: string; states: readonly DemoLink[] } = {
  name: 'Your events, with no organisation (sc-68438)',
  states: [
    at('outside-one', 'One event: nothing new in the person menu'),
    at('outside-two', 'Two events: Your events, You’re here in its place'),
    at('outside-several', 'Several, one under way first'),
    at('outside-gone', 'Cocktail des partenaires revoked while the menu was open'),
  ],
};

export const OUTSIDE_MEMBER_PAGE: { name: string; states: readonly DemoLink[] } = {
  name: 'A member inside an event from outside (sc-68438)',
  states: [
    at('inside-member', 'Your organisations and Your events'),
    at('inside-member-one', 'One event from outside: Your organisations only'),
  ],
};
