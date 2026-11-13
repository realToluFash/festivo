import { instantOf } from '../events/EventsModel.ts';
import type { SampleEvent } from '../events/EventsSample.ts';
import type { TellChange } from './MessagesModel.ts';
import { BALANCE, EVENT, PLACE, TELL } from './MessagesSample.ts';
import { W, say } from './MessagesWords.ts';

/** sc-4330's states beyond `tell`, `untold` and `tellPlace`, as Messaging-B-Tell-Notes numbers them, each a `?state=` in both demos. */
export const TELL_KINDS = [
  'tellDates',
  'tellDateTime',
  'tellVenueAdded',
  'tellVenueGone',
  'tellAddress',
  'tellAddressAdded',
  'tellPause',
  'tellCallOff',
  'tellResume',
  'tellEndNow',
  'tellTables',
  'tellMenu',
  'tellLink',
  'tellSeeWho',
  'tellHeld',
  'tellQuiet',
  'tellMerged',
  'tellMixed',
  'untoldEvent',
  'untoldMerged',
  'untoldPaused',
  'untoldDismissed',
  'changeSending',
  'changeRow',
  'changeSent',
  'changeMerged',
  'changeDone',
  'tellMenuOne',
  'sendOffline',
  'sendUnconfirmed',
  'sendRefusedRole',
  'sendRefusedEvent',
  'sendRefusedFinished',
  'sendRefusedDeleted',
  'sendRefused',
  'allTold',
  'figuresLoading',
  'figuresPressedEarly',
  'figuresFailed',
] as const;

export type TellKind = (typeof TELL_KINDS)[number];

export function isTellKind(state: string | null): state is TellKind {
  return state != null && (TELL_KINDS as readonly string[]).includes(state);
}

export interface TellFigures {
  count: number;
  email: number;
  sms: number;
  wa: number;
  cannot: number;
  /** Null when only email goes: no cost line. */
  credits: number | null;
  balance: number;
}

export const STANDARD: TellFigures = {
  count: TELL.count,
  email: TELL.email,
  sms: TELL.sms,
  wa: TELL.wa,
  cannot: TELL.cannot,
  credits: TELL.credits,
  balance: BALANCE,
};

const FIGURES = {
  callOff: { count: 142, email: 124, sms: 35, wa: 4, cannot: 9, credits: 48, balance: BALANCE },
  tables: { count: 96, email: 92, sms: 28, wa: 3, cannot: 2, credits: 39, balance: BALANCE },
  menu: { count: 6, email: 6, sms: 0, wa: 0, cannot: 0, credits: null, balance: BALANCE },
  link: { count: 1, email: 1, sms: 0, wa: 1, cannot: 0, credits: 5, balance: BALANCE },
  one: { count: 1, email: 1, sms: 0, wa: 1, cannot: 0, credits: 4, balance: BALANCE },
  held: { ...STANDARD, credits: 20, balance: 20 },
} satisfies Record<string, TellFigures>;

/** See who's people, A to Z, each with the email's reason then the phone's (pm, 13 Nov, #45227). */
export const UNREACHABLE = [
  { name: 'Joaquín Ruiz', why: `${W.noEmail} · ${W.noPhone}` },
  { name: 'Sophie Laurent', why: `${W.unsubscribed} · ${W.textedStop}` },
] as const;

export const NOTE_TYPED = 'Dinner is still at 20:00.';
export const NOTE_SENT =
  'We have brought the start forward half an hour, so there is time for photographs before dinner. Dinner is still at 20:00.';

const LANDMARK = 'The Landmark';
const LANDMARK_AT = '222 Marylebone Road, London NW1 6JQ';
const PLACE_VENUE = { name: PLACE.name, address: PLACE.address, place: PLACE.place };

