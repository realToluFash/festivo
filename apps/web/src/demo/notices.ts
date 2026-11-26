import type { Brief } from './briefing.ts';
import { WW } from './messagesWaitsWords.ts';

export type Channel = 'push' | 'text' | 'whatsApp';

export type Change =
  | { field: 'start' | 'end' | 'job' | 'date' | 'venue'; now: string; was: string }
  | { field: 'shiftAdded' | 'shiftOff'; shift: string }
  | { field: 'shiftRetimed'; now: string; was: string }
  | { field: 'noShift' };

const SHIFT_WORDS = {
  shiftAdded: (shift: string) => `Assigned ${shift}`,
  shiftOff: (shift: string) => `Unassigned ${shift}`,
  shiftRetimed: (now: string, was: string) => `Shift ${now} (was ${was})`,
  noShift: 'No shift left, still on the staff',
};

function changeWords(change: Change): string {
  switch (change.field) {
    case 'shiftAdded':
    case 'shiftOff':
      return SHIFT_WORDS[change.field](change.shift);
    case 'shiftRetimed':
      return SHIFT_WORDS.shiftRetimed(change.now, change.was);
    case 'noShift':
      return SHIFT_WORDS.noShift;
    default:
      return `${CHANGE_WORD[change.field]} ${change.now} (was ${change.was})`;
  }
}

export type Notice =
  | { kind: 'waiting'; at: string; changes: readonly Change[] }
  | { kind: 'quiet'; day: string; at: string }
  | { kind: 'told'; on: string; at: string; by: Channel }
  | { kind: 'failed'; reason: string };

export type Concluded = 'calledOff' | 'ended';

export type Mark = 'waiting' | 'quiet' | 'told' | 'failed' | 'unreachable' | Concluded;

export interface Reachable {
  brief: Brief;
  shift: string | null;
  mobile: string | null;
  app?: boolean;
  notice?: Notice | null;
  ending?: Concluded | null;
}

export const REMINDER_AT = '10:00';
export const NO_CREDITS = 'no credits left';

const people = (n: number, one: string, other: string) =>
  (n === 1 ? one : other).replace('{count}', String(n));

const CHANGE_WORD = { start: 'Start', end: 'End', job: 'Job', date: 'Date', venue: 'Venue' };
const BY = { push: 'push', text: 'text', whatsApp: 'WhatsApp' } satisfies Record<Channel, string>;

export const NW = {
  card: 'Reminder the day before',
  switchLabel: 'Remind each person the day before their shift',
  on: 'On',
  off: 'Off',
  does: (time: string) =>
    `Goes to each person on the day before their shift, at ${time}, the event's time. It carries their start time, the venue, their job and their link.`,
  next: (date: string, n: number) =>
    people(
      n,
      `Next on ${date}, to 1 person as things stand.`,
      `Next on ${date}, to {count} people as things stand.`,
    ),
  nobody: 'Nobody to remind yet.',
  sent: (date: string, n: number) =>
    people(n, `Sent on ${date}, to 1 person.`, `Sent on ${date}, to {count} people.`),
  cost: (n: number, credits: number) =>
    `${n} by text or WhatsApp, using ${credits} of your credits.`,
  short: (n: number) =>
    people(
      n,
      '1 person will not get the reminder by text or WhatsApp: not enough credits. If they have the app, they still get it by push.',
      '{count} people will not get the reminder by text or WhatsApp: not enough credits. If they have the app, they still get it by push.',
    ),
  addCredits: 'Add credits',
  askOwner: WW.askOwner,
  asked: (owners: number) => (owners === 1 ? WW.ownersSent_one : WW.ownersSent_other),
  askFailed: WW.askFailed,
  notBriefed: (n: number) =>
    people(
      n,
      '1 person has not had their briefing, so will not be reminded.',
      '{count} people have not had their briefing, so will not be reminded.',
    ),
  cannotReach: (n: number) =>
    people(n, "1 person can't be reached.", "{count} people can't be reached."),
  notSaved: (on: boolean) =>
    on ? "Couldn't save. The reminder is still on." : "Couldn't save. The reminder is still off.",
  noneCalledOff: 'No reminder will be sent: the event has been called off.',
  noneEnded: 'No reminder will be sent: the event has ended.',
  unreachable: "Can't be reached",
  unreachableLine: "Can't be reached: no push notifications and no mobile number.",
  goesAt: (time: string) => `Goes at ${time}`,
  change: changeWords,
  sameMessage: 'Edits before then go in the same message.',
  quiet: (day: string, time: string) => `Held for quiet hours. Goes ${day} at ${time}.`,
  told: (on: string, time: string, by: Channel) => `Told on ${on} at ${time}, by ${BY[by]}.`,
  failed: (reason: string) => `Not delivered: ${reason}.`,
  calledOff: 'Called off',
  ended: 'Event ended',
  removal: (name: string) =>
    `${name} gets one last message within 15 minutes to say so, and nothing after that.`,
  alreadyOver: 'This event is already over.',
  footnote:
    "Once a person's briefing has gone, changes to their shifts are sent to them automatically.",
};

