export const BELL_GROUP = 'The bell (sc-83081)';

/** The bell's states in the B frame (sc-83081), each at its own `?state=` beside `bell`. */
export const BELL_STATES = [
  { key: 'bellPush', name: 'The bell: Turn on push?' },
  { key: 'bellLoading', name: 'The bell: loading' },
  { key: 'bellFailed', name: 'The bell: did not load' },
  { key: 'bellEmpty', name: 'The bell: nothing yet' },
  { key: 'bellMore', name: 'The bell: Show more' },
  { key: 'bellMoreFailed', name: 'The bell: more did not load' },
  { key: 'bellMute', name: "The bell: an item's More, Mute this event" },
  { key: 'bellMuted', name: 'The bell: a muted event' },
  { key: 'bellGone', name: 'The bell: an event that has gone' },
  { key: 'bellOffline', name: 'The bell: offline' },
  { key: 'bellRefreshing', name: 'The bell: offline, Refreshing…' },
  { key: 'bellUnknown', name: 'The bell: a category this app does not know (sc-84143)' },
] as const;

export type BellState = 'bell' | (typeof BELL_STATES)[number]['key'];

/** The sample's category from a server newer than the app (sc-84143). */
export const UNKNOWN_CATEGORY = 'venue_news' as const;

export type Feed = 'loading' | 'failed' | 'loaded';
export type More = 'none' | 'idle' | 'loading' | 'failed' | 'shown';

export interface BellStart {
  feed: Feed;
  empty: boolean;
  more: More;
  asking: boolean;
  menu: string | null;
  /** Mute this event's switch as it opens; flipping it marks no item already shown. */
  muted: boolean;
  /** The items delivered after the event was muted, each marked Muted when it arrived (sc-3980). */
  marked: readonly string[];
  /** The item whose event has gone is listed, its line showing as after a press. */
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
      return { ...REST, unknown: true, muted: true };
    case 'bell':
      return REST;
  }
}

export function isBellState(state: string | null): state is BellState {
  return state === 'bell' || BELL_STATES.some((one) => one.key === state);
}

/** The sample event that has gone, for the item that can no longer open it. */
export const GONE_EVENT = 'Leila’s 40th';

/** The older page Show more brings: one money reminder and one change, both read. */
export const OLDER_COUNT = 2;

/** Today at 09:40, so the shared band reads "Offline · as of 09:40". */
export function asOf(): Date {
  const at = new Date();
  at.setHours(9, 40, 0, 0);

  return at;
}