export function fieldEvents(
  state: string | null,
  sample: SampleEvent,
): { told: SampleEvent; now: SampleEvent } | null {
  const at = (date: string, time: string) => instantOf(date, time, sample.timeZone);
  const startLater = { ...sample, startsAt: TELL.startsAt };
  switch (state) {
    case 'tellDates':
      return { told: sample, now: { ...sample, endsAt: at('2026-11-08', '15:00') } };
    case 'tellDateTime':
      return {
        told: sample,
        now: { ...sample, startsAt: at('2026-11-06', '17:00'), endsAt: at('2026-11-06', '23:00') },
      };
    case 'tellVenueAdded':
      return { told: { ...sample, venue: null }, now: { ...sample, venue: PLACE_VENUE } };
    case 'tellVenueGone':
      return { told: sample, now: { ...sample, venue: null } };
    case 'tellAddress':
      return {
        told: {
          ...sample,
          venue: { name: LANDMARK, address: '22 Marylebone Road, London NW1 6JQ', place: 'London' },
        },
        now: sample,
      };
    case 'tellAddressAdded':
      return {
        told: { ...sample, venue: { name: LANDMARK, address: '', place: 'London' } },
        now: { ...sample, venue: { name: LANDMARK, address: LANDMARK_AT, place: 'London' } },
      };
    case 'tellMerged':
    case 'untoldMerged':
      return { told: sample, now: { ...startLater, venue: PLACE_VENUE } };
    case 'tellMixed':
      return { told: sample, now: { ...sample, venue: PLACE_VENUE } };
    default:
      return state != null && STARTS_LATER.includes(state)
        ? { told: sample, now: startLater }
        : null;
  }
}

const STARTS_LATER: readonly string[] = [
  'tellSeeWho',
  'tellHeld',
  'tellQuiet',
  'untoldEvent',
  'changeSending',
  'changeRow',
  'changeSent',
  'sendOffline',
  'sendUnconfirmed',
  'sendRefusedRole',
  'sendRefusedEvent',
  'sendRefusedFinished',
  'sendRefusedDeleted',
  'sendRefused',
  'allTold',
  'figuresLoading',
  'figuresPressedEarly',
  'figuresFailed',
];

export function eventBehind(state: string | null, event: SampleEvent, now: Date): SampleEvent {
  if (state === 'tellPause' || state === 'untoldPaused') return { ...event, status: 'paused' };
  if (state === 'tellCallOff' || state === 'tellEndNow')
    return { ...event, status: 'ended', concludedAt: now.toISOString() };

  return event;
}

/** End now opens Tell guests only while a later day of the event was still to come; an end at midnight belongs to the day before. */
export function dayStillToCome(event: SampleEvent, now: Date): boolean {
  const day = (at: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: event.timeZone }).format(at);

  return day(now) < day(new Date(Date.parse(event.endsAt) - 1));
}

const one = (line: string, item: string): TellChange => ({ lines: [line], what: [item] });

export function sheetOf(state: TellKind, fields: TellChange | null): TellChange {
  const field = fields ?? { lines: [], what: [] };
  switch (state) {
    case 'tellPause':
    case 'untoldPaused':
      return one(say.pausedFor(EVENT), W.pausedItem);
    case 'tellCallOff':
      return {
        ...one(say.calledOff(EVENT), W.calledOffItem),
        who: W.everyoneInvited,
        figures: FIGURES.callOff,
      };
    case 'tellResume':
      return { ...one(say.backOn(EVENT), W.backOnItem), who: W.toldItPaused };
    case 'tellEndNow':
      return one(say.endedEarly(EVENT), W.endedEarlyItem);
    case 'tellTables':
      return {
        ...one(say.tableReady(EVENT), W.tablesShared),
        who: W.comingWithTable,
        tables: true,
        figures: FIGURES.tables,
      };
    case 'tellMenu':
    case 'changeDone':
      return {
        ...one(say.dishGone(EVENT), W.menuAgain),
        who: W.chooseAgain,
        figures: FIGURES.menu,
      };
    case 'tellMenuOne':
      return {
        ...one(say.dishGone(EVENT), W.menuAgain),
        who: W.chooseAgain,
        name: 'Lucía Ortega',
        figures: FIGURES.one,
      };
    case 'tellLink':
      return {
        ...one(say.newLinkSent(EVENT), say.newLinkFor('Kwame Mensah')),
        who: null,
        name: 'Kwame Mensah',
        figures: FIGURES.link,
      };
    case 'tellHeld':
      return { ...field, figures: FIGURES.held, held: 14 };
    case 'tellQuiet':
      return { ...field, quiet: { count: 3, time: '09:00' } };
    case 'tellMixed':
      return {
        lines: [],
        what: [...field.what, W.tablesShared],
        address: field.address === true,
        tables: true,
        who: null,
        parts: [
          { item: field.what[0] ?? W.newVenue, lines: field.lines, who: W.tellWho },
          { item: W.tablesShared, lines: [say.tableReady(EVENT)], who: W.comingWithTable },
        ],
      };
    default:
      return field;
  }
}