export function reachable(one: Reachable): boolean {
  return one.app === true || one.mobile != null;
}

/** The roster's state word: a person nobody can reach reads Can't be reached in place of Not sent, and is not counted as briefed. */
export function stateOf(one: Reachable): Brief | 'unreachable' {
  if (one.shift != null && !reachable(one)) return 'unreachable';

  return one.brief;
}

/** The lines under the state word in the Briefing column, each with its own mark; a change still waiting once the event is Finished sends nothing, so it is not shown. */
export function rowLines(
  one: Reachable,
  concluded: Concluded | null,
): { mark: Mark | null; words: string }[] {
  if (stateOf(one) === 'unreachable') return [{ mark: 'unreachable', words: NW.unreachableLine }];
  const lines: { mark: Mark | null; words: string }[] = [];
  const notice = one.notice ?? null;
  if (notice?.kind === 'waiting' && concluded == null) {
    lines.push({ mark: 'waiting', words: NW.goesAt(notice.at) });
    for (const change of notice.changes) lines.push({ mark: null, words: NW.change(change) });
    lines.push({ mark: null, words: NW.sameMessage });
  }
  if (notice?.kind === 'quiet')
    lines.push({ mark: 'quiet', words: NW.quiet(notice.day, notice.at) });
  if (notice?.kind === 'told')
    lines.push({ mark: 'told', words: NW.told(notice.on, notice.at, notice.by) });
  if (notice?.kind === 'failed') lines.push({ mark: 'failed', words: NW.failed(notice.reason) });
  if (one.ending != null)
    lines.push({ mark: one.ending, words: one.ending === 'calledOff' ? NW.calledOff : NW.ended });

  return lines;
}

/** Send the briefing to {n}, Send to {n} changed and Send again are not offered once the event is Finished; Copy link and Preview as stay. */
export function sendsOffered(live: boolean, concluded: Concluded | null): boolean {
  return live && concluded == null;
}

/** The removal confirm's line: only a person whose briefing went, who can be reached, before the event is Finished. */
export function removalLine(
  one: Reachable & { name: string },
  concluded: Concluded | null,
): string | null {
  if (concluded != null || one.brief === 'none' || !reachable(one)) return null;

  return NW.removal(one.name);
}

export interface Preview {
  count: number;
  credits: number;
  short: number;
}

/** sc-3931's reservation preview for the next S3: each text paid only while the credits cover its whole cost. Texts have nothing included (sc-3931, 31 Oct). */
export function previewOf(costs: readonly number[], balance: number): Preview {
  let left = balance;
  const preview: Preview = { count: costs.length, credits: 0, short: 0 };
  for (const cost of costs) {
    if (cost <= left) {
      left -= cost;
      preview.credits += cost;
    } else preview.short += 1;
  }

  return preview;
}

export function costLine(preview: Preview): string | null {
  if (preview.count === 0 || preview.short > 0) return null;

  return NW.cost(preview.count, preview.credits);
}

export interface Reminder {
  on: boolean;
  next: string;
  sent: { date: string; count: number } | null;
  concluded: Concluded | null;
  balance: number;
}

export type Card =
  | { kind: 'finished'; line: string }
  | {
      kind: 'open';
      top: string | null;
      cost: string | null;
      short: number;
      left: string[];
    };

export function remindedOf<T extends Reachable>(list: readonly T[]): T[] {
  return list.filter((one) => one.shift != null && one.brief !== 'none' && reachable(one));
}

/** The card's lines: once the event is Finished, only the Sent line or why none goes; while the switch is off, nothing under what it does. */
export function cardOf<T extends Reachable>(
  list: readonly T[],
  reminder: Reminder,
  creditsOf: (one: T) => number,
): Card {
  if (reminder.concluded != null) {
    if (reminder.sent != null)
      return { kind: 'finished', line: NW.sent(reminder.sent.date, reminder.sent.count) };

    return {
      kind: 'finished',
      line: reminder.concluded === 'calledOff' ? NW.noneCalledOff : NW.noneEnded,
    };
  }
  if (!reminder.on) return { kind: 'open', top: null, cost: null, short: 0, left: [] };
  if (reminder.sent != null)
    return {
      kind: 'open',
      top: NW.sent(reminder.sent.date, reminder.sent.count),
      cost: null,
      short: 0,
      left: [],
    };

  const onShift = list.filter((one) => one.shift != null);
  const reminded = remindedOf(list);
  const notBriefed = onShift.filter((one) => one.brief === 'none' && reachable(one)).length;
  const cannotReach = onShift.filter((one) => !reachable(one)).length;
  const left = [
    ...(notBriefed > 0 ? [NW.notBriefed(notBriefed)] : []),
    ...(cannotReach > 0 ? [NW.cannotReach(cannotReach)] : []),
  ];

  const preview = previewOf(
    reminded.filter((one) => one.app !== true).map(creditsOf),
    reminder.balance,
  );

  return {
    kind: 'open',
    top: reminded.length === 0 ? NW.nobody : NW.next(reminder.next, reminded.length),
    cost: costLine(preview),
    short: preview.short,
    left,
  };
}
