import type { GlyphName } from '../../components/Glyph.tsx';

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
  bellMuted: ['the bell · a muted event', 'Each of the wedding’s items marked Muted'],
  bellGone: ['the bell · an event that has gone', 'This event is no longer available.'],
  bellOffline: ['the bell · offline', 'Offline · as of 09:40, with Try again'],
  bellRefreshing: ['the bell · refreshing', 'Refreshing… beside the title, the band kept'],
};

export type Category =
  'guest_replies' | 'messages' | 'event_day' | 'event_changes' | 'money' | 'account_security';

/** Each category's mark, the same as the web's; Event day, Money and Account & security take Notification settings' marks for them. */
export const CATEGORY_MARK: Record<Category, GlyphName> = {
  guest_replies: 'users',
  messages: 'chat',
  event_day: 'today',
  event_changes: 'events',
  money: 'wallet',
  account_security: 'shield',
};

/** A category the client does not know draws no mark, and its item keeps its words. */
export function markOf(category: string): GlyphName | null {
  return Object.hasOwn(CATEGORY_MARK, category) ? CATEGORY_MARK[category as Category] : null;
}

export type More = 'none' | 'idle' | 'loading' | 'failed' | 'shown';

export interface BellStart {
  feed: 'loading' | 'failed' | 'loaded';
  empty: boolean;
  more: More;
  asking: boolean;
  menu: string | null;
  muted: boolean;
  /** The item whose event has gone is listed, its line showing as after a tap. */
  gone: boolean;
  offline: 'none' | 'band' | 'refreshing';
}

const REST: BellStart = {
  feed: 'loaded',
  empty: false,
  more: 'none',
  asking: false,
  menu: null,
  muted: false,
  gone: false,
  offline: 'none',
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
      return { ...REST, muted: true };
    case 'bellGone':
      return { ...REST, gone: true };
    case 'bellOffline':
      return { ...REST, offline: 'band' };
    case 'bellRefreshing':
      return { ...REST, offline: 'refreshing' };
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
  muted: 'Muted',
  loading: 'Loading notifications',
  couldNotLoad: 'Your notifications did not load.',
  tryAgain: 'Try again',
  empty: 'Nothing yet. Replies, changes and reminders for your events show up here.',
  eventGone: 'This event is no longer available.',
  showMore: 'Show more',
  moreShown: (count: number) => `${count} more notifications shown.`,
  moreFailed: 'More notifications did not load. Try again in a moment.',
  more: (title: string, event: string) => `More for ${title}, ${event}`,
  muteEvent: 'Mute this event',
  pushTitle: 'Turn on push?',
  pushReason:
    'Hear about replies, changes and event days on this device, even with Soirely closed.',
  turnOn: 'Turn on',
  notNow: 'Not now',
  paused: 'Ana Souza paused the event',
  live: 'Ana Souza made the event live',
  deleted: 'Ana Souza deleted the event',
  overdue: (event: string) => `1 payment overdue on ${event}`,
  due: (event: string) => `2 payments due in the next 7 days on ${event}`,
  signIn: 'New sign-in to Soirely',
};
