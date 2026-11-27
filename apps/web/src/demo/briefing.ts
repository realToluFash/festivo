import { type Entry, type RosterStart, rosterWith, sample } from './roster.ts';
import { type Change, type Concluded, type Notice, NO_CREDITS, NW } from './notices.ts';
import type { DemoLink } from './settings.ts';
import { type Delivered, type Trail, NOW_AT, YOU, afterCopy } from './staffLink.ts';
import { QUIET_ENDS, TW, texting } from './staffText.ts';
import { STATIONS_EVENT } from './stations.ts';

/** The briefing on the event's Staff page (sc-3917, Staffing.dc.html › Tweaks › Briefing on page e34): house rules and everyone's shift, sent with one tap. */
export type Brief = 'read' | 'sent' | 'none' | 'changed';

export interface Person extends Entry {
  brief: Brief;
  /** A briefing text waiting for credits (sc-3932): it goes by itself once there are credits. */
  heldText: boolean;
  /** A briefing text waiting for 09:00 in their time (sc-3946's quiet hours): it goes by itself then. */
  waitText: boolean;
  /** How the briefing reaches them when it goes; push is free and is never counted. */
  channel: 'sms' | 'whatsApp';
  /** A copy from the briefing (the copy list, a changed row or the held result), and whether it was then marked as sent. */
  briefCopy: { trail: Trail; marked: boolean } | null;
  /** Signed in to the app with notifications allowed: told by push, which is never counted. */
  app?: boolean;
  notice?: Notice | null;
  ending?: Concluded | null;
}

export const RULES_MAX = 2000;
export const RULES_COUNT_FROM = 1800;
export const SMS_CREDITS = 62;
export const WHATSAPP_CREDITS = 31;
export const BALANCE = 1500;

const number = new Intl.NumberFormat('en-GB');
const n0 = (n: number) => number.format(n);
const plural = (n: number, one: string, other: string) =>
  (n === 1 ? one : other).replace('{n}', n0(n));

export const BW = {
  card: 'Briefing',
  cardSub: 'House rules and everyone’s shift, on their own page.',
  tally: {
    read: 'Read',
    sent: 'Sent, not read',
    changed: 'Changed since sent',
    none: 'Not sent',
  } satisfies Record<Brief, string>,
  sendAll: (n: number) => `Send the briefing to ${n0(n)}`,
  sendChanged: (n: number) => `Send to ${n0(n)} changed`,
  sendAgain: 'Send again',
  copy: 'Copy link',
  editRules: 'Edit the rules',
  rules: 'House rules',
  previewAs: 'Preview as',
  column: 'Briefing',
  noMobile: 'No mobile number',
  noShift: 'No shift, so nothing to send',
  held: 'Held: no credits',
  stopped: TW.stopped,
  waits: TW.waits,
  copyTitle: 'Copy a person’s link',
  copySub: 'Everyone with a shift. Copy a link to send it yourself, by any app.',
  copied: 'Link copied.',
  notCopied: '[Not copied. That did not work. Try again in a moment.]',
  refused: 'The link could not be copied. Copy it from the link field.',
  linkFor: (name: string) => `Link for ${name}`,
  link: 'Link',
  copiedBy: (trail: Trail) => `Copied by ${trail.by} · ${trail.at} · not marked as sent`,
  markedBy: (trail: Trail) => `Marked as sent by ${trail.by} · ${trail.at}`,
  markSent: 'Mark as sent',
  forBriefing: (act: string, name: string) => `${act} for the briefing: ${name}`,
  marked: (name: string) => `[Marked as sent to ${name}.]`,
  nobody: '[Nobody has a shift yet.]',
  giveShift: '[Give someone a shift]',
  roster: 'Roster',
  close: 'Close',
  cancel: 'Cancel',
  notBuilt: 'AC, not yet built',
  rulesNone: '[No house rules yet.]',
  rulesWhere: '[They show as Before you start on everyone’s shift page.]',
  rulesLabel: 'House rules',
  save: 'Save changes',
  count: (n: number) => `[${n0(n)} of ${n0(RULES_MAX)} characters]`,
  atLimit: `[${n0(RULES_MAX)} of ${n0(RULES_MAX)} characters. That is the limit.]`,
  cut: `That was longer than ${n0(RULES_MAX)} characters, so the end was left out.`,
  saved: '[Saved. The rules are on everyone’s shift page now.]',
  notSaved: 'The rules were not saved. Try again in a moment.',
  previewWho: 'Whose page',
  previewBanner: '[Preview only. Nothing is recorded: no read and no link open.]',
  previewNoShift: (day: string) => `[You are on the staff for ${day}, with no shift yet.]`,
  previewLoading: 'Loading their page…',
  didNotWork: 'That did not work. Try again in a moment.',
  checkTitle: 'Check it before it goes',
  people: (n: number) => plural(n, '{n} person', '{n} people'),
  smsLine: (n: number, credits: number) =>
    `${plural(n, '{n} SMS message', '{n} SMS messages')} · ${plural(credits, '{n} credit', '{n} credits')}`,
  whatsAppLine: (n: number, credits: number) =>
    `${plural(n, '{n} WhatsApp message', '{n} WhatsApp messages')} · ${plural(credits, '{n} credit', '{n} credits')}`,
  totalLine: (credits: number) => `In total · ${plural(credits, '{n} credit', '{n} credits')}`,
  after: (n: number) => `Credits after sending: ${n0(n)}.`,
  smsWaits: (n: number) =>
    plural(n, '{n} SMS message will wait for credits.', '{n} SMS messages will wait for credits.'),
  whatsAppWaits: (n: number) =>
    plural(
      n,
      '{n} WhatsApp message will wait for credits.',
      '{n} WhatsApp messages will wait for credits.',
    ),
  noMobileCount: (m: number) => plural(m, '1 has no mobile number.', '{n} have no mobile number.'),
  usage: '[Shows as Staff briefing in usage.]',
  addCredits: 'Add credits',
  askOwner: 'Ask an owner',
  working: '[Working out the cost…]',
  costFailed: '[The cost did not load, so nothing was sent.]',
  tryAgain: 'Try again',
  sentTo: (n: number) => `Sent to ${n0(n)}.`,
  heldCount: (h: number) => plural(h, '{n} held: no credits.', '{n} held: no credits.'),
  stoppedCount: TW.stoppedCount,
  waitCount: TW.waitCount,
  quiet: TW.quiet,
  sendFailed: '[Not sent. Nothing went, and no credits were used. Try again in a moment.]',
  refusedPage: '[You cannot see this event’s staff.]',
  backToEvent: '[Back to the event]',
  lock: 'You can see the briefing. Sending it needs permission to manage staff.',
  dismiss: 'Dismiss',
};

