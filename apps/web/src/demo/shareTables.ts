import { localDay } from './events.ts';
import type { Party, Plan } from './seating.ts';

/** sc-4022's Share tables card at the top of Seating, as `ShareTables.dc.html` draws it; the words are the board's, and [en] owns them. */
export interface Share {
  /** The day the tables were shared, in the event's time zone; null while guests see nothing about seating. */
  shared: string | null;
  by: string | null;
  typed: string;
  editing: boolean;
  refused: ShareByRefusal | null;
  asking: 'share' | 'stop' | null;
  failed: boolean;
  stopped: boolean;
}

export type ShareByRefusal = 'empty' | 'afterEvent' | 'past';

export const NOT_SHARED: Share = {
  shared: null,
  by: null,
  typed: '',
  editing: false,
  refused: null,
  asking: null,
  failed: false,
  stopped: false,
};

/** The demo's today and the wedding's first day, both in Europe/London: Share by may be the 3rd or the 4th. */
export const SHARE_TODAY = '2026-11-03';
export const SHARE_BY = '2026-11-04';
export const SHARE_PASSED = '2026-11-02';
export const SHARED_ON = '2026-11-02';

const LOCALE = 'en-US';

export function shareDay(date: string, locale: string = LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

/** Share by is a day from today up to the day before the event, both in the event's time zone (pm, #5094, 20 Oct). */
export function shareByRefusal(
  typed: string,
  event: { startsAt: string; timeZone: string },
  today: string,
): ShareByRefusal | null {
  if (typed === '') return 'empty';
  if (typed >= localDay(event.startsAt, event.timeZone)) return 'afterEvent';
  if (typed < today) return 'past';

  return null;
}

export function isPassed(share: Pick<Share, 'by' | 'shared'>, today: string): boolean {
  return share.shared == null && share.by != null && share.by < today;
}

/** {n}: Coming guests with a taken seat; a held (proposed) chair is not a seat yet (sc-4016's counts), and a Not sure yet party seated from the tray is not Coming. */
export function seatedComing(plan: Plan, parties: readonly Party[]): number {
  const notComing = new Set(
    parties.filter((party) => party.reply !== 'coming').map((party) => party.id),
  );

  return plan.items.reduce(
    (sum, item) =>
      sum +
      item.chairs.filter(
        (chair) =>
          chair.state === 'taken' &&
          chair.who != null &&
          (chair.party == null || !notComing.has(chair.party)),
      ).length,
    0,
  );
}

export function unseatedComing(tray: readonly Party[]): number {
  return tray
    .filter((party) => party.reply === 'coming')
    .reduce((sum, party) => sum + (party.behind === true ? 0 : 1) + party.companions.length, 0);
}

function guests(n: number): string {
  return n === 1 ? '1 guest' : `${n} guests`;
}

export const SHARE_WORDS = {
  title: 'Share tables with guests',
  line: 'Guests who are coming will see their table on their page. You can still change the plan.',
  unseated: (n: number) =>
    n === 1 ? '1 guest doesn’t have a seat yet.' : `${n} guests don’t have a seat yet.`,
  shareBy: 'Share by',
  optional: 'Optional',
  saveDate: 'Save the date',
  change: 'Change',
  remove: 'Remove',
  passed: 'Passed',
  share: 'Share tables with guests',
  scheduleBy: (day: string) => `Share tables by ${day}. Nothing is shared until you share it.`,
  scheduleByPassed: (day: string) =>
    `Share tables by ${day}. That date has passed, and nothing is shared yet.`,
  scheduleShared: (day: string) => `Tables shared ${day}.`,
  refused: {
    empty: 'Choose a date, or leave Share by empty.',
    afterEvent: (day: string) => `Choose a date before the event, ${day}.`,
    past: 'Choose today or a later date.',
  },
  shared: 'Tables are shared with guests',
  since: (day: string) => `Since ${day}. Each guest’s page follows the plan as you change it.`,
  stop: 'Stop sharing',
  stopped: 'Guests’ pages no longer show their table.',
  askShare: 'Share tables with guests?',
  askShareLine: (n: number) =>
    `${guests(n)} who ${n === 1 ? 'is' : 'are'} coming will see their table on their page from now on. If you change the plan, their page changes with it.`,
  askShareUnseated: (u: number) =>
    `${guests(u)} who ${u === 1 ? 'is' : 'are'} coming ${u === 1 ? 'doesn’t' : 'don’t'} have a seat yet. They’ll see nothing about seating until they do.`,
  shareGo: 'Share tables',
  notYet: 'Not yet',
  shareFailed: 'We could not share the tables. Check your connection and try again.',
  askStop: 'Stop sharing tables?',
  askStopLine:
    'Guests’ pages stop showing their table straight away. The plan stays as it is, and you can share it again later.',
  stopGo: 'Stop sharing',
  keepSharing: 'Keep sharing',
  readOnly: 'You can see this. Changing it needs the Manage seating permission.',
  notSharedText: 'Not shared',
} as const;

export const SHARE_STATES = {
  shareNotShared: { name: 'Not shared, some Coming guests without a seat', share: {} },
  shareAllSeated: { name: 'Not shared, every Coming guest seated', share: {}, allSeated: true },
  shareBySet: { name: 'Share by saved', share: { by: SHARE_BY } },
  shareByBlank: {
    name: 'Save the date with nothing in it, refused',
    share: { refused: 'empty' },
  },
  shareByAfterEvent: {
    name: 'Share by on the event’s day, refused',
    share: { typed: '2026-11-05', refused: 'afterEvent' },
  },
  shareByPast: {
    name: 'Share by in the past, refused',
    share: { typed: SHARE_PASSED, refused: 'past' },
  },
  shareByPassed: {
    name: 'A saved Share by that has passed, nothing shared',
    share: { by: SHARE_PASSED },
  },
  shareConfirm: {
    name: 'Share tables asks first (a bottom sheet under 600 px)',
    share: { by: SHARE_BY, asking: 'share' },
  },
  shareFailed: {
    name: 'Sharing failed, the ask stays open',
    share: { by: SHARE_BY, asking: 'share', failed: true },
  },
  shareShared: { name: 'Tables shared', share: { by: SHARE_BY, shared: SHARED_ON } },
  shareConfirmStop: {
    name: 'Stop sharing asks first',
    share: { by: SHARE_BY, shared: SHARED_ON, asking: 'stop' },
  },
  shareStopped: {
    name: 'Stopped: the saved Share by comes back',
    share: { by: SHARE_BY, stopped: true },
  },
  shareReadOnly: {
    name: 'Without seating.manage, not shared',
    share: { by: SHARE_BY },
    readOnly: true,
  },
  shareReadOnlyShared: {
    name: 'Without seating.manage, shared',
    share: { by: SHARE_BY, shared: SHARED_ON },
    readOnly: true,
  },
} satisfies Record<
  string,
  { name: string; share: Partial<Share>; allSeated?: boolean; readOnly?: boolean }
>;

export type ShareState = keyof typeof SHARE_STATES;

export function isShareState(value: string | null): value is ShareState {
  return value != null && Object.hasOwn(SHARE_STATES, value);
}

export function shareOf(state: ShareState): Share {
  return { ...NOT_SHARED, ...SHARE_STATES[state].share };
}
