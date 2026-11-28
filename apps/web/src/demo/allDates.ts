import type { DemoLink } from './settings.ts';

/** sc-98187: the dates' own read, as the product's: loading, failed, and failed again on a retry, which is the only failure said aloud. */
export const DATES_LOADS = {
  allDatesLoading: 'loading',
  allDatesFailed: 'failed',
  allDatesFailedAgain: 'failed',
} as const;

export type DatesLoad = 'loading' | 'failed' | 'loaded';

const DATES_AT = '/demo/events/evt-wed-4/dates';

export const ALL_DATES_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'All dates: the page, loading and failed',
    states: [
      { to: DATES_AT, name: 'Every date, earliest first' },
      { to: `${DATES_AT}?state=finalNumbersOverdue`, name: 'A date with its tags and its action' },
      { to: `${DATES_AT}?state=allDatesLoading`, name: 'Loading the dates' },
      {
        to: `${DATES_AT}?state=allDatesFailed`,
        name: 'The dates did not load, Try again loads them',
      },
      {
        to: `${DATES_AT}?state=allDatesFailedAgain`,
        name: 'Try again fails once more, said aloud, then loads',
      },
    ],
  },
];