/** Code points, as the server's Length with mb_strlen counts them: "Ọ̀" is two. */
export function codePoints(text: string): number {
  return Array.from(text).length;
}

/** The rules box takes nothing past 2,000 code points: a key typed at the limit, anywhere in the text, is not taken; a paste that would go over keeps its first part and says so. */
export function fitRules(before: string, typed: string): { text: string; cut: boolean } {
  if (codePoints(typed) <= RULES_MAX) return { text: typed, cut: false };
  if (codePoints(typed) - codePoints(before) <= 1) return { text: before, cut: false };

  return { text: Array.from(typed).slice(0, RULES_MAX).join(''), cut: true };
}

export function countLine(text: string): { words: string; limit: boolean } | null {
  const n = codePoints(text);
  if (n >= RULES_MAX) return { words: BW.atLimit, limit: true };
  if (n >= RULES_COUNT_FROM) return { words: BW.count(n), limit: false };

  return null;
}

export function noteOf(one: Person): string | null {
  if (one.shift == null) return BW.noShift;
  if (one.mobile == null) return BW.noMobile;
  if (one.stopped === true) return BW.stopped;
  if (one.heldText) return BW.held;
  if (one.waitText) return BW.waits(QUIET_ENDS);

  return null;
}

/** A text is owed nobody whose number stopped texts (sc-3946), and nobody with a text already held or waiting: that one goes by itself. */
const textable = (one: Person) =>
  one.mobile != null && one.stopped !== true && !one.heldText && !one.waitText;

export function dueAll(people: readonly Person[]): Person[] {
  return people.filter((one) => textable(one) && one.shift != null && one.brief === 'none');
}

export function dueChanged(people: readonly Person[]): Person[] {
  return people.filter((one) => textable(one) && one.brief === 'changed');
}

export function tallyOf(people: readonly Person[]): Record<Brief, number> {
  const tally: Record<Brief, number> = { read: 0, sent: 0, changed: 0, none: 0 };
  for (const one of people) tally[one.brief] += 1;

  return tally;
}

export function onShift(people: readonly Person[]): Person[] {
  return people.filter((one) => one.shift != null);
}

export function asPerson(made: Entry, before: Entry | null): Person {
  const was = before as Partial<Person> | null;
  const brief = was?.brief ?? 'none';
  const moved = before != null && (before.station !== made.station || before.shift !== made.shift);

  return {
    channel: was?.channel ?? 'sms',
    heldText: was?.heldText ?? false,
    waitText: was?.waitText ?? false,
    briefCopy: was?.briefCopy ?? null,
    ...made,
    brief: moved && (brief === 'sent' || brief === 'read') ? 'changed' : brief,
  };
}

export function afterBriefCopy(one: Person): Person {
  const link = afterCopy(one.link, one.trail ?? null);

  return { ...one, ...link, briefCopy: { trail: { by: YOU, at: NOW_AT }, marked: false } };
}

export function afterBriefMark(one: Person): Person {
  const trail = { by: YOU, at: NOW_AT };
  const link: Delivered = one.link === 'opened' ? 'opened' : 'sent';

  return {
    ...one,
    brief: one.brief === 'read' ? 'read' : 'sent',
    heldText: false,
    waitText: false,
    link,
    trail: link === 'opened' ? (one.trail ?? null) : trail,
    briefCopy: { trail, marked: true },
  };
}

export function afterOpen(one: Person): Person {
  return { ...one, brief: 'read', link: 'opened', trail: { by: '', at: NOW_AT } };
}

export interface Check {
  people: number;
  noMobile: number;
  sms: { n: number; credits: number };
  whatsApp: { n: number; credits: number } | null;
  credits: number;
  after: number;
  smsWaits: number;
  whatsAppWaits: number;
  /** The paid texts that wait for 09:00, their time; at 0 the wait line is left out. */
  quiet: number;
  /** Whose number stopped texts: never texted, and counted in the result only. */
  stopped: number;
  paid: readonly string[];
}

export const cost = (one: Person) => (one.channel === 'whatsApp' ? WHATSAPP_CREDITS : SMS_CREDITS);

export type Target = 'all' | 'changed' | string;

export function noMobileFor(people: readonly Person[], target: Target): number {
  if (target === 'all')
    return people.filter((one) => one.shift != null && one.mobile == null && one.brief === 'none')
      .length;
  if (target === 'changed')
    return people.filter((one) => one.brief === 'changed' && one.mobile == null).length;

  return 0;
}

export function stoppedFor(people: readonly Person[], target: Target): number {
  const stopped = people.filter(
    (one) => one.mobile != null && one.stopped === true && !one.heldText && !one.waitText,
  );
  if (target === 'all')
    return stopped.filter((one) => one.shift != null && one.brief === 'none').length;
  if (target === 'changed') return stopped.filter((one) => one.brief === 'changed').length;

  return 0;
}

