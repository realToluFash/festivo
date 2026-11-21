import { writtenTime } from './clock.ts';
import { LIVE_MARKS, type Mark, guestProgramme, laterBy } from './guestProgramme.ts';
import { type Item, MAIN, dayOf, placeOf, sampleItems } from './schedule.ts';
import type { DemoLink } from './settings.ts';

export const SCREEN_EVENT = 'Adaeze & Tunde’s wedding';
export const SCREEN_PLACES = [MAIN, 'Garden', 'Ballroom'] as const;
export type ScreenPlace = (typeof SCREEN_PLACES)[number];
export const SCREEN_START = '2026-11-06T17:25';
const COMING_UP = 3;

/** One item as the screen's token endpoint answers it: a title and a start, never owner, note, length, planned time or lateness. */
export interface ScreenItem {
  id: string;
  title: string;
  startsAt: string;
}

/** Now shows no time, so its answer carries none. */
export type NowItem = Pick<ScreenItem, 'id' | 'title'>;

/** The screen's whole response. Each kind carries only what its screen shows. */
export type ScreenAnswer =
  | { kind: 'live'; event: string; now: NowItem | null; coming: readonly ScreenItem[] }
  | { kind: 'nothingLeft'; event: string }
  | { kind: 'finished'; event: string }
  | { kind: 'replaced' };

export interface ScreenWorld {
  items: readonly Item[];
  marks: Readonly<Record<string, Mark>>;
  at: string;
  finished: boolean;
  replaced: boolean;
}

/** The night's sample with Speeches and Dancing shown to guests too, so the Ballroom has more than three still to come. */
export function screenItems(): Item[] {
  return sampleItems().map((one) =>
    one.id === 'speeches' || one.id === 'dancing' ? { ...one, guests: true } : one,
  );
}

function runningAt(mark: Mark | undefined, at: string): boolean {
  return mark != null && mark.started <= at && (mark.ended == null || mark.ended > at);
}

/** sc-3897's projection: the place's running item and its next three, on sc-3899's guest programme, rounded down to 5 minutes. */
export function roomScreen(world: ScreenWorld, place: ScreenPlace): ScreenAnswer {
  if (world.replaced) return { kind: 'replaced' };
  if (world.finished) return { kind: 'finished', event: SCREEN_EVENT };

  const here = world.items.filter((one) => placeOf(one) === place);
  const shown = guestProgramme(here, { at: world.at, marks: world.marks });
  const today = dayOf(world.at);
  const running = shown.find((one) => runningAt(world.marks[one.id], world.at)) ?? null;
  const coming = shown
    .filter((one) => world.marks[one.id] == null && one.day >= today)
    .slice(0, COMING_UP);

  if (running == null && coming.length === 0) return { kind: 'nothingLeft', event: SCREEN_EVENT };

  const bare = (one: (typeof shown)[number]): ScreenItem => ({
    id: one.id,
    title: one.title,
    startsAt: one.startsAt,
  });

  return {
    kind: 'live',
    event: SCREEN_EVENT,
    now: running && { id: running.id, title: running.title },
    coming: coming.map(bare),
  };
}

/** Every time on the room screen is on the 24-hour clock, in every locale (Reversed, 15 Nov 2026). */
export function screenTime(wall: string, locale: string): string {
  return writtenTime(wall, locale);
}

export const SCREEN_WORDS = {
  now: 'Now',
  comingUp: 'Coming up',
  asOf: (time: string) => `Times as of ${time}`,
  replaced: 'This screen link has been replaced',
  thanks: 'Thank you for coming',
  fullScreen: 'Full screen',
} as const;

