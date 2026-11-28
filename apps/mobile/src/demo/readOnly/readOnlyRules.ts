/** sc-3937 in the app: read-only refuses new work where it is made. The app has no banner, no import, no new message and no invitation. */

export const APP_REFUSED = ['makeLive', 'createEvent', 'duplicate', 'guestNotLive'] as const;

export type AppRefused = (typeof APP_REFUSED)[number];

export type Role = 'manage' | 'other';

export const ORGANISATION = 'Ìrè Events';

export const RW = {
  title: (organisation: string) => `${organisation} is read-only until the payment is made.`,
  inApp: 'The payment cannot be made in the app.',
  ask: 'Ask someone who manages billing to make the payment.',
} as const;

export const REFUSALS = {
  makeLive: {
    safe: 'Kept as a draft, with everything you entered.',
    back: 'Back to the draft',
    on: 'Event · Make live',
  },
  createEvent: {
    safe: 'The form is kept as you left it.',
    back: 'Back to the form',
    on: 'New event · Create event',
  },
  duplicate: {
    safe: 'The form is kept as you left it.',
    back: 'Back to the form',
    on: 'Duplicate · Create draft',
  },
  guestNotLive: {
    safe: 'The form is kept as you left it.',
    back: 'Back to the form',
    on: 'Guests of a draft · Add guest',
  },
} as const satisfies Record<AppRefused, { safe: string; back: string; on: string }>;

/** In the app billing.manage reads that the payment is not made here, with no link; anyone else, who can act. */
export function wayPastOf(role: Role): 'inApp' | 'ask' {
  return role === 'manage' ? 'inApp' : 'ask';
}

export interface ReadOnlyState {
  refused: AppRefused;
  role: Role;
}

const STATES = {
  makeLive: { refused: 'makeLive', role: 'manage' },
  makeLiveOther: { refused: 'makeLive', role: 'other' },
  createEvent: { refused: 'createEvent', role: 'manage' },
  duplicate: { refused: 'duplicate', role: 'other' },
  guestNotLive: { refused: 'guestNotLive', role: 'manage' },
  guestNotLiveOther: { refused: 'guestNotLive', role: 'other' },
} as const satisfies Record<string, ReadOnlyState>;

export type ReadOnlyStateName = keyof typeof STATES;

export function readOnlyStateOf(name: string | undefined): ReadOnlyStateName {
  return name != null && name in STATES ? (name as ReadOnlyStateName) : 'makeLive';
}

export function readOnlyState(name: ReadOnlyStateName): ReadOnlyState {
  return STATES[name];
}