/** sc-3931 on sc-3929's reservation preview: a text is paid only when the balance covers its whole cost; the lines count what is paid, and the rest wait. */
export function checkOf(
  due: readonly Person[],
  noMobile: number,
  balance: number,
  at: { stopped?: number; quiet?: boolean } = {},
): Check {
  let left = balance;
  const paid: Person[] = [];
  for (const one of due) {
    if (cost(one) > left) continue;
    left -= cost(one);
    paid.push(one);
  }
  const by = (channel: Person['channel'], list: readonly Person[]) =>
    list.filter((one) => one.channel === channel);
  const whatsApp = by('whatsApp', due);
  const credits = paid.reduce((sum, one) => sum + cost(one), 0);

  return {
    people: due.length,
    noMobile,
    sms: { n: by('sms', paid).length, credits: by('sms', paid).length * SMS_CREDITS },
    whatsApp:
      whatsApp.length === 0
        ? null
        : {
            n: by('whatsApp', paid).length,
            credits: by('whatsApp', paid).length * WHATSAPP_CREDITS,
          },
    credits,
    after: balance - credits,
    smsWaits: by('sms', due).length - by('sms', paid).length,
    whatsAppWaits: whatsApp.length - by('whatsApp', paid).length,
    quiet: at.quiet === true ? paid.length : 0,
    stopped: at.stopped ?? 0,
    paid: paid.map((one) => one.id),
  };
}

export function sendTo(
  people: readonly Person[],
  due: readonly Person[],
  check: Check,
): { people: Person[]; sent: number; held: string[]; waits: string[] } {
  const ids = new Set(due.map((one) => one.id));
  const paid = new Set(check.paid);
  const held: string[] = [];
  const waits: string[] = [];
  const next = people.map((one): Person => {
    if (!ids.has(one.id)) return one;
    if (!paid.has(one.id)) {
      held.push(one.id);
      return { ...one, heldText: true };
    }
    if (check.quiet > 0) {
      waits.push(one.id);
      return { ...one, waitText: true };
    }
    const opened = one.link === 'opened';

    return {
      ...one,
      brief: 'sent',
      notice: null,
      link: opened ? 'opened' : 'sent',
      trail: opened ? (one.trail ?? null) : { by: YOU, at: NOW_AT, via: 'text' },
    };
  });

  return { people: next, sent: paid.size - waits.length, held, waits };
}

/** Sent to {n} counts only who was reached, and is left out at 0; a held or waiting person is counted in their own line alone. */
export function resultLines(
  sent: number,
  noMobile: number,
  held: number,
  stopped = 0,
  waits = 0,
): string[] {
  return [
    ...(sent > 0 ? [BW.sentTo(sent)] : []),
    ...(noMobile > 0 ? [BW.noMobileCount(noMobile)] : []),
    ...(stopped > 0 ? [BW.stoppedCount(stopped)] : []),
    ...(held > 0 ? [BW.heldCount(held)] : []),
    ...(waits > 0 ? [BW.waitCount(waits, QUIET_ENDS)] : []),
  ];
}

const BRIEFS: Record<string, { brief: Brief; channel?: Person['channel'] }> = {
  bisi: { brief: 'read' },
  tayo: { brief: 'sent' },
  ifeoma: { brief: 'read' },
  sade: { brief: 'changed' },
  grace: { brief: 'read' },
  kunle: { brief: 'changed', channel: 'whatsApp' },
  ronke: { brief: 'sent' },
  emeka: { brief: 'none', channel: 'whatsApp' },
};

export function people(): Person[] {
  return sample().map((one) => ({
    ...one,
    brief: BRIEFS[one.id]?.brief ?? 'none',
    channel: BRIEFS[one.id]?.channel ?? 'sms',
    heldText: false,
    waitText: false,
    briefCopy: null,
  }));
}

export const RULES =
  'Black shirt, black trousers, closed shoes.\nPhones stay in the staff room during service.\nAsk the guest before clearing a plate.\nAnything spilled or broken: tell your lead first.';

const LONG_RULES = `${RULES}\n${'Keep the pass clear for the runners. '.repeat(52)}`.slice(0, 1918);
const FULL_RULES = `${RULES}\n${'Keep the pass clear for the runners. '.repeat(60)}`.slice(
  0,
  RULES_MAX,
);

export type Side =
  { kind: 'copy' } | { kind: 'rules'; editing: boolean } | { kind: 'preview'; id: string } | null;

export interface BriefingStart {
  name: string;
  note: string;
  people: Person[];
  side: Side;
  access: 'manage' | 'read' | 'none';
  live: boolean;
  finished: boolean;
  rules: string;
  draft: string | null;
  cut: boolean;
  saved: boolean;
  /** Save changes was refused: the draft stays, with the line under the box. */
  notSaved: boolean;
  previewAt: 'loading' | 'shown' | 'failed';
  copy: 'works' | 'notIssued' | 'refused' | 'slow';
  busy: string | null;
  missed: string | null;
  handHeld: { id: string; url: string } | null;
  check: Target | null;
  checkAt: 'loading' | 'shown' | 'failed';
  balance: number;
  billing: boolean;
  sendFails: boolean;
  /** 22:40 the night before (sc-3946): every shift starts after 09:00 and the event is not Happening now, so texts wait. */
  quiet: boolean;
  result: { lines: string[]; held: string[] } | null;
  said: string | null;
  notices: NoticesStart | null;
}

/** The reminder card and the S2 lines (sc-4333), on its own states only. */
export interface NoticesStart {
  on: boolean;
  /** The switch's save is refused, every time. */
  saves: boolean;
  notSaved: boolean;
  next: string;
  sent: { date: string; count: number } | null;
  concluded: Concluded | null;
  /** Ask an owner, for a person without billing.manage (sc-3931): ready, its sent line, or Not sent. */
  ask: 'ready' | 'sent' | 'failed';
  owners: number;
  removing: string | null;
  /** A page opened before End now: its sends are refused, and it reloads Finished. */
  stale: boolean;
  alreadyOver: boolean;
}

function start(o: Partial<BriefingStart> & Pick<BriefingStart, 'name' | 'note'>): BriefingStart {
  return {
    people: people(),
    side: null,
    access: 'manage',
    live: true,
    finished: false,
    rules: RULES,
    draft: null,
    cut: false,
    saved: false,
    notSaved: false,
    previewAt: 'shown',
    copy: 'works',
    busy: null,
    missed: null,
    handHeld: null,
    check: null,
    checkAt: 'shown',
    balance: BALANCE,
    billing: true,
    sendFails: false,
    quiet: false,
    result: null,
    said: null,
    notices: null,
    ...o,
  };
}

