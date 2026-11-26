import type { BriefingStart, Person } from '../briefing/briefingModel.ts';
import { RULES, SMS_CREDITS, WHATSAPP_CREDITS } from '../briefing/briefingModel.ts';
import type { LinkStatus } from '../staffLink/StaffLinkModel.ts';
import type { Ask } from '../messages/CheckWaits.ts';
import { W, WW, say } from '../messages/MessagesWords.ts';
import type { RosterState } from '../staffLink/StaffRosterModel.ts';

/** How S2 and S3 reach a person (Decided, 19 Oct): push when signed in with notifications allowed, else sc-3954's order, else nobody. */
export type Reach = 'push' | 'sms' | 'whatsApp' | 'none';

export type ChangeField = 'start' | 'end' | 'job' | 'date' | 'venue';

export interface Change {
  field: ChangeField;
  now: string;
  was: string;
}

export type ShiftNotice =
  | { kind: 'waiting'; at: string; changes: readonly Change[]; was: 'read' | 'sent'; day: string }
  | { kind: 'quiet'; day: string; at: string; was: 'read' | 'sent'; on: string }
  | { kind: 'told'; on: string; at: string; by: Exclude<Reach, 'none'> }
  | { kind: 'failed'; reason: string }
  | { kind: 'unreachable' };

export type Finished = 'calledOff' | 'ended';

export const EVENT_DAY = 'Saturday, Oct 17';
export const REMINDER_DAY = 'Friday, Oct 16';
export const REMIND_AT = '10:00';
export const NOW_DAY = 'Thursday, Oct 15';
export const NOW_AT = '19:40';
export const GOES_AT = '19:55';
export const NO_CREDITS = 'no credits left';
export const CARRIER_REFUSED = 'the carrier refused the number';

const plural = (n: number, one: string, other: string) =>
  (n === 1 ? one : other).replace('{count}', String(n));

export const SW = {
  heading: 'Reminder the day before',
  switchLabel: 'Remind each person the day before their shift',
  on: 'On',
  off: 'Off',
  what: (time: string) =>
    `Goes to each person on the day before their shift, at ${time}, the event's time. It carries their start time, the venue, their job and their link.`,
  next: (date: string, n: number) =>
    plural(
      n,
      `Next on ${date}, to 1 person as things stand.`,
      `Next on ${date}, to {count} people as things stand.`,
    ),
  nobody: 'Nobody to remind yet.',
  sent: (date: string, n: number) =>
    plural(n, `Sent on ${date}, to 1 person.`, `Sent on ${date}, to {count} people.`),
  cost: (n: number, credits: number) =>
    plural(
      n,
      `1 by text or WhatsApp, using ${credits} of your credits.`,
      `{count} by text or WhatsApp, using ${credits} of your credits.`,
    ),
  shortfall: (n: number) =>
    plural(
      n,
      '1 person will not get the reminder by text or WhatsApp: not enough credits. If they have the app, they still get it by push.',
      '{count} people will not get the reminder by text or WhatsApp: not enough credits. If they have the app, they still get it by push.',
    ),
  notInApp: W.creditsNotInApp,
  askOwner: WW.askOwner,
  asked: say.ownersAsked,
  askFailed: WW.askFailed,
  notBriefed: (n: number) =>
    plural(
      n,
      '1 person has not had their briefing, so will not be reminded.',
      '{count} people have not had their briefing, so will not be reminded.',
    ),
  unreachable: (n: number) =>
    plural(n, "1 person can't be reached.", "{count} people can't be reached."),
  stillOn: "Couldn't save. The reminder is still on.",
  stillOff: "Couldn't save. The reminder is still off.",
  calledOff: 'No reminder will be sent: the event has been called off.',
  ended: 'No reminder will be sent: the event has ended.',
  alreadyOver: 'This event is already over.',
  goesAt: (time: string) => `Goes at ${time}`,
  editsTogether: 'Edits before then go in the same message.',
  change: {
    start: (now: string, was: string) => `Start ${now} (was ${was})`,
    end: (now: string, was: string) => `End ${now} (was ${was})`,
    job: (now: string, was: string) => `Job ${now} (was ${was})`,
    date: (now: string, was: string) => `Date ${now} (was ${was})`,
    venue: (now: string, was: string) => `Venue ${now} (was ${was})`,
  } satisfies Record<ChangeField, (now: string, was: string) => string>,
  quiet: (day: string, time: string) => `Held for quiet hours. Goes ${day} at ${time}.`,
  told: {
    push: (date: string, time: string) => `Told on ${date} at ${time}, by push.`,
    sms: (date: string, time: string) => `Told on ${date} at ${time}, by text.`,
    whatsApp: (date: string, time: string) => `Told on ${date} at ${time}, by WhatsApp.`,
  } satisfies Record<Exclude<Reach, 'none'>, (date: string, time: string) => string>,
  notDelivered: (reason: string) => `Not delivered: ${reason}.`,
  cantWord: "Can't be reached",
  cantLine: "Can't be reached: not signed in to the app, and no mobile number.",
  calledOffLine: 'Called off',
  endedLine: 'Event ended',
  footnote: '[Once a person’s briefing went, a change to their shift goes to them by itself.]',
};

