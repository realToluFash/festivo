import { EMPTY_TITLE, type PeopleState, peopleStart } from './PeopleSample.ts';

export const PEOPLE_TITLE = 'People';
export const ON_THIS_EVENT = 'on this event';
export const CARD_FAILED = 'We couldn’t load who’s on this event.';
export const OPENS_PEOPLE = 'Opens People';

/** The card's states: each loaded one is a People state, and the card opens People on it. */
export const CARD_STATES = [
  'people',
  'alone',
  'noLead',
  'nobody',
  'readOnly',
  'loading',
  'failed',
] as const satisfies readonly (PeopleState | 'loading' | 'failed')[];
export type CardState = (typeof CARD_STATES)[number];
export type LoadedCard = Exclude<CardState, 'loading' | 'failed'>;

export function cardStateOf(value: string | undefined): CardState | null {
  return CARD_STATES.find((state) => state === value) ?? null;
}

export interface CardSays {
  title: string;
  line: string | null;
  label: string;
  href: string;
}

/** What the card says, from the same list People opens on: how many are on it, and who leads it. */
export function cardSays(state: LoadedCard): CardSays {
  const { onEvent, viewer } = peopleStart(state);
  const lead = onEvent.find((one) => one.role === 'Lead');
  const you = lead != null && lead.id === viewer.id;
  const title = onEvent.length === 0 ? EMPTY_TITLE : `${onEvent.length} ${ON_THIS_EVENT}`;
  const line = lead == null ? null : `Lead · ${you ? 'You' : lead.name}`;
  const said = lead == null ? null : you ? 'You lead it.' : `Lead, ${lead.name}.`;

  return {
    title,
    line,
    label: [onEvent.length === 0 ? title : `${title}.`, said, `${OPENS_PEOPLE}.`]
      .filter((part) => part != null)
      .join(' '),
    href: state === 'people' ? '/demo/people' : `/demo/people?state=${state}`,
  };
}