/** The polite or alerting line under the credits (pm, 13 Nov, #45340, #45474). */
export interface TellLine {
  words: string;
  alert: boolean;
}

export type TellNext = 'sent' | 'allTold' | 'refused';

export interface TellRun {
  figures: 'loading' | 'shown' | 'failed';
  line: TellLine | null;
  early: boolean;
  arriving: boolean;
  next: TellNext;
  note: string;
  seeWho: boolean;
  tries: number;
}

export const RUN: TellRun = {
  figures: 'shown',
  line: null,
  early: false,
  arriving: false,
  next: 'sent',
  note: '',
  seeWho: false,
  tries: 0,
};

const failed = (words: string, next: TellNext): TellRun => ({
  ...RUN,
  line: { words, alert: true },
  next,
  note: NOTE_TYPED,
});

export function runOf(state: string | null): TellRun {
  switch (state) {
    case 'tellSeeWho':
      return { ...RUN, seeWho: true };
    case 'sendOffline':
      return failed(W.sendOffline, 'sent');
    case 'sendUnconfirmed':
      return failed(W.sendUnconfirmed, 'allTold');
    case 'sendRefusedRole':
      return failed(W.sendRefusedRole, 'refused');
    case 'sendRefusedEvent':
      return failed(W.sendRefusedDraft, 'refused');
    case 'sendRefusedFinished':
      return failed(W.sendRefusedFinished, 'refused');
    case 'sendRefusedDeleted':
      return failed(W.sendRefusedDeleted, 'refused');
    case 'sendRefused':
      return failed(W.sendRefused, 'sent');
    case 'figuresLoading':
      return { ...RUN, figures: 'loading' };
    case 'figuresPressedEarly':
      return { ...RUN, line: { words: W.pressedEarly, alert: false } };
    case 'figuresFailed':
      return { ...RUN, figures: 'failed', line: { words: W.figuresFailed, alert: true } };
    default:
      return RUN;
  }
}

export type Pressed = { kind: 'run'; run: TellRun } | { kind: 'close'; told: 'sent' | 'allTold' };

/** Send never sends before the figures show, and a refusal keeps the sheet; nothing retries by itself. */
export function pressSend(run: TellRun): Pressed {
  if (run.figures === 'loading')
    return { kind: 'run', run: { ...run, early: true, arriving: true, line: null } };
  if (run.figures === 'failed')
    return { kind: 'run', run: { ...run, figures: 'loading', arriving: true, line: null } };
  if (run.next === 'refused') return { kind: 'run', run: { ...run, tries: run.tries + 1 } };

  return { kind: 'close', told: run.next === 'allTold' ? 'allTold' : 'sent' };
}

/** The figures show: a press made while they loaded is answered now, and sends nothing. */
export function figuresArrive(run: TellRun): TellRun {
  return {
    ...run,
    figures: 'shown',
    arriving: false,
    early: false,
    line: run.early ? { words: W.pressedEarly, alert: false } : null,
  };
}

/** The sheet's title: `Tell guests?` until the figures show, a name for one guest, else the count. */
export function tellTitle(change: TellChange, run: TellRun): string {
  if (run.figures !== 'shown') return W.tellGuests;
  if (change.name != null) return say.tellName(change.name);

  return say.tell((change.figures ?? STANDARD).count);
}

export function sendingWords(change: TellChange): string {
  return change.name != null
    ? say.sendingToName(change.name)
    : say.sendingTo((change.figures ?? STANDARD).count);
}

export function changeTitle(what: readonly string[]): string {
  return say.change(what.length === 1 ? (what[0] ?? '') : say.changes(what.length));
}
