import type { NotificationCategory, NotificationSetting } from '@soirely/api-client';
import {
  NOTIFICATION_CATEGORY_ORDER,
  quietHoursIn,
  settingFlipped,
  usageThresholdsIn,
} from '@soirely/domain';

import { type Channel, type Switch } from '../notificationsPage.ts';
import { type DemoLink, VIEWERS, settingsPath } from './settings.ts';

export type { Channel, Switch };
export type Category = NotificationCategory;

export const SAVE_MS = 500;
export const HOLD_MS = 8000;
export const LOADING_MS = 8000;
export const RETRY_MS = 1500;

export const NOTIFICATION_WORDS = {
  title: 'Notification settings',
  head: 'What you hear about',
  push: 'Push',
  email: 'Email',
  on: 'On',
  off: 'Off',
  always: 'email always on',
  locked: 'Email cannot be switched off.',
  blockedLine: 'Push is off in this browser, so pushes will not reach you here.',
  blockedHere: 'Blocked in this browser',
  allow: 'How to allow push',
  saving: 'Saving…',
  saved: 'Saved',
  savedSaid: 'Saved.',
  pushNotSaved: 'The push switch was not saved. Try again.',
  emailNotSaved: 'The email switch was not saved. Try again.',
  couldNotLoad: 'Your notification settings did not load.',
  check: 'Check your connection and try again.',
  tryAgain: 'Try again',
  loading: 'Loading…',
  says: (value: string) => `You hear by ${value.toLowerCase()}`,
  summary: (push: number, email: number, of: number) =>
    `${push} of ${of} by push · ${email} of ${of} by email`,
  switchName: (category: string, channel: string) => `${category} ${channel}`,
  quietHours: (start: string, end: string) =>
    `Between ${start} and ${end} your time, only Event day pushes come through.`,
} as const;

/** A row's value in words, from its two switches. */
export const VALUE_WORDS = {
  both: 'Push and email',
  push: 'Push only',
  email: 'Email only',
  neither: 'Off',
} as const;

/** The card's step while this browser blocks pushes: a browser cannot ask again, so the steps are the reader's. */
export const ALLOW_WORDS = {
  title: 'Allow push in this browser',
  verb: 'Done',
  intro:
    'This browser is blocking Soirely’s pushes. Only you can allow them again, in the browser.',
  steps: [
    'Click the icon at the left end of the address bar.',
    'Find Notifications and set it to Allow.',
    'Come back to this tab. Soirely checks again when you do.',
  ],
  elsewhere:
    'Not there? Open your browser’s settings, find the permissions for each site, and allow notifications for Soirely.',
} as const;

const W = NOTIFICATION_WORDS;

export const CATEGORY_NAMES: Record<Category, string> = {
  guest_replies: 'Guest replies',
  messages: 'Messages',
  event_day: 'Event day',
  event_changes: 'Event changes',
  money: 'Money',
  account_security: 'Account & security',
};

export function categoryNote(category: Category, locale: string): string {
  const { low, high } = usageThresholdsIn(locale);

  return {
    guest_replies: "Guests' replies and changes, the needs they add, and their questions.",
    messages:
      'A send that did not reach everyone, was held for credits or was cancelled, and credits running low.',
    event_day: 'Your shift or call time changed, or the event changed in its last 24 hours.',
    event_changes:
      'When someone else changes whether, when or where an event you are on takes place.',
    money: `Payments due, usage at ${low} and ${high}, failed payments and invoices.`,
    account_security: `Sign-ins, your password, two-factor, ownership and access. ${W.locked}`,
  }[category];
}

/** What a kind covers; where email is kept on, its sentence moves under the Email switch. */
export function coversLine(setting: NotificationSetting, locale: string): string {
  const note = categoryNote(setting.category, locale);

  return setting.email.switchable ? note : note.replace(` ${W.locked}`, '');
}

export function valueOf(push: boolean, email: boolean): string {
  if (push && email) return VALUE_WORDS.both;
  if (push) return VALUE_WORDS.push;

  return email ? VALUE_WORDS.email : VALUE_WORDS.neither;
}

export function rowValue(setting: NotificationSetting): string {
  const value = valueOf(setting.push.on, setting.email.on);

  return !setting.email.switchable && setting.email.on ? `${value} · ${W.always}` : value;
}

export function cardOf(settings: readonly NotificationSetting[]): {
  says: string;
  summary: string;
} {
  const push = settings.filter((setting) => setting.push.on).length;
  const email = settings.filter((setting) => setting.email.on).length;

  return {
    says: W.says(valueOf(push > 0, email > 0)),
    summary: W.summary(push, email, settings.length),
  };
}

export function switchName(category: Category, channel: Channel): string {
  return W.switchName(CATEGORY_NAMES[category], channel === 'push' ? W.push : W.email);
}

