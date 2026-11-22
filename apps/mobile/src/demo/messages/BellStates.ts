import type { NotificationCategory } from '@soirely/api-client';

/** The demo home's group for the bell, named as the web's is. */
export const BELL_GROUP = 'The bell (sc-83081)';

/** The bell's states in the B frame (sc-83081), each a `?state=` beside `bell`, the same keys as the web's. */
export const BELL_STATES = [
  'bellPush',
  'bellLoading',
  'bellFailed',
  'bellEmpty',
  'bellMore',
  'bellMoreFailed',
  'bellMute',
  'bellMuted',
  'bellGone',
  'bellOffline',
  'bellRefreshing',
  'bellUnknown',
] as const;

export type BellState = 'bell' | (typeof BELL_STATES)[number];

export const BELL_BOARDS: Record<(typeof BELL_STATES)[number], readonly [string, string]> = {
  bellPush: ['the bell · turn on push?', 'Turn on or Not now, above the items'],
  bellLoading: ['the bell · loading', 'Three quiet rows, each with its mark'],
  bellFailed: ['the bell · did not load', 'Your notifications did not load. Try again'],
  bellEmpty: ['the bell · nothing yet', 'Replies, changes and reminders show up here'],
  bellMore: ['the bell · show more', 'Two older items under Show more'],
  bellMoreFailed: ['the bell · more did not load', 'Show more, and Try again in a moment'],
  bellMute: ['the bell · an item’s more', 'Mute this event, its switch and its word'],
  bellMuted: ['the bell · a muted event', 'Today’s replies marked Muted, the older items not'],
  bellGone: ['the bell · an event that has gone', 'This event is no longer available.'],
  bellOffline: ['the bell · offline', 'Offline · as of 09:40, with Try again'],
  bellRefreshing: ['the bell · refreshing', 'Refreshing… beside the title, the band kept'],
  bellUnknown: ['the bell · a category this app does not know', 'The plain bell, Unread and Muted'],
};

/** The sample's category from a server newer than the app (sc-84143). */
export const UNKNOWN_CATEGORY = 'venue_news' as const;

export type More = 'none' | 'idle' | 'loading' | 'failed' | 'shown';

export interface BellStart {
  feed: 'loading' | 'failed' | 'loaded';
  empty: boolean;
  more: More;
  asking: boolean;
  menu: string | null;
  /** Mute this event's switch as it opens; flipping it marks no item already shown. */
  muted: boolean;
  /** The items delivered after the event was muted, each marked Muted when it arrived (sc-3980). */
  marked: readonly string[];
  /** The item whose event has gone is listed, its line showing as after a tap. */
  gone: boolean;
  offline: 'none' | 'band' | 'refreshing';
  /** An unread item of a category the client does not know, on the muted event. */
  unknown: boolean;
}

const REST: BellStart = {
  feed: 'loaded',
  empty: false,
  more: 'none',
  asking: false,
  menu: null,
  muted: false,
  marked: [],
  gone: false,
  offline: 'none',
  unknown: false,
};

export function bellStartOf(state: BellState): BellStart {
  switch (state) {
    case 'bellPush':
      return { ...REST, asking: true };
    case 'bellLoading':
      return { ...REST, feed: 'loading' };
    case 'bellFailed':
      return { ...REST, feed: 'failed' };
    case 'bellEmpty':
      return { ...REST, empty: true };
    case 'bellMore':
      return { ...REST, more: 'idle' };
    case 'bellMoreFailed':
      return { ...REST, more: 'failed' };
    case 'bellMute':
      return { ...REST, menu: 'missed' };
    case 'bellMuted':
      return { ...REST, muted: true, marked: ['replies'] };
    case 'bellGone':
      return { ...REST, gone: true };
    case 'bellOffline':
      return { ...REST, offline: 'band' };
    case 'bellRefreshing':
      return { ...REST, offline: 'refreshing' };
    case 'bellUnknown':
      return { ...REST, unknown: true, muted: true, marked: ['unknown'] };
    case 'bell':
      return REST;
  }
}

export function isBellState(state: string | null | undefined): state is BellState {
  return state === 'bell' || BELL_STATES.some((one) => one === state);
}

export const GONE_EVENT = 'Leila’s 40th';
export const OLDER_COUNT = 2;
export const BUSY_MS = 900;

export const BW = {
  moreShown: (count: number) => `${count} more notifications shown.`,
  more: (title: string, event: string) => `More for ${title}, ${event}`,
  paused: 'Ana Souza paused the event',
  live: 'Ana Souza made the event live',
  deleted: 'Ana Souza deleted the event',
  overdue: (event: string) => `1 payment overdue on ${event}`,
  due: (event: string) => `2 payments due in the next 7 days on ${event}`,
  signIn: 'New sign-in to Soirely',
  unknown: 'Ana Souza added a note to the event',
};

/** The categories Mute this event never holds, as the API's NotificationCategory::heldByMute; any other, one this app does not know included, it holds. */
export const NEVER_HELD_BY_MUTE: ReadonlySet<NotificationCategory> = new Set([
  'event_day',
  'account_security',
]);

/** An item is marked Muted when it arrived after the mute, in a category the mute holds; the switch re-marks nothing shown. */
export function mutedOf(
  start: BellStart,
  item: { key: string; category: NotificationCategory | typeof UNKNOWN_CATEGORY },
): boolean {
  if (!start.marked.includes(item.key)) return false;

  return item.category === UNKNOWN_CATEGORY || !NEVER_HELD_BY_MUTE.has(item.category);
}