export type LineMark =
  | 'waiting'
  | 'quiet'
  | 'push'
  | 'sms'
  | 'whatsApp'
  | 'failed'
  | 'unreachable'
  | 'calledOff'
  | 'ended';

export interface RowLine {
  mark: LineMark | null;
  words: string;
  quiet?: boolean;
}

function changeWords(change: Change): string {
  return SW.change[change.field](change.now, change.was);
}

export function rowLines(one: Pick<Person, 'notice' | 'ended'>): RowLine[] {
  const lines: RowLine[] = [];
  const notice = one.notice ?? null;
  if (notice?.kind === 'waiting')
    lines.push(
      { mark: 'waiting', words: SW.goesAt(notice.at) },
      ...notice.changes.map((change) => ({ mark: null, words: changeWords(change) })),
      { mark: null, words: SW.editsTogether, quiet: true },
    );
  if (notice?.kind === 'quiet')
    lines.push({ mark: 'quiet', words: SW.quiet(notice.day, notice.at) });
  if (notice?.kind === 'told')
    lines.push({ mark: notice.by, words: SW.told[notice.by](notice.on, notice.at) });
  if (notice?.kind === 'failed')
    lines.push({ mark: 'failed', words: SW.notDelivered(notice.reason) });
  if (notice?.kind === 'unreachable') lines.push({ mark: 'unreachable', words: SW.cantLine });
  if (one.ended === 'calledOff') lines.push({ mark: 'calledOff', words: SW.calledOffLine });
  if (one.ended === 'ended') lines.push({ mark: 'ended', words: SW.endedLine });

  return lines;
}

/** A person who can't be reached carries that word in place of Not sent, and is never counted as briefed. */
export function stateWordOf(one: Pick<Person, 'notice'>): string | null {
  return one.notice?.kind === 'unreachable' ? SW.cantWord : null;
}

function onAShift(one: Person): boolean {
  return one.shift != null;
}

/** S3 goes only to people whose briefing went and who can be reached (Decided, 20 Oct). */
export function remindedOf(people: readonly Person[]): Person[] {
  return people.filter(
    (one) => onAShift(one) && one.brief !== 'none' && (one.reach ?? 'none') !== 'none',
  );
}

export function leftOutOf(people: readonly Person[]): { notBriefed: number; unreachable: number } {
  const shifts = people.filter(onAShift);

  return {
    notBriefed: shifts.filter((one) => one.brief === 'none' && (one.reach ?? 'none') !== 'none')
      .length,
    unreachable: shifts.filter((one) => (one.reach ?? 'none') === 'none').length,
  };
}

const creditsFor = (one: Person) => (one.reach === 'whatsApp' ? WHATSAPP_CREDITS : SMS_CREDITS);

export interface Spend {
  texts: number;
  credits: number;
  notCovered: number;
}

