import type { Load } from '../settings/RolesSample.ts';
import { type OnEvent, PEOPLE_VIEWERS, type PeopleViewer, sampleOnEvent } from './PeopleSample.ts';

export const CARD_TITLE = 'People';
export const CARD_FAILED = 'We couldn’t load who’s on this event.';

export const onThisEvent = (count: number) => `${count} on this event`;
export const leadLine = (name: string) => `Lead · ${name}`;

/** The card's two facts, from the list People shows: everyone on it, and who holds Lead ("You" when it is the viewer). */
export function cardFacts(
  onEvent: readonly OnEvent[],
  viewer: PeopleViewer,
): { count: number; lead: string | null } {
  const lead = onEvent.find((one) => one.role === 'Lead');

  return {
    count: onEvent.length,
    lead: lead == null ? null : lead.id === viewer.id ? 'You' : lead.name,
  };
}

export const CARD_STATES = ['one', 'noLead', 'nobody', 'loading', 'failed', 'readOnly'] as const;
export type CardState = (typeof CARD_STATES)[number];

export function cardStateOf(name: string | undefined): CardState | null {
  return CARD_STATES.find((state) => state === name) ?? null;
}

export interface CardStart {
  viewer: PeopleViewer;
  onEvent: OnEvent[];
  load: Load;
  /** Where the card opens People: the state that shows the same people to the same viewer. */
  href: string;
}

export function cardStart(state: CardState | null): CardStart {
  const onEvent = sampleOnEvent();
  const base: CardStart = {
    viewer: PEOPLE_VIEWERS.julien,
    onEvent,
    load: 'loaded',
    href: '/demo/people',
  };

  switch (state) {
    case null:
      return base;
    case 'one':
      return {
        ...base,
        viewer: PEOPLE_VIEWERS.priya,
        onEvent: onEvent.filter((one) => one.role === 'Lead'),
        href: '/demo/people?state=lead',
      };
    case 'noLead':
      return { ...base, onEvent: onEvent.filter((one) => one.role !== 'Lead') };
    case 'nobody':
      return { ...base, onEvent: [], href: '/demo/people?state=nobody' };
    case 'loading':
    case 'failed':
      return { ...base, load: state };
    case 'readOnly':
      return { ...base, viewer: PEOPLE_VIEWERS.ana, href: '/demo/people?state=readOnly' };
  }
}