const copied = (id: string) => people().map((one) => (one.id === id ? afterBriefCopy(one) : one));
const marked = (id: string) =>
  people().map((one) => (one.id === id ? afterBriefMark(afterBriefCopy(one)) : one));
const heldOn = (ids: readonly string[]) => (list: Person[]) =>
  list.map((one) => (ids.includes(one.id) ? { ...one, heldText: true } : one));
const HELD = ['amina', 'emeka'];
const afterShortSend = () => {
  const list = people();
  const due = dueAll(list);
  const sent = sendTo(list, due, checkOf(due, noMobileFor(list, 'all'), 70));

  return sent.people;
};
const stoppedOn = (ids: readonly string[]) => (list: Person[]) =>
  list.map((one) => (ids.includes(one.id) ? { ...one, stopped: true } : one));
const STOPPED = ['tolu', 'sade'];
const afterSendAt = (list: Person[], quiet: boolean) => {
  const due = dueAll(list);

  return sendTo(
    list,
    due,
    checkOf(due, noMobileFor(list, 'all'), BALANCE, { stopped: stoppedFor(list, 'all'), quiet }),
  ).people;
};
const SAMPLE_URL = 'https://soirely.com/s/7Gk2pQ9xVb4mT1sR8nLw3c';

const THU = 'Thursday, Oct 15';
const FRI = 'Friday, Oct 16';
const SAT = 'Saturday, Oct 17';
const REFUSED = 'the carrier refused the number';

function onTheShift(
  id: string,
  name: string,
  job: string,
  station: string,
  shift: string,
  o: Partial<Person>,
): Person {
  return {
    id,
    name,
    job,
    station,
    shift,
    more: [],
    mobile: `+447946000${String(name.length).padStart(3, '0')}`,
    email: null,
    link: 'sent',
    trail: null,
    brief: 'sent',
    channel: 'sms',
    heldText: false,
    waitText: false,
    briefCopy: null,
    app: false,
    notice: null,
    ending: null,
    ...o,
  };
}

/** ShiftNotices' sample, one day on Saturday, Oct 17: Kelechi goes by WhatsApp, Yusuf by text, the others briefed by push. */
export function noticePeople(): Person[] {
  return [
    onTheShift('dayo', 'Dayo Adeyemi', 'Floor lead', 'Floor', '14:00 to 23:00', {
      brief: 'read',
      link: 'opened',
      app: true,
    }),
    onTheShift('grace', 'Grace Okafor', 'Waiter', 'Section A', '15:00 to 23:00', {
      brief: 'changed',
      app: true,
      notice: {
        kind: 'waiting',
        at: '19:55',
        changes: [{ field: 'start', now: '15:00', was: '17:00' }],
      },
    }),
    onTheShift('kelechi', 'Kelechi Eze', 'Runner', 'Pass', '16:00 to 23:00', {
      brief: 'changed',
      channel: 'whatsApp',
      notice: { kind: 'quiet', day: 'Friday', at: '09:00' },
    }),
    onTheShift('tope', 'Tope Balogun', 'Waiter', 'Section B', '17:00 to 23:00', {
      app: true,
      notice: { kind: 'told', on: THU, at: '15:42', by: 'push' },
    }),
    onTheShift('chidi', 'Chidi Nwankwo', 'Waiter', 'Section B', '17:00 to 23:00', {
      brief: 'none',
      link: 'none',
    }),
    onTheShift('yusuf', 'Yusuf Bello', 'Bar', 'Bar', '18:00 to 00:00', {
      brief: 'changed',
      notice: { kind: 'failed', reason: REFUSED },
    }),
    onTheShift('amina', 'Amina Lawal', 'Waiter', 'Section A', '18:00 to 00:00', {
      brief: 'none',
      link: 'none',
      mobile: null,
    }),
  ];
}

const reshaped =
  (by: Record<string, Partial<Person>>) =>
  (list: Person[] = noticePeople()): Person[] =>
    list.map((one) => (by[one.id] == null ? one : { ...one, ...by[one.id] }));

const waiting = (changes: readonly Change[]) => ({
  brief: 'changed' as const,
  notice: { kind: 'waiting' as const, at: '19:55', changes },
});

const severalShifts = reshaped({
  grace: {
    shift: 'Saturday 15:00 to 23:00',
    more: ['Sunday 12:00 to 18:00'],
    ...waiting([{ field: 'shiftRetimed', now: 'Saturday 15:00–23:00', was: '17:00–23:00' }]),
  },
  tope: {
    shift: 'Saturday 17:00 to 23:00',
    more: ['Sunday 12:00 to 18:00'],
    ...waiting([{ field: 'shiftAdded', shift: 'Sunday 12:00–18:00' }]),
  },
  yusuf: {
    shift: null,
    more: [],
    ...waiting([{ field: 'shiftOff', shift: 'Saturday 18:00–Sunday 00:00' }, { field: 'noShift' }]),
  },
});

const eve = reshaped({
  grace: { brief: 'sent', notice: { kind: 'told', on: THU, at: '19:55', by: 'push' } },
  kelechi: { brief: 'sent', notice: { kind: 'told', on: FRI, at: '09:00', by: 'whatsApp' } },
});

const calledOff = reshaped({
  dayo: { notice: { kind: 'told', on: THU, at: '19:40', by: 'push' }, ending: 'calledOff' },
  grace: {
    brief: 'sent',
    notice: { kind: 'told', on: THU, at: '19:40', by: 'push' },
    ending: 'calledOff',
  },
  tope: { notice: { kind: 'told', on: THU, at: '19:40', by: 'push' }, ending: 'calledOff' },
  kelechi: { ending: 'calledOff' },
  yusuf: { ending: 'calledOff' },
});

