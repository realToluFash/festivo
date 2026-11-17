import { keepChange, sampleEvent } from './events.ts';

/** A name as long as an event takes, for `?name=long` on Today, Events and Calendar (sc-57468). */
export const LONG_NAME =
  'Ireti Bankole’s fortieth birthday weekend: dinner at Oslo Hall, a garden party in Hackney and a brunch for all she loves';

export const LONG_NAMED = 'evt-ireti-2';

const SHORT_NAME = 'Ireti at 40';

export function isLong(params: URLSearchParams): boolean {
  return params.get('name') === 'long';
}

/** Gives the sample's Ireti at 40 the long name, or its own back, so Events and Calendar read it from the sample. */
export function nameSample(long: boolean): void {
  const event = sampleEvent(LONG_NAMED);
  const wanted = long ? LONG_NAME : SHORT_NAME;
  if (event == null || event.name === wanted) return;
  if (!long && event.name !== LONG_NAME) return;

  keepChange({ ...event, name: wanted });
}

/** Today's moment with every `from` name replaced, wherever its parts carry it. */
export function renamed<T>(value: T, from: string, to: string): T {
  if (value === from) return to as T;
  if (Array.isArray(value)) return value.map((one: unknown) => renamed(one, from, to)) as T;
  if (
    value != null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, one]) => [key, renamed(one, from, to)]),
    ) as T;
  }

  return value;
}

/** Today, Events and Calendar in a phone's window (sc-57468): open each at 390 or 320 px wide. */
export const PHONE_FIT_PAGES: readonly {
  name: string;
  states: readonly { to: string; name: string }[];
}[] = [
  {
    name: 'Today',
    states: [
      { to: '/demo/today', name: 'This week and Your events' },
      { to: '/demo/today?name=long', name: 'An event name of 120 characters' },
      {
        to: '/demo/today?moment=plan&needs=overdue&name=long',
        name: 'Needs you, an overdue row for an event name of 120 characters',
      },
    ],
  },
  {
    name: 'Events',
    states: [
      { to: '/demo/events', name: 'Upcoming, with Search events and Filter' },
      { to: '/demo/events?state=manyFiltersOpen', name: 'Filter’s menu open, with choices made' },
      { to: '/demo/events?state=filterOpen', name: 'Filter’s Type open' },
      { to: '/demo/events?name=long', name: 'An event name of 120 characters' },
    ],
  },
  {
    name: 'Calendar',
    states: [
      { to: '/demo/calendar', name: 'Month' },
      { to: '/demo/calendar?state=agenda', name: 'Agenda' },
      { to: '/demo/calendar?state=showMenu', name: 'Show’s menu, Events only chosen' },
      { to: '/demo/calendar?state=busyDay', name: 'A day open' },
      {
        to: '/demo/calendar?state=agenda&name=long',
        name: 'Agenda, an event name of 120 characters',
      },
    ],
  },
];