export function notSaved(channel: Channel): string {
  return channel === 'push' ? W.pushNotSaved : W.emailNotSaved;
}

/** Quiet hours as the product writes them, from its one home: 21:00 and 08:00 in every language (sc-30243). */
export function quietHoursLine(locale: string): string {
  const { start, end } = quietHoursIn(locale);

  return W.quietHours(start, end);
}

/** Epic 36's defaults for a member who changed nothing: push on but for Account & security, email on but for Event day. */
export const SAMPLE_SETTINGS: readonly NotificationSetting[] = NOTIFICATION_CATEGORY_ORDER.map(
  (category) => ({
    category,
    push: { on: category !== 'account_security', switchable: true },
    email: { on: category !== 'event_day', switchable: category !== 'account_security' },
  }),
);

/** The one switch whose save never goes through once a save has failed, so the failure can be seen again. */
export const NEVER_SAVED: Switch = { category: 'messages', channel: 'email' };

export function sameSwitch(one: Switch | null, other: Switch): boolean {
  return one != null && one.category === other.category && one.channel === other.channel;
}

/** The app's states after the page at rest, then the moments only the web links to. */
export const NOTIFICATIONS_STATES = [
  'pushBlocked',
  'saveFailed',
  'saving',
  'saved',
  'loading',
  'failed',
] as const;

export const WEB_MOMENTS = ['rowOpen', 'accountSecurity', 'blockedRowOpen', 'allowPush'] as const;

type NotificationsState = (typeof NOTIFICATIONS_STATES)[number] | (typeof WEB_MOMENTS)[number];

function stateOf(name: string): NotificationsState | null {
  return [...NOTIFICATIONS_STATES, ...WEB_MOMENTS].find((state) => state === name) ?? null;
}

export interface NotificationsStart {
  load: 'loading' | 'failed' | 'loaded';
  settings: readonly NotificationSetting[];
  blocked: boolean;
  open: Category | null;
  saving: Switch | null;
  saved: Category | null;
  unsaved: Switch | null;
  refuses: Switch | null;
  allow: boolean;
}

const EMAIL_OFF = settingFlipped(SAMPLE_SETTINGS, NEVER_SAVED.category, NEVER_SAVED.channel, false);

/** What a state link opens on; one the page does not know opens it at rest. */
export function notificationsStart(state: string): NotificationsStart {
  const REST: NotificationsStart = {
    load: 'loaded',
    settings: SAMPLE_SETTINGS,
    blocked: false,
    open: null,
    saving: null,
    saved: null,
    unsaved: null,
    refuses: null,
    allow: false,
  };
  const messages = { ...REST, settings: EMAIL_OFF, open: NEVER_SAVED.category };

  switch (stateOf(state)) {
    case null:
      return REST;
    case 'rowOpen':
      return { ...REST, open: 'guest_replies' };
    case 'accountSecurity':
      return { ...REST, open: 'account_security' };
    case 'pushBlocked':
      return { ...REST, blocked: true };
    case 'blockedRowOpen':
      return { ...REST, blocked: true, open: 'event_day' };
    case 'allowPush':
      return { ...REST, blocked: true, allow: true };
    case 'saving':
      return { ...messages, saving: NEVER_SAVED };
    case 'saved':
      return { ...messages, saved: NEVER_SAVED.category };
    case 'saveFailed':
      return { ...REST, open: NEVER_SAVED.category, unsaved: NEVER_SAVED, refuses: NEVER_SAVED };
    case 'loading':
      return { ...REST, load: 'loading' };
    case 'failed':
      return { ...REST, load: 'failed' };
  }
}

function notifications(state: string | undefined, name: string): DemoLink {
  return { to: settingsPath('notifications', VIEWERS.folake, state), name };
}

export const NOTIFICATIONS_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The page',
    states: [
      notifications(undefined, 'At rest, every kind reaching you'),
      { to: settingsPath('notifications', VIEWERS.julien), name: 'The same for an admin' },
      { to: settingsPath('notifications', VIEWERS.ana), name: 'The same for a member' },
      notifications('rowOpen', 'Guest replies, opened'),
      notifications('accountSecurity', 'Account & security, opened'),
    ],
  },
  {
    name: 'Push blocked',
    states: [
      notifications('pushBlocked', 'Push blocked in this browser'),
      notifications('blockedRowOpen', 'Push blocked, a row opened'),
      notifications('allowPush', 'How to allow push'),
    ],
  },
  {
    name: 'Saving',
    states: [
      notifications('saving', 'A switch saving'),
      notifications('saved', 'Saved'),
      notifications('saveFailed', 'A save failed'),
    ],
  },
  {
    name: 'Loading',
    states: [notifications('loading', 'Loading'), notifications('failed', 'Did not load')],
  },
];