/** sc-3931's reservation preview, as sample: credits only, as texts have nothing included (sc-3931, 31 Oct), each text paid whole or not at all in roster order. Push is never counted. */
export function spendOf(reminded: readonly Person[], balance: number): Spend {
  let left = balance;
  const spend: Spend = { texts: 0, credits: 0, notCovered: 0 };
  for (const one of reminded) {
    if (one.reach !== 'sms' && one.reach !== 'whatsApp') continue;
    spend.texts += 1;
    const cost = creditsFor(one);
    if (cost > left) {
      spend.notCovered += 1;
      continue;
    }
    left -= cost;
    spend.credits += cost;
  }

  return spend;
}

export function costLine(spend: Spend): string | null {
  if (spend.texts === 0 || spend.notCovered > 0) return null;

  return SW.cost(spend.texts, spend.credits);
}

export interface CardInput {
  people: readonly Person[];
  on: boolean;
  finished: Finished | null;
  /** The last reminder had gone: the eve of a one-day event, or after the last day's on several. */
  lastSent: { date: string; count: number } | null;
  balance: number;
  manage: boolean;
  billing: boolean;
}

export interface CardView {
  only: string | null;
  control: 'switch' | 'word' | null;
  what: string | null;
  next: string | null;
  cost: string | null;
  /** billing.manage reads the app's line, with no link and no button (epic 37); anyone else gets Ask an owner. */
  shortfall: { words: string; way: 'notInApp' | 'ask' } | null;
  leftOut: string[];
}

const NOTHING: Omit<CardView, 'only'> = {
  control: null,
  what: null,
  next: null,
  cost: null,
  shortfall: null,
  leftOut: [],
};

export function cardOf(input: CardInput): CardView {
  if (input.finished != null)
    return {
      ...NOTHING,
      only:
        input.lastSent != null
          ? SW.sent(input.lastSent.date, input.lastSent.count)
          : input.finished === 'calledOff'
            ? SW.calledOff
            : SW.ended,
    };

  const head = {
    only: null,
    control: input.manage ? ('switch' as const) : ('word' as const),
    what: SW.what(REMIND_AT),
  };
  if (!input.on) return { ...NOTHING, ...head };
  if (input.lastSent != null)
    return { ...NOTHING, ...head, next: SW.sent(input.lastSent.date, input.lastSent.count) };

  const reminded = remindedOf(input.people);
  const spend = spendOf(reminded, input.balance);
  const out = leftOutOf(input.people);

  return {
    ...head,
    next: reminded.length === 0 ? SW.nobody : SW.next(REMINDER_DAY, reminded.length),
    cost: costLine(spend),
    shortfall:
      spend.notCovered > 0
        ? { words: SW.shortfall(spend.notCovered), way: input.billing ? 'notInApp' : 'ask' }
        : null,
    leftOut: [
      ...(out.notBriefed > 0 ? [SW.notBriefed(out.notBriefed)] : []),
      ...(out.unreachable > 0 ? [SW.unreachable(out.unreachable)] : []),
    ],
  };
}

/** Once Finished no briefing goes (Decided, 27 Oct): the three sends are not offered; Copy link and Preview as stay. */
export function sendsOffered(finished: Finished | null): boolean {
  return finished == null;
}

/** Time passing: a waiting change goes at its time and a held one when quiet hours end; the state goes back to Read or Sent, not read, and the Told line stays. */
export function delivered(one: Person): Person {
  const notice = one.notice ?? null;
  if (one.reach == null || one.reach === 'none') return one;
  if (notice?.kind === 'waiting')
    return {
      ...one,
      brief: notice.was,
      notice: { kind: 'told', on: notice.day, at: notice.at, by: one.reach },
    };
  if (notice?.kind === 'quiet')
    return {
      ...one,
      brief: notice.was,
      notice: { kind: 'told', on: notice.on, at: notice.at, by: one.reach },
    };

  return one;
}

export function afterResend(people: readonly Person[], sent: readonly string[]): Person[] {
  return people.map((one) => {
    const notice = one.notice ?? null;
    if (!sent.includes(one.id) || notice == null || notice.kind === 'unreachable') return one;
    if (one.reach == null || one.reach === 'none') return one;

    return { ...one, notice: { kind: 'told', on: NOW_DAY, at: NOW_AT, by: one.reach } };
  });
}

type Sample = Pick<Person, 'id' | 'name' | 'job' | 'station' | 'shift' | 'mobile'> & {
  status: LinkStatus;
  brief: Person['brief'];
  reach: Reach;
};

