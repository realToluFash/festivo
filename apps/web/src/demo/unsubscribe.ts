import type { DemoLink } from './settings.ts';

/** The page the daily summary's footer link opens (sc-4331), signed out: English copy (l10n) word for word, and nobody named. */
export const U = {
  onTitle: 'Guest reply emails',
  turnOff: 'Turn off guest reply emails',
  offTitle: 'Guest reply emails are off',
  offBody: 'You will still see replies in the bell, and push is as you set it.',
  turnOn: 'Turn them back on',
  backOnTitle: 'Guest reply emails are back on',
  backOnBody: 'Your guest summary will arrive in the morning when there is something new.',
  saving: 'Saving…',
  failed: 'Saving did not work. Nothing has changed.',
  tryAgain: 'Try again',
  unknownTitle: 'This link does not work',
  unknownBody:
    'Nothing has changed. To turn guest reply emails on or off, sign in and open your notification settings.',
  signIn: 'Sign in to notification settings',
  settings: 'Notification settings',
  saveFails: 'The save fails',
} as const;

/** Where Guest reply emails stand as the page shows them; `backOn` is on, after Turn them back on. */
export type Standing = 'on' | 'off' | 'backOn' | 'unknown';
export type Mark = 'envelope' | 'envelopeOff' | 'envelopeTick' | 'brokenLink';

export interface UnsubscribePage {
  mark: Mark;
  title: string;
  body?: string;
  /** The one button, and where its save leaves the page. */
  save?: { label: string; to: Standing };
  /** The unknown link's way on, in the button's place. */
  signIn?: true;
  settings: boolean;
}

export function pageOf(standing: Standing): UnsubscribePage {
  switch (standing) {
    case 'on':
      return {
        mark: 'envelope',
        title: U.onTitle,
        save: { label: U.turnOff, to: 'off' },
        settings: true,
      };
    case 'off':
      return {
        mark: 'envelopeOff',
        title: U.offTitle,
        body: U.offBody,
        save: { label: U.turnOn, to: 'backOn' },
        settings: true,
      };
    case 'backOn':
      return { mark: 'envelopeTick', title: U.backOnTitle, body: U.backOnBody, settings: true };
    case 'unknown':
      return {
        mark: 'brokenLink',
        title: U.unknownTitle,
        body: U.unknownBody,
        signIn: true,
        settings: false,
      };
  }
}

export const SAVE_MS = 900;
export const STATE_KEYS = ['on', 'off', 'backOn', 'saving', 'failed', 'unknown'] as const;
export type StateKey = (typeof STATE_KEYS)[number];

export interface Opening {
  standing: Standing;
  /** Opened mid-save: the button's spinner, held. */
  saving: boolean;
  failed: boolean;
}

export function openingOf(key: string | null): Opening {
  switch (key) {
    case 'off':
    case 'backOn':
    case 'unknown':
      return { standing: key, saving: false, failed: false };
    case 'saving':
      return { standing: 'on', saving: true, failed: false };
    case 'failed':
      return { standing: 'on', saving: false, failed: true };
    default:
      return { standing: 'on', saving: false, failed: false };
  }
}

export const NOTIFICATION_SETTINGS = '/demo/settings/notifications';

const NAMES: Record<StateKey, string> = {
  on: 'Opened while they are on',
  off: 'Off, after the button or the mail app’s Unsubscribe',
  backOn: 'Turned back on',
  saving: 'Saving',
  failed: 'The save did not work',
  unknown: 'A link that does not work',
};

export const UNSUBSCRIBE_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Guest reply emails',
    states: STATE_KEYS.map((key) => ({ to: `/demo/unsubscribe?state=${key}`, name: NAMES[key] })),
  },
];