export const SHOW_WORDS = {
  open: 'Show on a screen',
  title: 'Show on a screen',
  line: 'One link for each place. Open it in the browser on the TV or projector there. It needs no sign-in, and shows only what guests see.',
  copy: 'Copy screen link',
  openHere: 'Open here',
  replace: 'Replace link',
  close: 'Close',
  copied: (place: string) => `Screen link for ${place} copied.`,
  copyRefused: (place: string) =>
    `Could not copy here. The link for ${place} is selected: press Ctrl+C or Command+C.`,
  replaceTitle: (place: string) => `Replace the screen link for ${place}?`,
  replaceBody:
    'A screen showing the old link stops within a minute and shows that its link was replaced, with nothing about the event on it. Copy the new link to that screen.',
  keep: 'Keep this link',
  replacedAt: (time: string) => `Replaced at ${time}. The old link shows nothing.`,
  replacedSaid: (place: string) => `Screen link for ${place} replaced.`,
  notReplaced: (place: string) =>
    `The link for ${place} was not replaced, so the old link still works. Try again.`,
  loading: 'Loading the screen links…',
  notLoaded: 'The screen links did not load.',
  tryAgain: 'Try again',
} as const;

/** The 128-bit token stands in as a fixed sample; the product mints it on the server. */
export function screenLinkOf(place: ScreenPlace, round = 0): string {
  const tokens: Record<ScreenPlace, string> = {
    Main: 'q7N2vK9xL4mB8cR1tW6yZ3',
    Garden: 'h5D8sF2jP9aG4kX7nV1bM6',
    Ballroom: 'w3E6rT9yU2iO5pA8sD1fG4',
  };

  return `https://soirely.app/s/${round === 0 ? tokens[place] : `${tokens[place].slice(0, 18)}r${round}`}`;
}

export type ScreenStateName = keyof typeof SCREEN_STATES;

interface ScreenStart {
  name: string;
  place: ScreenPlace;
  marks: Readonly<Record<string, Mark>>;
  moved: number;
  offline: boolean;
  finished: boolean;
  replaced: boolean;
  projector: boolean;
  connecting: boolean;
}

const BETWEEN: Readonly<Record<string, Mark>> = {
  ...LIVE_MARKS,
  entrance: { started: '2026-11-06T17:24', ended: '2026-11-06T17:38' },
};

function at(over: Partial<ScreenStart> & { name: string }): ScreenStart {
  return {
    place: 'Ballroom',
    marks: LIVE_MARKS,
    moved: 0,
    offline: false,
    finished: false,
    replaced: false,
    projector: false,
    connecting: false,
    ...over,
  };
}

export const SCREEN_STATES = {
  now: at({ name: 'Ballroom at 17:25: Now and Coming up, three items' }),
  connecting: at({
    name: 'Before its first answer: the blank field and Full screen, asking every 10 s',
    connecting: true,
  }),
  between: at({
    name: 'Between items: Grand entrance done, Dinner not started, no Now',
    marks: BETWEEN,
    moved: 15,
  }),
  overrun: at({
    name: 'Grand entrance runs past its 15 minutes with no press: the times caught up',
    moved: 25,
  }),
  offline: at({ name: 'Offline: the last state stays, Times as of 17:25', offline: true }),
  nothingLeft: at({ name: 'Garden, nothing left to show: the event’s name only', place: 'Garden' }),
  replaced: at({ name: 'The link was replaced: no event details', replaced: true }),
  finished: at({ name: 'After Finished: Thank you for coming', finished: true }),
  projector: at({ name: 'A 4:3 projector: Now above Coming up', projector: true }),
  projectorOffline: at({
    name: 'A 4:3 projector, offline',
    projector: true,
    offline: true,
  }),
} satisfies Record<string, ScreenStart>;

export function screenStart(raw: string | null): ScreenStart {
  return raw != null && Object.hasOwn(SCREEN_STATES, raw)
    ? SCREEN_STATES[raw as ScreenStateName]
    : SCREEN_STATES.now;
}

export function placeOfRaw(raw: string | undefined): ScreenPlace | null {
  return SCREEN_PLACES.find((one) => one.toLowerCase() === raw) ?? null;
}

export function screenAt(place: ScreenPlace, state?: ScreenStateName): string {
  return `/demo/screen/${place.toLowerCase()}${state == null ? '' : `?state=${state}`}`;
}

export function clockAt(moved: number): string {
  return laterBy(SCREEN_START, moved);
}

export const SCREEN_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The room screen at 1920 × 1080 (open it full screen; it scales with the width)',
    states: (Object.keys(SCREEN_STATES) as ScreenStateName[]).map((state) => ({
      to: screenAt(SCREEN_STATES[state].place, state),
      name: SCREEN_STATES[state].name,
    })),
  },
];