const YOU = 'Amara Nwosu';

const SAMPLE: readonly Sample[] = [
  {
    id: 'dayo',
    name: 'Dayo Adebayo',
    job: 'Floor lead',
    station: 'Floor',
    shift: '15:00 to 23:00',
    mobile: '+2348031110021',
    status: 'opened',
    brief: 'read',
    reach: 'push',
  },
  {
    id: 'grace',
    name: 'Grace Udo',
    job: 'Waiter',
    station: 'Section A',
    shift: '16:00 to 23:00',
    mobile: '+2348031110008',
    status: 'opened',
    brief: 'sent',
    reach: 'push',
  },
  {
    id: 'kelechi',
    name: 'Kelechi Eze',
    job: 'Bar',
    station: 'Bar',
    shift: '16:00 to 00:00',
    mobile: '+2348031110022',
    status: 'opened',
    brief: 'read',
    reach: 'whatsApp',
  },
  {
    id: 'tope',
    name: 'Tope Afolabi',
    job: 'Waiter',
    station: 'Section B',
    shift: '17:00 to 23:00',
    mobile: '+2348031110023',
    status: 'sent',
    brief: 'sent',
    reach: 'push',
  },
  {
    id: 'chidi',
    name: 'Chidi Okafor',
    job: 'Waiter',
    station: 'Section A',
    shift: '17:00 to 23:00',
    mobile: '+2348031110024',
    status: 'none',
    brief: 'none',
    reach: 'sms',
  },
  {
    id: 'yusuf',
    name: 'Yusuf Diallo',
    job: 'Runner',
    station: 'Pass',
    shift: '18:00 to 00:00',
    mobile: '+2348031110025',
    status: 'sent',
    brief: 'sent',
    reach: 'sms',
  },
  {
    id: 'amina',
    name: 'Amina Bello',
    job: 'Waiter',
    station: 'Section B',
    shift: '18:00 to 23:00',
    mobile: null,
    status: 'none',
    brief: 'none',
    reach: 'none',
  },
];

export function shiftPeople(): Person[] {
  return SAMPLE.map((one) => ({
    ...one,
    trail:
      one.status === 'sent'
        ? { by: YOU, at: '18:02' }
        : one.status === 'opened'
          ? { by: '', at: '18:31' }
          : null,
    channel: one.reach === 'whatsApp' ? 'whatsApp' : 'sms',
    heldText: false,
    waitText: false,
    briefCopy: null,
    notice: one.reach === 'none' ? { kind: 'unreachable' } : null,
    ended: null,
  }));
}

type Edit = Partial<Pick<Person, 'brief' | 'notice' | 'ended'>>;

function edited(edits: Record<string, Edit>, base: Person[] = shiftPeople()): Person[] {
  return base.map((one) => ({ ...one, ...edits[one.id] }));
}

const LIST: Record<string, Edit> = {
  dayo: {
    brief: 'changed',
    notice: {
      kind: 'waiting',
      at: GOES_AT,
      day: NOW_DAY,
      was: 'read',
      changes: [{ field: 'start', now: '15:00', was: '17:00' }],
    },
  },
  grace: { notice: { kind: 'told', on: NOW_DAY, at: '15:42', by: 'push' } },
  kelechi: {
    brief: 'changed',
    notice: { kind: 'quiet', day: 'Friday', at: '09:00', was: 'read', on: REMINDER_DAY },
  },
  yusuf: { brief: 'changed', notice: { kind: 'failed', reason: CARRIER_REFUSED } },
};

const EVE: Record<string, Edit> = {
  dayo: { notice: { kind: 'told', on: NOW_DAY, at: GOES_AT, by: 'push' } },
  grace: { notice: { kind: 'told', on: NOW_DAY, at: '15:42', by: 'push' } },
  kelechi: { notice: { kind: 'told', on: REMINDER_DAY, at: '09:00', by: 'whatsApp' } },
  yusuf: { brief: 'changed', notice: { kind: 'failed', reason: CARRIER_REFUSED } },
};

