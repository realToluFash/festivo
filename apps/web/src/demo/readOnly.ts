/** sc-3937: a failed payment makes new work wait, never a live event, as PaymentFailed.dc.html, ReadOnly.dc.html and BillingEmails.dc.html draw it. */

export const STATUSES = ['active', 'pastDue', 'pastDueNoRetry', 'readOnly', 'paid'] as const;

export type Status = (typeof STATUSES)[number];

export type Role = 'manage' | 'read' | 'none';

export const REFUSED = [
  'makeLive',
  'createEvent',
  'guestNotLive',
  'import',
  'invite',
  'message',
] as const;

export type Refused = (typeof REFUSED)[number];

export const PAGES = ['events', 'eventView', 'guests', ...REFUSED] as const;

export type Page = (typeof PAGES)[number];

export function pageOf(name: string | null): Page | null {
  return (PAGES as readonly (string | null)[]).includes(name) ? (name as Page) : null;
}

export type Email = 'pastDue' | 'pastDueNoRetry' | 'readOnly' | 'paid';

export const ORGANISATION = 'Ìrè Events';

/** Sample, not spec: the renewal failed on Thursday, Nov 26, and the provider tries again on Monday, Nov 30. */
export const SAMPLE = {
  firstFailed: '2026-11-26',
  retryOn: '2026-11-30',
} as const;

/** The catalogue's days from the first failure to read-only (sc-3928). */
export const GRACE_DAYS = 14;

const DAY = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export function dayOf(iso: string): string {
  return DAY.format(new Date(`${iso}T12:00:00Z`));
}

export function readOnlyOn(firstFailed: string): string {
  const at = new Date(`${firstFailed}T12:00:00Z`);
  at.setUTCDate(at.getUTCDate() + GRACE_DAYS);

  return at.toISOString().slice(0, 10);
}

/** The AC's English (en, #4143). The email subjects are the drawing's, for [en]. */
export const RW = {
  pastDue: (retry: string | null, readOnly: string, organisation: string) =>
    [
      'Your last payment failed.',
      retry == null ? null : `We will try again on ${retry}.`,
      `After ${readOnly}, ${organisation} becomes read-only.`,
    ]
      .filter((line) => line != null)
      .join(' '),
  readOnly: 'Read-only until the payment is made. Live events are running normally.',
  update: 'Update payment method',
  title: (organisation: string) => `${organisation} is read-only until the payment is made.`,
  inApp: 'The payment cannot be made in the app.',
  ask: 'Ask someone who manages billing to make the payment.',
  running: 'Running normally',
  paid: 'Paid. Thank you.',
  subject: {
    pastDue: (organisation: string) => `${organisation} · Your last payment failed`,
    readOnly: (organisation: string) => `${organisation} · Read-only until the payment is made`,
    paid: (organisation: string) => `${organisation} · Paid. Thank you.`,
  },
} as const;

export const REFUSALS = {
  makeLive: {
    safe: 'Kept as a draft, with everything you entered.',
    back: 'Back to the draft',
    on: 'Event view · Make live',
    verb: 'Make live',
  },
  createEvent: {
    safe: 'The form is kept as you left it.',
    back: 'Back to the form',
    on: 'New event · Create event',
    verb: 'Create event',
  },
  guestNotLive: {
    safe: 'The form is kept as you left it.',
    back: 'Back to the form',
    on: 'Guests of a draft · Add guest',
    verb: 'Add guest',
  },
  import: {
    safe: 'The file is kept, so you can import it once the payment is made.',
    back: 'Back to the import',
    on: 'Guests of a draft · Import',
    verb: 'Import',
  },
  invite: {
    safe: 'The form is kept as you left it.',
    back: 'Back to the invitation',
    on: 'Members · Invite somebody',
    verb: 'Send invitation',
  },
  message: {
    safe: 'The message is kept as you wrote it.',
    back: 'Back to the message',
    on: 'Messages of a draft · Send',
    verb: 'Send',
  },
} as const satisfies Record<Refused, { safe: string; back: string; on: string; verb: string }>;

export const owes = (status: Status) =>
  status === 'pastDue' || status === 'pastDueNoRetry' || status === 'readOnly';

/** The shell's banner on every web page: billing.read sees it, billing.manage also gets Update payment method. */
export function bannerOf(
  status: Status,
  role: Role,
  organisation = ORGANISATION,
): { words: string; update: boolean } | null {
  if (role === 'none' || !owes(status)) return null;
  const words =
    status === 'readOnly'
      ? RW.readOnly
      : RW.pastDue(
          status === 'pastDue' ? dayOf(SAMPLE.retryOn) : null,
          dayOf(readOnlyOn(SAMPLE.firstFailed)),
          organisation,
        );

  return { words, update: role === 'manage' };
}

/** Running normally sits beside a live event's status, Live or Happening now, for everyone who can see it. */
export function runsNormally(status: Status, phase: 'live' | 'happeningNow' | 'draft'): boolean {
  return status === 'readOnly' && phase !== 'draft';
}

export function refuses(status: Status): boolean {
  return status === 'readOnly';
}

/** The way past: the hosted page on the web for billing.manage, a plain line in the app, and who can act for anyone else. */
export function wayPastOf(role: Role, platform: 'web' | 'app'): 'pay' | 'inApp' | 'ask' {
  if (role !== 'manage') return 'ask';
  return platform === 'web' ? 'pay' : 'inApp';
}