export const endedPeople = reshaped({
  grace: {
    brief: 'read',
    link: 'opened',
    notice: { kind: 'told', on: FRI, at: '21:25', by: 'push' },
  },
  kelechi: {
    brief: 'read',
    link: 'opened',
    notice: { kind: 'told', on: FRI, at: '09:00', by: 'whatsApp' },
  },
  tope: { notice: { kind: 'told', on: SAT, at: '16:30', by: 'push' }, ending: 'ended' },
  yusuf: {
    brief: 'sent',
    notice: { kind: 'told', on: SAT, at: '16:30', by: 'text' },
    ending: 'ended',
  },
});

export const SENT_FRIDAY = { date: FRI, count: 5 };

function notices(o: Partial<NoticesStart> = {}): NoticesStart {
  return {
    on: true,
    saves: true,
    notSaved: false,
    next: FRI,
    sent: null,
    concluded: null,
    ask: 'ready',
    owners: 2,
    removing: null,
    stale: false,
    alreadyOver: false,
    ...o,
  };
}

function noticed(
  o: Partial<BriefingStart> & Pick<BriefingStart, 'name' | 'note'>,
  n: Partial<NoticesStart> = {},
): BriefingStart {
  return start({ people: noticePeople(), ...o, notices: notices(n) });
}

