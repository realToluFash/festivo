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

export const CARD_STATES = [
  'one',
  'noLead',
  'nobody',
  'loading',
  'failed',
  'readOnly',
  'long',
] as const;

/** A Lead's name long enough to wrap under the count, as French and Portuguese lines will. */
export const LONG_LEAD = 'Maria Fernanda Albuquerque Gonçalves';
export type CardState = (typeof CARD_STATES)[number];

export function cardStateOf(name: string | undefined): CardState | null {
  return CARD_STATES.find((state) => state === name) ?? null;
}

export interface CardStart {
  viewer: PeopleViewer;
  onEvent: OnEvent[];
  load: Load;
  /** The People state the card opens: the one that shows the same people to the same viewer. */
  opens: string | null;
}

export function cardStart(state: CardState | null): CardStart {
  const onEvent = sampleOnEvent();
  const base: CardStart = {
    viewer: PEOPLE_VIEWERS.julien,
    onEvent,
    load: 'loaded',
    opens: null,
  };

  switch (state) {
    case null:
      return base;
    case 'one':
      return {
        ...base,
        viewer: PEOPLE_VIEWERS.priya,
        onEvent: onEvent.filter((one) => one.role === 'Lead'),
        opens: 'lead',
      };
    case 'noLead':
      return { ...base, onEvent: onEvent.filter((one) => one.role !== 'Lead') };
    case 'nobody':
      return { ...base, onEvent: [], opens: 'nobody' };
    case 'loading':
    case 'failed':
      return { ...base, load: state };
    case 'readOnly':
      return { ...base, viewer: PEOPLE_VIEWERS.ana, opens: 'readOnly' };
    case 'long':
      return {
        ...base,
        onEvent: onEvent.map((one) => (one.role === 'Lead' ? { ...one, name: LONG_LEAD } : one)),
      };
  }
}