export interface Mail {
  subject: string;
  lines: readonly string[];
  update: boolean;
}

/** Each email goes once to billing.read; its body is its banner's words, and billing.manage gets the button. */
export function mailOf(email: Email, role: Role, organisation = ORGANISATION): Mail | null {
  if (role === 'none') return null;
  if (email === 'paid')
    return { subject: RW.subject.paid(organisation), lines: [RW.paid], update: false };
  const banner = bannerOf(email, role, organisation);
  if (banner == null) return null;

  return {
    subject:
      email === 'readOnly' ? RW.subject.readOnly(organisation) : RW.subject.pastDue(organisation),
    lines: [banner.words],
    update: banner.update,
  };
}

export interface ReadOnlyState {
  status: Status;
  role: Role;
  page: Page;
  email: Email | null;
}

const on = (status: Status, role: Role, page: Page): ReadOnlyState => ({
  status,
  role,
  page,
  email: null,
});

const mail = (email: Email, role: Role): ReadOnlyState => ({
  status: email === 'paid' ? 'active' : email,
  role,
  page: 'events',
  email,
});

const STATES = {
  pastDue: on('pastDue', 'manage', 'events'),
  pastDueRead: on('pastDue', 'read', 'events'),
  pastDueNone: on('pastDue', 'none', 'events'),
  pastDueNoRetry: on('pastDueNoRetry', 'manage', 'events'),
  pastDueGuests: on('pastDue', 'manage', 'guests'),
  active: on('active', 'manage', 'events'),
  paid: on('paid', 'manage', 'events'),
  readOnly: on('readOnly', 'manage', 'events'),
  readOnlyRead: on('readOnly', 'read', 'events'),
  readOnlyNone: on('readOnly', 'none', 'events'),
  readOnlyEventView: on('readOnly', 'manage', 'eventView'),
  makeLive: on('readOnly', 'manage', 'makeLive'),
  makeLiveOther: on('readOnly', 'none', 'makeLive'),
  createEvent: on('readOnly', 'manage', 'createEvent'),
  guestNotLive: on('readOnly', 'manage', 'guestNotLive'),
  import: on('readOnly', 'read', 'import'),
  invite: on('readOnly', 'manage', 'invite'),
  message: on('readOnly', 'none', 'message'),
  makeLivePastDue: on('pastDue', 'manage', 'makeLive'),
  emailPastDue: mail('pastDue', 'manage'),
  emailPastDueRead: mail('pastDue', 'read'),
  emailPastDueNoRetry: mail('pastDueNoRetry', 'manage'),
  emailReadOnly: mail('readOnly', 'manage'),
  emailPaid: mail('paid', 'manage'),
} as const satisfies Record<string, ReadOnlyState>;

export type ReadOnlyStateName = keyof typeof STATES;

export function readOnlyStateOf(name: string | null): ReadOnlyStateName {
  return name != null && name in STATES ? (name as ReadOnlyStateName) : 'pastDue';
}

export function readOnlyState(name: ReadOnlyStateName): ReadOnlyState {
  return STATES[name];
}

const at = (state: ReadOnlyStateName, name: string) => ({
  to: `read-only?state=${state}`,
  name,
});

export const READ_ONLY_PAGES: readonly {
  name: string;
  states: readonly { to: string; name: string }[];
}[] = [
  {
    name: 'Past due: the banner over every page',
    states: [
      at('pastDue', 'billing.manage: Update payment method (Play: the next try pays)'),
      at('pastDueRead', 'billing.read only: no button'),
      at('pastDueNone', 'No billing permission: nothing new'),
      at('pastDueNoRetry', 'No next try: the middle sentence left out'),
      at('pastDueGuests', 'Over an event’s Guests'),
      at('makeLivePastDue', 'Make live while past due: nothing is refused'),
      at('active', 'Active: nothing new'),
      at('paid', 'Paid: the banner is gone'),
    ],
  },
  {
    name: 'Read-only: the banner and Running normally',
    states: [
      at('readOnly', 'Events, billing.manage'),
      at('readOnlyRead', 'Events, billing.read only'),
      at('readOnlyNone', 'Events, no billing permission: Running normally, no banner'),
      at('readOnlyEventView', 'Event view of a live event'),
    ],
  },
  {
    name: 'Read-only: new work refused',
    states: [
      at('makeLive', 'Make live, billing.manage: Update payment method'),
      at('makeLiveOther', 'Make live, anyone else: Ask someone who manages billing'),
      at('createEvent', 'Create event'),
      at('guestNotLive', 'Add guest, to an event not live'),
      at('import', 'Import, billing.read only'),
      at('invite', 'Send invitation'),
      at('message', 'Send a new message, no billing permission'),
    ],
  },
  {
    name: 'The billing emails',
    states: [
      at('emailPastDue', 'Past due, billing.manage'),
      at('emailPastDueRead', 'Past due, billing.read only: no button'),
      at('emailPastDueNoRetry', 'Past due, no next try'),
      at('emailReadOnly', 'Read-only'),
      at('emailPaid', 'Paid. Thank you.'),
    ],
  },
];