const CALLED_OFF: Record<string, Edit> = {
  dayo: { notice: { kind: 'told', on: NOW_DAY, at: NOW_AT, by: 'push' }, ended: 'calledOff' },
  grace: { notice: { kind: 'told', on: NOW_DAY, at: NOW_AT, by: 'push' }, ended: 'calledOff' },
  tope: { notice: { kind: 'told', on: NOW_DAY, at: NOW_AT, by: 'push' }, ended: 'calledOff' },
  kelechi: {
    notice: { kind: 'quiet', day: 'Friday', at: '09:00', was: 'read', on: REMINDER_DAY },
    ended: 'calledOff',
  },
  yusuf: { notice: { kind: 'failed', reason: CARRIER_REFUSED }, ended: 'calledOff' },
};

const ENDED_AT = '16:30';

const ENDED: Record<string, Edit> = {
  dayo: { notice: { kind: 'told', on: NOW_DAY, at: GOES_AT, by: 'push' } },
  grace: { notice: { kind: 'told', on: REMINDER_DAY, at: '21:25', by: 'push' } },
  kelechi: { notice: { kind: 'told', on: REMINDER_DAY, at: '09:00', by: 'whatsApp' } },
  tope: { notice: { kind: 'told', on: EVENT_DAY, at: ENDED_AT, by: 'push' }, ended: 'ended' },
  yusuf: { notice: { kind: 'told', on: EVENT_DAY, at: ENDED_AT, by: 'sms' }, ended: 'ended' },
};

export interface ShiftStart {
  title: string;
  what: string;
  people: Person[];
  roster: RosterState;
  manage: boolean;
  billing: boolean;
  on: boolean;
  saveFails: boolean;
  failedAt: boolean | null;
  finished: Finished | null;
  lastSent: { date: string; count: number } | null;
  balance: number;
  ask: Ask;
  owners: number;
  overNotice: boolean;
}

const SENT_FRIDAY = { date: REMINDER_DAY, count: 5 };

function start(o: Partial<ShiftStart> & Pick<ShiftStart, 'title' | 'what'>): ShiftStart {
  return {
    people: edited(LIST),
    roster: 'smsOn',
    manage: true,
    billing: true,
    on: true,
    saveFails: false,
    failedAt: null,
    finished: null,
    lastSent: null,
    balance: 1500,
    ask: 'ready',
    owners: 2,
    overNotice: false,
    ...o,
  };
}

