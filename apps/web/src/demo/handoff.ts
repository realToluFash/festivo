import { AREAS, type Area, sampleEvent } from './events.ts';
import { guestsAt, hasGuests } from './guests.ts';
import { SCHEDULE_EVENT } from './schedule.ts';
import { STATIONS_EVENT } from './stations.ts';

/** The words of sc-55397's handoff, in English; the developer adds es, fr and pt. */
export const HW = {
  line: 'This page is made for a wider window. On a phone or a tablet, it is in the Soirely app.',
  anyway: 'Show this page anyway',
  newEvent: 'New event',
  menu: 'Menu',
  closeMenu: 'Close menu',
  skip: 'Skip to content',
  events: 'Events',
} as const;

export const HANDOFF_EVENT = 'evt-wed-4';

/** 120 characters, the most an event's name takes (sc-55397). */
export const LONGEST_NAME =
  'Adaeze & Tunde’s wedding weekend: Friday’s welcome dinner, Saturday’s ceremony and reception, and Sunday’s family brunch';

export type Handoff =
  | { kind: 'new' }
  | { kind: 'event'; eventId: string; name: string; area: Area | null; page: string };

/** What `/demo/handoff` stands in for: `?state=new`, `no_area` (the run page, which marks no area), `long`, or an area of an event. */
export function handoffOf(params: URLSearchParams): Handoff | null {
  const state = params.get('state');
  if (state === 'new') return { kind: 'new' };

  const eventId = params.get('event') ?? HANDOFF_EVENT;
  const event = sampleEvent(eventId);
  if (event == null) return null;

  const name = state === 'long' ? LONGEST_NAME : event.name;
  if (state === 'no_area') return { kind: 'event', eventId, name, area: null, page: 'run' };

  const area = AREAS.find((one) => one.area === params.get('area'))?.area ?? 'overview';

  return { kind: 'event', eventId, name, area, page: area };
}

export function areaName(area: Area): string {
  return AREAS.find((one) => one.area === area)?.name ?? '';
}

/** Where an area opens in the demo, as the event's sidebar links it. */
export function areaPath(eventId: string, area: Area): string {
  if (area === 'people') return '/demo/people';
  if (area === 'overview') return `/demo/events/${eventId}`;
  if (
    area === 'messages' ||
    area === 'seating' ||
    (area === 'staff' && eventId === STATIONS_EVENT) ||
    (area === 'schedule' && eventId === SCHEDULE_EVENT)
  )
    return `/demo/events/${eventId}/${area}`;
  if (area === 'guests' && hasGuests(eventId)) return guestsAt(eventId);

  return `/demo/events/${eventId}?area=${area}`;
}

/** The page the handoff stands in for: Show this page anyway and a window widened past 640 px open it. */
export function pageOf(handoff: Handoff): string {
  if (handoff.kind === 'new') return '/demo/events/new';
  if (handoff.area == null) return `/demo/events/${handoff.eventId}/${handoff.page}`;

  return areaPath(handoff.eventId, handoff.area);
}

/** The handoff of another area of the same event, as Menu opens it; a long name stays long. */
export function handoffAt(handoff: Handoff, area: Area, params: URLSearchParams): string {
  const query = new URLSearchParams();
  if (handoff.kind === 'event' && handoff.eventId !== HANDOFF_EVENT)
    query.set('event', handoff.eventId);
  if (params.get('state') === 'long') query.set('state', 'long');
  query.set('area', area);

  return `/demo/handoff?${query.toString()}`;
}

let anyway = false;

/** Show this page anyway holds for the tab: in the demo until its home opens again, in the product across reloads. */
export function showAnyway(): void {
  anyway = true;
}

export function shownAnyway(): boolean {
  return anyway;
}

export function forgetAnyway(): void {
  anyway = false;
}

export interface DemoLink {
  to: string;
  name: string;
}

const at = (query: string): string => `/demo/handoff?${query}`;

export const HANDOFF_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'An event’s page at 640 px or narrower (sc-55397): open at 390 or 320 px wide, on a phone or in the browser’s device toolbar; wider, each opens the page itself',
    states: [
      { to: at('state=area&area=seating'), name: 'Seating of the wedding (area)' },
      {
        to: at('state=area&area=overview'),
        name: 'Overview, as All dates and Edit details show it',
      },
      { to: at('state=area&area=guests'), name: 'Guests, the host’s list' },
      { to: at('state=new'), name: 'New event: no event name (new)' },
      { to: at('state=no_area'), name: 'The run page, whose side nav marks no area (no_area)' },
      { to: at('state=long&area=seating'), name: 'A 120-character event name, for 320 px (long)' },
    ],
  },
];