const STATES = {
  populated: () =>
    start({
      name: 'The Briefing card, the column and its four marks',
      note: 'Read 3 · Sent, not read 2 · Changed since sent 2 · Not sent 5. Send the briefing to 3, Send to 2 changed, Copy link.',
    }),
  notLive: () =>
    start({
      name: 'Before epic 36 ships: Copy link alone',
      note: 'not_live: the send buttons are hidden, and Copy link is the way.',
      live: false,
    }),
  finished: () =>
    start({
      name: 'A finished event: no send and no link buttons',
      note: 'sc-3906: the card keeps its tally, House rules and Preview as.',
      finished: true,
    }),
  readOnly: () =>
    start({
      name: 'staff.read only: the states, House rules and Preview as',
      note: 'No Send, no Copy link, no Edit anywhere.',
      access: 'read',
    }),
  refused: () =>
    start({
      name: 'Neither permission: the refusal (403)',
      note: '[You cannot see this event’s staff.] with [Back to the event].',
      access: 'none',
    }),
  changedRow: () =>
    start({
      name: 'A changed row: Send again and Copy link',
      note: 'Sade’s station changed after she was sent it. Press Send again or Copy link on her row.',
    }),
  changedRefused: () =>
    start({
      name: 'A changed row whose copy the browser refused',
      note: 'Counts as a copy: Copied by you, Mark as sent, and the read-only Link for Sade Lawal field.',
      people: copied('sade'),
      handHeld: { id: 'sade', url: SAMPLE_URL },
      said: BW.refused,
    }),
  rulesEmpty: () =>
    start({
      name: 'House rules, none yet',
      note: 'The first-time empty state, with Edit the rules.',
      rules: '',
      side: { kind: 'rules', editing: false },
    }),
  rulesView: () =>
    start({
      name: 'House rules, read',
      note: 'Plain text with its line breaks kept.',
      side: { kind: 'rules', editing: false },
    }),
  rulesViewReadOnly: () =>
    start({
      name: 'House rules for staff.read',
      note: 'The card says House rules, and the panel has no Edit the rules.',
      access: 'read',
      side: { kind: 'rules', editing: false },
    }),
  rulesEdit: () =>
    start({
      name: 'Edit the rules',
      note: 'A labelled box, Save changes and Cancel; no count under 1,800.',
      side: { kind: 'rules', editing: true },
      draft: RULES,
    }),
  rulesCount: () =>
    start({
      name: 'The count from 1,800',
      note: '[1,918 of 2,000 characters]',
      side: { kind: 'rules', editing: true },
      draft: LONG_RULES,
    }),
  rulesLimit: () =>
    start({
      name: 'At the limit',
      note: 'The box takes no more; the count turns amber with a triangle.',
      side: { kind: 'rules', editing: true },
      draft: FULL_RULES,
    }),
  rulesPasted: () =>
    start({
      name: 'A paste over 2,000 kept to 2,000',
      note: 'Announced to screen readers. Paste more in to see it again.',
      side: { kind: 'rules', editing: true },
      draft: FULL_RULES,
      cut: true,
      said: BW.cut,
    }),
  rulesSaved: () =>
    start({
      name: 'The rules saved',
      note: 'Changing the rules sends nothing and sets no Changed since sent.',
      side: { kind: 'rules', editing: false },
      saved: true,
      said: BW.saved,
    }),
  rulesNotSaved: () =>
    start({
      name: 'The rules not saved',
      note: 'Save changes was refused: the draft stays, with the line under the box. Press Save changes to try again.',
      side: { kind: 'rules', editing: true },
      draft: `${RULES}\nNo phones on the floor.`,
      notSaved: true,
      said: BW.notSaved,
    }),
  previewAs: () =>
    start({
      name: 'Preview as Amina Yusuf',
      note: 'sc-3915’s page at phone width with the banner; Clock in and Call are left out. Choose anyone.',
      side: { kind: 'preview', id: 'amina' },
    }),
  previewNoShift: () =>
    start({
      name: 'Preview as a person with no shift',
      note: 'Chinedu Eze: sc-3915’s page for someone on the staff with no shift yet.',
      side: { kind: 'preview', id: 'chinedu' },
    }),
  previewLoading: () =>
    start({
      name: 'Preview as, loading',
      note: 'The select and the banner stay; bones in the phone frame while Amina’s page loads.',
      side: { kind: 'preview', id: 'amina' },
      previewAt: 'loading',
    }),
  previewFailed: () =>
    start({
      name: 'Preview as, failed',
      note: 'That did not work. Try again in a moment. Try again loads it; so does choosing someone.',
      side: { kind: 'preview', id: 'amina' },
      previewAt: 'failed',
    }),
  copyList: () =>
    start({
      name: 'Copy a person’s link',
      note: 'Everyone with a shift, in roster order, with their mark; Copy link on each row with a mobile number (sc-3912 issues no link without one).',
      side: { kind: 'copy' },
    }),
  copyBusy: () =>
    start({
      name: 'Copy link busy while the link is issued',
      note: 'Amina’s Copy link turns while the server issues her link.',
      side: { kind: 'copy' },
      copy: 'slow',
      busy: 'amina',
    }),
  copyCopied: () =>
    start({
      name: 'Copied: not marked as sent, with Mark as sent',
      note: 'Link copied. Amina stays Not sent and still counts in Send the briefing to 3.',
      side: { kind: 'copy' },
      people: copied('amina'),
      said: BW.copied,
    }),
  copyMarked: () =>
    start({
      name: 'Marked as sent: Sent, not read',
      note: 'Out of Send the briefing to {n}; the tally recounts, and the Link column reads Link sent.',
      side: { kind: 'copy' },
      people: marked('amina'),
      said: BW.marked('Amina Yusuf'),
    }),
  copyOpened: () =>
    start({
      name: 'Opened after a copy: Read',
      note: 'copy_marked_sent: Amina opens the link after it was marked as sent.',
      side: { kind: 'copy' },
      people: marked('amina').map((one) => (one.id === 'amina' ? afterOpen(one) : one)),
    }),
  copyNotIssued: () =>
    start({
      name: 'No link could be issued',
      note: 'Nothing copied or recorded; the row stays as it was. Press Copy link on any row.',
      side: { kind: 'copy' },
      copy: 'notIssued',
      missed: 'tolu',
      said: BW.notCopied,
    }),
  copyRefused: () =>
    start({
      name: 'The browser refused the clipboard',
      note: 'The read-only Link for Tolu Bello field, selected; it counts as a copy.',
      side: { kind: 'copy' },
      people: copied('tolu'),
      handHeld: { id: 'tolu', url: SAMPLE_URL },
      said: BW.refused,
    }),
  copyNobody: () =>
    start({
      name: 'Nobody on a shift',
      note: '[Nobody has a shift yet.] with [Give someone a shift], to the Jobs and shifts tab.',
      side: { kind: 'copy' },
      people: people().map((one) => ({ ...one, shift: null, more: [] })),
    }),
  checkLoading: () =>
    start({
      name: 'The check, working out the cost',
      note: 'sc-3929’s reservation preview loading.',
      check: 'all',
      checkAt: 'loading',
    }),
  checkEnough: () =>
    start({
      name: 'The check, with enough credits',
      note: 'People, messages and credits per channel and in total, Credits after sending. Press Send the briefing to 3.',
      check: 'all',
    }),
  checkSmsShort: () =>
    start({
      name: 'The check, SMS short, with Add credits',
      note: 'billing.manage on the web. 70 credits, everyone by SMS: one goes, 2 SMS messages will wait.',
      check: 'all',
      balance: 70,
      people: people().map((one) => (one.id === 'emeka' ? { ...one, channel: 'sms' } : one)),
    }),
  checkWhatsAppShort: () =>
    start({
      name: 'The check, SMS and WhatsApp short, with Add credits',
      note: '70 credits: one SMS goes; 1 SMS message and 1 WhatsApp message will wait.',
      check: 'all',
      balance: 70,
    }),
  checkShortAsk: () =>
    start({
      name: 'The check, short, with Ask an owner',
      note: 'Without billing.manage.',
      check: 'all',
      balance: 70,
      billing: false,
    }),
  checkFailed: () =>
    start({
      name: 'The cost did not load',
      note: 'Nothing was sent, with Try again.',
      check: 'all',
      checkAt: 'failed',
    }),
  checkChanged: () =>
    start({
      name: 'The check for Send to 2 changed',
      note: 'Sade by SMS and Kunle by WhatsApp.',
      check: 'changed',
    }),
  resultSent: () =>
    start({
      name: 'Sent, with the no-number count',
      note: 'Sent to 3. 1 has no mobile number. The three read Sent, not read, and Link sent.',
      people: sendTo(
        people(),
        dueAll(people()),
        checkOf(dueAll(people()), noMobileFor(people(), 'all'), BALANCE),
      ).people,
      result: { lines: resultLines(3, 1, 0), held: [] },
    }),
  resultHeld: () =>
    start({
      name: 'Some held: no credits',
      note: 'Sent to 1. 1 has no mobile number. 2 held: no credits. Each held person with Copy link, then Mark as sent.',
      people: afterShortSend(),
      result: { lines: resultLines(1, 1, 2), held: HELD },
    }),
  resultHeldRefused: () =>
    start({
      name: 'The held result, clipboard refused',
      note: 'Amina’s link in the read-only field; Mark as sent withdraws her held text.',
      people: heldOn(HELD)(afterShortSend()).map((one) =>
        one.id === 'amina' ? afterBriefCopy(one) : one,
      ),
      result: { lines: resultLines(1, 1, 2), held: HELD },
      handHeld: { id: 'amina', url: SAMPLE_URL },
      said: BW.refused,
    }),
  stoppedRow: () =>
    start({
      name: 'Rows whose number stopped texts',
      note: 'Tolu Bello and Sade Lawal replied STOP: Stopped texts under Not sent and Changed since sent. Sade keeps Copy link and loses Send again. Send the briefing to 2, Send to 1 changed.',
      people: stoppedOn(STOPPED)(people()),
    }),
  waitingRow: () =>
    start({
      name: 'A row whose text waits until 09:00',
      note: 'Amina Yusuf’s text waits for 09:00, her time: Not sent with Text waits until 09:00, their time under it. Out of Send the briefing to 2. Copy it from Copy link, then Mark as sent, and the waiting text is withdrawn.',
      people: people().map((one) => (one.id === 'amina' ? { ...one, waitText: true } : one)),
    }),
  checkQuiet: () =>
    start({
      name: 'The check at 22:40 the night before',
      note: 'Every shift starts after 09:00 and the event is not Happening now, so sc-3946’s wait line shows: Texts to 3 people wait until 09:00, their time. Press Send the briefing to 3.',
      check: 'all',
      quiet: true,
    }),
  resultStopped: () =>
    start({
      name: 'Sent, with the stopped count',
      note: 'Sent to 2. 1 has no mobile number. 1 has stopped texts. Tolu Bello is not texted, and keeps Not sent with Stopped texts.',
      people: afterSendAt(stoppedOn(['tolu'])(people()), false),
      result: { lines: resultLines(2, 1, 0, 1, 0), held: [] },
    }),
  resultWaiting: () =>
    start({
      name: 'Sent at 22:40: the waiting count',
      note: '1 has no mobile number. 1 has stopped texts. 2 wait until 09:00, their time. Sent to is left out at 0; Amina and Emeka read Text waits until 09:00, their time.',
      people: afterSendAt(stoppedOn(['tolu'])(people()), true),
      quiet: true,
      result: { lines: resultLines(0, 1, 0, 1, 2), held: [] },
    }),
  sendFailed: () =>
    start({
      name: 'The send failed outright',
      note: 'Press Send the briefing to 3 in the check: nothing goes, and no credits are used.',
      check: 'all',
      sendFails: true,
    }),
  noticesList: () =>
    noticed({
      name: 'The reminder card, and the lines under Briefing',
      note: 'Next on Friday, Oct 16, to 5 people, the credits line, who is left out. Grace waits, Kelechi is held for quiet hours, Tope was told by push, Yusuf was not delivered, Amina can’t be reached. Turn the switch off and on.',
    }),
  noticesSeveralShifts: () =>
    noticed({
      name: 'Several shifts, waiting',
      note: 'Assign, Unassign and Edit times on Jobs and shifts: Grace has one of two shifts retimed, Tope a shift added, and Yusuf’s last is taken off. Each reads Goes at with its short line; a shift’s start carries its weekday, its end only when on another day. Grace’s and Tope’s Shift reads their earliest with +1 more, as sc-3908’s roster does.',
      people: severalShifts(),
    }),
  noticesEve: () =>
    noticed(
      {
        name: 'The reminder has gone (the eve)',
        note: 'Sent on Friday, Oct 16, to 5 people, and nothing else: no cost line and no left-out lines. The roster still names who was not sent. Kelechi was told by WhatsApp.',
        people: eve(),
      },
      { sent: SENT_FRIDAY },
    ),
  noticesReminderOff: () =>
    noticed(
      {
        name: 'The reminder switched off',
        note: 'Nothing under what it does while it is off. Turn it on.',
      },
      { on: false },
    ),
  noticesSwitchFailed: () =>
    noticed(
      {
        name: 'The switch could not save',
        note: 'Couldn’t save. The reminder is still on. Every press is refused here.',
        said: NW.notSaved(true),
      },
      { saves: false, notSaved: true },
    ),
  noticesRemoved: () =>
    noticed(
      {
        name: 'Removing someone briefed: the question',
        note: 'Tope Balogun’s details, Remove from the event: one line more, as Tope gets one last message. Remove from the event, or Keep them.',
      },
      { removing: 'tope' },
    ),
  noticesNoneBriefed: () =>
    noticed({
      name: 'Nobody briefed yet',
      note: 'Nobody to remind yet, with 6 not briefed and 1 who can’t be reached.',
      people: noticePeople().map((one) => ({ ...one, brief: 'none', link: 'none', notice: null })),
    }),
  noticesReadOnly: () =>
    noticed({
      name: 'staff.read: On as a word',
      note: 'No switch, and the Next, cost and left-out lines as for staff.manage.',
      access: 'read',
    }),
  noticesEmpty: () =>
    noticed({
      name: 'Nobody on the staff',
      note: 'Nobody to remind yet.',
      people: [],
    }),
  noticesCostCredits: () =>
    noticed({
      name: 'Cost: using credits',
      note: 'Kelechi’s WhatsApp (31 credits) and Yusuf’s text (62). Credits only: texts have nothing included.',
    }),
  noticesNoCredits: () =>
    noticed({
      name: 'Not delivered: no credits left',
      note: 'Yusuf’s row, with Copy link, and Send again as on any changed row.',
      people: reshaped({ yusuf: { notice: { kind: 'failed', reason: NO_CREDITS } } })(),
    }),
  noticesCostShort: () =>
    noticed({
      name: 'Credits short, with Add credits',
      note: 'billing.manage. 40 credits cover Kelechi’s WhatsApp, not Yusuf’s text. Add credits opens Plan and billing.',
      balance: 40,
    }),
  noticesCostShortReadOnly: () =>
    noticed({
      name: 'Credits short, with Ask an owner',
      note: 'staff.read, 20 credits: neither is covered. Press Ask an owner.',
      access: 'read',
      balance: 20,
      billing: false,
    }),
  noticesCostShortAsked: () =>
    noticed(
      {
        name: 'Ask an owner: sent to the owners',
        note: 'The owners have been sent the link to Plan and billing.',
        access: 'read',
        balance: 20,
        billing: false,
      },
      { ask: 'sent' },
    ),
  noticesCostShortAskedOne: () =>
    noticed(
      {
        name: 'Ask an owner: sent to the one owner',
        note: 'The owner has been sent the link to Plan and billing.',
        access: 'read',
        balance: 20,
        billing: false,
      },
      { ask: 'sent', owners: 1 },
    ),
  noticesCostShortAskFailed: () =>
    noticed(
      {
        name: 'Ask an owner: not sent',
        note: 'Not sent. Try again in a moment. Press Ask an owner again.',
        access: 'read',
        balance: 20,
        billing: false,
      },
      { ask: 'failed' },
    ),
  noticesCalledOff: () =>
    noticed(
      {
        name: 'Called off',
        note: 'Called off on Thursday, Oct 15 at 19:40, and told at once. No Send again or Send to {n} changed; Copy link stays.',
        people: calledOff(),
      },
      { concluded: 'calledOff' },
    ),
  noticesEventEnded: () =>
    noticed(
      {
        name: 'Ended with End now',
        note: 'End now on Saturday, Oct 17 at 16:30: Tope and Yusuf had not started. Friday’s reminder had gone.',
        people: endedPeople(),
      },
      { concluded: 'ended', sent: SENT_FRIDAY },
    ),
  noticesFinishedSent: () =>
    noticed(
      {
        name: 'Past its end, the reminder sent',
        note: 'Sunday, with no End now. The rows as on the eve.',
        people: eve(),
      },
      { concluded: 'ended', sent: SENT_FRIDAY },
    ),
  noticesFinishedSwitchOff: () =>
    noticed(
      {
        name: 'Ended, with the switch off beforehand',
        note: 'No reminder ever went.',
        people: endedPeople(),
      },
      { concluded: 'ended', on: false },
    ),
  noticesFinishedRefused: () =>
    noticed(
      {
        name: 'A send refused: the event is already over',
        note: 'The page was opened before End now; it reloaded Finished beneath the notice.',
        people: endedPeople(),
        said: NW.alreadyOver,
      },
      { concluded: 'ended', sent: SENT_FRIDAY, alreadyOver: true },
    ),
  noticesFinishedRefusedBefore: () =>
    noticed(
      {
        name: 'A page opened before End now',
        note: 'End now was pressed elsewhere at 16:30. Press any send: it is refused, and the page reloads Finished.',
        people: eve(),
      },
      { sent: SENT_FRIDAY, stale: true },
    ),
} satisfies Record<string, () => BriefingStart>;