const STATES = {
  list: () =>
    start({
      title: 'The card and every roster line',
      what: 'Next on Friday, Oct 16, to 5 people; 2 using 93 of your credits; Goes at, Held, Told, Not delivered, Can’t be reached',
    }),
  eve: () =>
    start({
      title: 'The eve, reminder sent',
      what: 'Sent on Friday, Oct 16, to 5 people. No cost line',
      people: edited(EVE),
      lastSent: SENT_FRIDAY,
    }),
  reminder_off: () =>
    start({
      title: 'The switch off',
      what: 'Off, with what it does; nothing goes, so no Next line',
      on: false,
    }),
  switch_failed: () =>
    start({
      title: 'The switch did not save',
      what: 'Couldn’t save. The reminder is still on.',
      saveFails: true,
      failedAt: true,
    }),
  none_briefed: () =>
    start({
      title: 'Nobody briefed yet',
      what: 'Nobody to remind yet. 6 have not had their briefing; 1 can’t be reached',
      people: shiftPeople().map((one) => ({ ...one, brief: 'none', status: 'none', trail: null })),
    }),
  read_only: () =>
    start({
      title: 'staff.read only',
      what: 'On as a word, no switch; the Next, cost and left-out lines still',
      manage: false,
      billing: false,
      roster: 'smsReadOnly',
    }),
  empty: () =>
    start({
      title: 'Nobody on the staff',
      what: 'Nobody to remind yet.',
      people: [],
      roster: 'empty',
    }),
  cost_credits: () =>
    start({
      title: 'Paid with credits',
      what: '2 by text or WhatsApp, using 93 of your credits. Credits only: texts have nothing included',
    }),
  no_credits: () =>
    start({
      title: 'No credits left',
      what: 'Kelechi reads Not delivered: no credits left. beside Copy link; Send again stays',
      people: edited({
        ...LIST,
        kelechi: { brief: 'changed', notice: { kind: 'failed', reason: NO_CREDITS } },
      }),
      balance: 0,
    }),
  cost_short: () =>
    start({
      title: 'Credits short, billing.manage',
      what: '1 person will not get the reminder…, then Credits cannot be added in the app. No link and no button',
      balance: 40,
    }),
  cost_short_read_only: () =>
    start({
      title: 'Credits short, staff.read',
      what: '2 people will not get the reminder…, with Ask an owner. Press it',
      manage: false,
      billing: false,
      roster: 'smsReadOnly',
      balance: 0,
    }),
  cost_short_asked: () =>
    start({
      title: 'Ask an owner, sent',
      what: 'The owners have been sent the link to Plan and billing.',
      manage: false,
      billing: false,
      roster: 'smsReadOnly',
      balance: 0,
      ask: 'sent',
    }),
  cost_short_asked_one: () =>
    start({
      title: 'Ask an owner, sent to the one owner',
      what: 'The owner has been sent the link to Plan and billing.',
      manage: false,
      billing: false,
      roster: 'smsReadOnly',
      balance: 0,
      ask: 'sent',
      owners: 1,
    }),
  cost_short_ask_failed: () =>
    start({
      title: 'Ask an owner, not sent',
      what: 'Not sent. Try again in a moment. Press Ask an owner again',
      manage: false,
      billing: false,
      roster: 'smsReadOnly',
      balance: 0,
      ask: 'failed',
    }),
  called_off: () =>
    start({
      title: 'Called off',
      what: 'No reminder will be sent: the event has been called off. Rows read Called off',
      people: edited(CALLED_OFF),
      finished: 'calledOff',
    }),
  event_ended: () =>
    start({
      title: 'Ended with End now',
      what: 'Sent on Friday, Oct 16, to 5 people. Tope and Yusuf read Event ended',
      people: edited(ENDED),
      finished: 'ended',
      lastSent: SENT_FRIDAY,
    }),
  finished_sent: () =>
    start({
      title: 'Past its end',
      what: 'Sent on Friday, Oct 16, to 5 people. Rows as on the eve',
      people: edited(EVE),
      finished: 'ended',
      lastSent: SENT_FRIDAY,
    }),
  finished_switch_off: () =>
    start({
      title: 'Ended, the switch was off',
      what: 'No reminder will be sent: the event has ended.',
      people: edited(ENDED),
      finished: 'ended',
      on: false,
    }),
  finished_refused: () =>
    start({
      title: 'A send refused after End now',
      what: 'This event is already over., then the page reloads Finished',
      people: edited(ENDED),
      finished: 'ended',
      lastSent: SENT_FRIDAY,
      overNotice: true,
    }),
} satisfies Record<string, () => ShiftStart>;

export type ShiftState = keyof typeof STATES;

export const SHIFT_STATES = Object.keys(STATES) as ShiftState[];

export function shiftStateOf(raw: string | null | undefined): ShiftState | null {
  return raw != null && Object.hasOwn(STATES, raw) ? (raw as ShiftState) : null;
}

export function shiftStart(state: ShiftState): ShiftStart {
  return STATES[state]();
}

export function briefingFor(shift: ShiftStart): BriefingStart {
  return {
    title: shift.title,
    what: shift.what,
    people: shift.people,
    side: null,
    access: shift.manage ? 'manage' : 'read',
    live: true,
    finished: false,
    concluded: !sendsOffered(shift.finished),
    anyLayout: true,
    rules: RULES,
    draft: null,
    cut: false,
    saved: false,
    copy: 'works',
    busy: null,
    missed: null,
    handHeld: null,
    loading: false,
    checkAt: 'shown',
    balance: shift.balance,
    billing: shift.billing,
    sendFails: false,
    quiet: false,
    result: null,
  };
}

export const SHIFT_NOTICE_BOARDS = SHIFT_STATES.map((state) => ({
  title: `Shift notices · ${STATES[state]().title}`,
  what: STATES[state]().what,
  href: `/demo/events/evt-wed-4?area=staff&staff=${STATES[state]().roster}&shift=${state}`,
}));