export type BriefingStateName = keyof typeof STATES;

export const BRIEFING_STATES = Object.keys(STATES) as BriefingStateName[];

export function briefingStart(raw: string | null): BriefingStart {
  const name = raw != null && Object.hasOwn(STATES, raw) ? (raw as BriefingStateName) : 'populated';

  return STATES[name]();
}

export function rosterStateOf(state: BriefingStateName): string {
  return state === 'populated' ? 'briefing' : `briefing${state[0]?.toUpperCase()}${state.slice(1)}`;
}

export function briefingRosterStart(raw: string | null): RosterStart | null {
  const name = BRIEFING_STATES.find((one) => rosterStateOf(one) === raw);
  if (name == null) return null;
  const b = STATES[name]();

  return rosterWith({
    name: b.name,
    note: b.note,
    entries: b.people,
    panel: b.notices?.removing == null ? null : { kind: 'remove', id: b.notices.removing },
    manage: b.access === 'manage',
    finished: b.finished,
    copy: b.copy === 'slow' ? 'works' : b.copy,
    sms: b.live
      ? texting({
          credits: b.balance,
          billing: b.billing,
          ...(b.quiet ? { quiet: true, clock: '22:40' } : {}),
        })
      : null,
    briefing: b,
  });
}

export function briefingAt(state: BriefingStateName = 'populated'): string {
  return `/demo/events/${STATIONS_EVENT}/staff/roster?state=${rosterStateOf(state)}`;
}

const link = (state: BriefingStateName): DemoLink => ({
  to: briefingAt(state),
  name: STATES[state]().name,
});

export const BRIEFING_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The Briefing card and column',
    states: (
      [
        'populated',
        'changedRow',
        'changedRefused',
        'stoppedRow',
        'waitingRow',
        'notLive',
        'finished',
        'readOnly',
        'refused',
      ] as const
    ).map(link),
  },
  {
    name: 'House rules',
    states: (
      [
        'rulesEmpty',
        'rulesView',
        'rulesViewReadOnly',
        'rulesEdit',
        'rulesCount',
        'rulesLimit',
        'rulesPasted',
        'rulesSaved',
        'rulesNotSaved',
      ] as const
    ).map(link),
  },
  {
    name: 'Preview as',
    states: (['previewAs', 'previewNoShift', 'previewLoading', 'previewFailed'] as const).map(link),
  },
  {
    name: 'Copy a person’s link',
    states: (
      [
        'copyList',
        'copyBusy',
        'copyCopied',
        'copyMarked',
        'copyOpened',
        'copyNotIssued',
        'copyRefused',
        'copyNobody',
      ] as const
    ).map(link),
  },
  {
    name: 'The check before sending (sc-3931)',
    states: (
      [
        'checkLoading',
        'checkEnough',
        'checkSmsShort',
        'checkWhatsAppShort',
        'checkShortAsk',
        'checkFailed',
        'checkChanged',
        'checkQuiet',
      ] as const
    ).map(link),
  },
  {
    name: 'The result',
    states: (
      [
        'resultSent',
        'resultStopped',
        'resultWaiting',
        'resultHeld',
        'resultHeldRefused',
        'sendFailed',
      ] as const
    ).map(link),
  },
];

export const NOTICE_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The reminder card',
    states: (
      [
        'noticesList',
        'noticesEve',
        'noticesReminderOff',
        'noticesSwitchFailed',
        'noticesNoneBriefed',
        'noticesReadOnly',
        'noticesEmpty',
      ] as const
    ).map(link),
  },
  {
    name: 'What the next reminder costs (sc-3931)',
    states: (
      [
        'noticesCostCredits',
        'noticesCostShort',
        'noticesCostShortReadOnly',
        'noticesCostShortAsked',
        'noticesCostShortAskedOne',
        'noticesCostShortAskFailed',
      ] as const
    ).map(link),
  },
  {
    name: 'The lines under Briefing, and removing someone',
    states: (
      ['noticesList', 'noticesSeveralShifts', 'noticesNoCredits', 'noticesRemoved'] as const
    ).map(link),
  },
  {
    name: 'Once the event is Finished',
    states: (
      [
        'noticesCalledOff',
        'noticesEventEnded',
        'noticesFinishedSent',
        'noticesFinishedSwitchOff',
        'noticesFinishedRefused',
        'noticesFinishedRefusedBefore',
      ] as const
    ).map(link),
  },
];
