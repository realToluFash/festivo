import type { Finished, Reach, ShiftNotice } from '../shiftNotices/shiftNoticesModel.ts';
import type { LinkStatus, Trail } from '../staffLink/StaffLinkModel.ts';
import { type OnRoster, rosterOrder, sampleRoster } from '../staffLink/StaffRosterModel.ts';
import { TW } from '../staffLink/StaffTextModel.ts';

/** The briefing on the event's Staff page on a tablet (sc-3917, Staffing.dc.html › Tweaks › Briefing, rows two and four), the web's demo rules on the app's roster sample. */
export type Brief = 'read' | 'sent' | 'none' | 'changed';

export interface Person extends OnRoster {
  brief: Brief;
  heldText: boolean;
  /** A briefing text waiting for 09:00 in their time (sc-3946's quiet hours): it goes by itself then. */
  waitText: boolean;
  channel: 'sms' | 'whatsApp';
  briefCopy: { trail: Trail; marked: boolean } | null;
  /** sc-4333: how S2 and S3 reach them, the line under their Briefing word, and Called off or Event ended. */
  reach?: Reach;
  notice?: ShiftNotice | null;
  ended?: Finished | null;
}

export const RULES_MAX = 2000;
export const RULES_COUNT_FROM = 1800;
export const SMS_CREDITS = 62;
export const WHATSAPP_CREDITS = 31;
export const BALANCE = 1500;
export const ISSUE_MS = 600;
export const SAMPLE_LINK = 'https://soirely.com/s/7Gk2pQ9xVb4mT1sR8nLw3c';
const YOU = 'Amara Nwosu';
const NOW_AT = '19:12';
export const QUIET_ENDS = '09:00';

const number = new Intl.NumberFormat('en-GB');
const n0 = (n: number) => number.format(n);
const plural = (n: number, one: string, other: string) =>
  (n === 1 ? one : other).replace('{n}', n0(n));

export const BW = {
  card: 'Briefing',
  cardLine: 'House rules and everyone’s shift, on their own page.',
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
  noMobile: 'No mobile number',
  noShift: 'No shift, so nothing to send',
  held: 'Held: no credits',
  stopped: TW.stopped,
  waits: TW.waits,
  copyTitle: 'Copy a person’s link',
  copyLine: 'Everyone with a shift. Copy a link to send it yourself, by any app.',
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
  loading: '[Loading the staff]',
  close: 'Close',
  cancel: 'Cancel',
  notBuilt: 'AC, not yet built',
  rulesNone: '[No house rules yet.]',
  rulesWhere: '[They show as Before you start on everyone’s shift page.]',
  save: 'Save changes',
  count: (n: number) => `[${n0(n)} of ${n0(RULES_MAX)} characters]`,
  atLimit: `[${n0(RULES_MAX)} of ${n0(RULES_MAX)} characters. That is the limit.]`,
  cut: `That was longer than ${n0(RULES_MAX)} characters, so the end was left out.`,
  saved: '[Saved. The rules are on everyone’s shift page now.]',
  previewWho: 'Whose page',
  previewSearch: '[Search the staff]',
  previewBanner: '[Preview only. Nothing is recorded: no read and no link open.]',
  previewNoShift: (day: string) => `[You are on the staff for ${day}, with no shift yet.]`,
  onTonight: 'Tonight you’re on',
  yourShift: 'Your shift',
  yourLead: 'Your lead',
  noLead: 'No lead named yet',
  floorLead: 'Floor lead',
  beforeYouStart: 'Before you start',
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
  notInApp: 'Credits cannot be added in the app.',
  askOwner: 'Ask an owner',
  working: '[Working out the cost…]',
  costFailed: '[The cost did not load, so nothing was sent.]',
  tryAgain: 'Try again',
  sentTo: (n: number) => `Sent to ${n0(n)}.`,
  heldCount: (h: number) => `${n0(h)} held: no credits.`,
  stoppedCount: TW.stoppedCount,
  waitCount: TW.waitCount,
  quiet: TW.quiet,
  sendFailed: '[Not sent. Nothing went, and no credits were used. Try again in a moment.]',
  refusedPage: '[You cannot see this event’s staff.]',
  lock: '[You can see the briefing. Sending it needs permission to manage staff.]',
  dismiss: 'Dismiss',
};

/** Code points, as the server's Length with mb_strlen counts them: "Ọ̀" is two. */
export function codePoints(text: string): number {
  return Array.from(text).length;
}

/** A key typed at the limit, anywhere in the text, is not taken; a paste that would go over keeps its first part and says so. */
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

/** A text is owed nobody whose number stopped texts (sc-3946), and nobody with a text already held (sc-3932) or waiting: that one goes by itself. */
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

/** A copy never moves Link sent or Link opened back; the briefing state stays as it was. */
export function afterBriefCopy(one: Person): Person {
  const trail = { by: YOU, at: NOW_AT };
  const kept = one.status === 'sent' || one.status === 'opened';

  return {
    ...one,
    status: kept ? one.status : 'copied',
    trail: kept ? one.trail : trail,
    briefCopy: { trail, marked: false },
  };
}

export function afterBriefMark(one: Person): Person {
  const trail = { by: YOU, at: NOW_AT };
  const status: LinkStatus = one.status === 'opened' ? 'opened' : 'sent';

  return {
    ...one,
    brief: one.brief === 'read' ? 'read' : 'sent',
    heldText: false,
    waitText: false,
    status,
    trail: status === 'opened' ? one.trail : trail,
    briefCopy: { trail, marked: true },
  };
}

export function afterOpen(one: Person): Person {
  return { ...one, brief: 'read', status: 'opened', trail: { by: '', at: NOW_AT } };
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

const cost = (one: Person) => (one.channel === 'whatsApp' ? WHATSAPP_CREDITS : SMS_CREDITS);

export type Target = 'all' | 'changed' | string;

/** Who the send is for and has no number: Not sent people with a shift for Send the briefing to {n}, changed people for Send to {n} changed, and nobody for one row's Send again. */
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

/** A text is paid only when the balance covers its whole cost; the lines count what is paid, and the rest wait. */
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
  const credits = paid.reduce((sum, one) => sum + cost(one), 0);

  return {
    people: due.length,
    noMobile,
    sms: { n: by('sms', paid).length, credits: by('sms', paid).length * SMS_CREDITS },
    whatsApp:
      by('whatsApp', due).length === 0
        ? null
        : {
            n: by('whatsApp', paid).length,
            credits: by('whatsApp', paid).length * WHATSAPP_CREDITS,
          },
    credits,
    after: balance - credits,
    smsWaits: by('sms', due).length - by('sms', paid).length,
    whatsAppWaits: by('whatsApp', due).length - by('whatsApp', paid).length,
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
    const opened = one.status === 'opened';

    return {
      ...one,
      brief: 'sent',
      status: opened ? 'opened' : 'sent',
      trail: opened ? one.trail : { by: YOU, at: NOW_AT, via: 'text' },
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
  return rosterOrder(sampleRoster()).map((one) => ({
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
  | { kind: 'copy' }
  | { kind: 'rules'; editing: boolean }
  | { kind: 'preview'; id: string }
  | { kind: 'check'; target: Target }
  | null;

export interface BriefingStart {
  title: string;
  what: string;
  people: Person[];
  side: Side;
  access: 'manage' | 'read';
  live: boolean;
  finished: boolean;
  rules: string;
  draft: string | null;
  cut: boolean;
  saved: boolean;
  copy: 'works' | 'notIssued' | 'refused' | 'slow';
  busy: string | null;
  missed: string | null;
  handHeld: { id: string; url: string } | null;
  loading: boolean;
  checkAt: 'loading' | 'shown' | 'failed';
  balance: number;
  billing: boolean;
  sendFails: boolean;
  /** 22:40 the night before (sc-3946): every shift starts after 09:00 and the event is not Happening now, so texts wait. */
  quiet: boolean;
  result: { lines: string[]; held: string[] } | null;
  /** sc-4333: the event is Finished, so no send is offered while Copy link stays; the phone shows it too. */
  concluded?: boolean;
  anyLayout?: boolean;
}

function start(o: Partial<BriefingStart> & Pick<BriefingStart, 'title' | 'what'>): BriefingStart {
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
    copy: 'works',
    busy: null,
    missed: null,
    handHeld: null,
    loading: false,
    checkAt: 'shown',
    balance: BALANCE,
    billing: true,
    sendFails: false,
    quiet: false,
    result: null,
    ...o,
  };
}

const copied = (id: string) => people().map((one) => (one.id === id ? afterBriefCopy(one) : one));
const marked = (id: string) =>
  people().map((one) => (one.id === id ? afterBriefMark(afterBriefCopy(one)) : one));
const HELD = ['amina', 'emeka'];
function afterShortSend(): Person[] {
  const list = people();
  const due = dueAll(list);

  return sendTo(list, due, checkOf(due, noMobileFor(list, 'all'), 70)).people;
}
const stoppedOn = (ids: readonly string[]) => (list: Person[]) =>
  list.map((one): Person => (ids.includes(one.id) ? { ...one, stopped: true } : one));
function afterSendAt(list: Person[], quiet: boolean): Person[] {
  const due = dueAll(list);
  const check = checkOf(due, noMobileFor(list, 'all'), BALANCE, {
    stopped: stoppedFor(list, 'all'),
    quiet,
  });

  return sendTo(list, due, check).people;
}
const allSms = () => people().map((one): Person => ({ ...one, channel: 'sms' }));

const STATES = {
  populated: () =>
    start({
      title: 'The Briefing card and its four marks',
      what: 'Read 3 · Sent, not read 2 · Changed since sent 2 · Not sent 5; Send the briefing to 3, Send to 2 changed, Copy link',
    }),
  notLive: () =>
    start({
      title: 'Before epic 36 ships',
      what: 'The send buttons hidden; Copy link alone',
      live: false,
    }),
  finished: () =>
    start({
      title: 'A finished event',
      what: 'No send and no link buttons; House rules and Preview as stay',
      finished: true,
    }),
  readOnly: () =>
    start({
      title: 'staff.read only',
      what: 'The states, House rules and Preview as; nothing to send, copy or edit',
      access: 'read',
    }),
  changedRefused: () =>
    start({
      title: 'A changed row, clipboard refused',
      what: 'Sade’s link in the read-only field; Copied by you, with Mark as sent',
      people: copied('sade'),
      handHeld: { id: 'sade', url: SAMPLE_LINK },
    }),
  rulesEmpty: () =>
    start({
      title: 'House rules, none yet',
      what: '[No house rules yet.] with Edit the rules',
      rules: '',
      side: { kind: 'rules', editing: false },
    }),
  rulesView: () =>
    start({
      title: 'House rules, read',
      what: 'Plain text with its line breaks kept',
      side: { kind: 'rules', editing: false },
    }),
  rulesEdit: () =>
    start({
      title: 'Edit the rules',
      what: 'A labelled box with Save changes and Cancel',
      side: { kind: 'rules', editing: true },
      draft: RULES,
    }),
  rulesCount: () =>
    start({
      title: 'The count from 1,800',
      what: '[1,918 of 2,000 characters]',
      side: { kind: 'rules', editing: true },
      draft: LONG_RULES,
    }),
  rulesLimit: () =>
    start({
      title: 'At the limit',
      what: 'The box takes no more; the count turns amber with a triangle',
      side: { kind: 'rules', editing: true },
      draft: FULL_RULES,
    }),
  rulesPasted: () =>
    start({
      title: 'A paste over 2,000',
      what: 'The first 2,000 kept, and said aloud',
      side: { kind: 'rules', editing: true },
      draft: FULL_RULES,
      cut: true,
    }),
  rulesSaved: () =>
    start({
      title: 'The rules saved',
      what: 'Sends nothing and sets no Changed since sent',
      side: { kind: 'rules', editing: false },
      saved: true,
    }),
  previewAs: () =>
    start({
      title: 'Preview as',
      what: 'sc-3915’s page at phone width under the banner; no Clock in, no Call',
      side: { kind: 'preview', id: 'amina' },
    }),
  previewNoShift: () =>
    start({
      title: 'Preview as, no shift',
      what: 'Chinedu Eze, on the staff with no shift yet',
      side: { kind: 'preview', id: 'chinedu' },
    }),
  copyList: () =>
    start({
      title: 'Copy a person’s link',
      what: 'Everyone with a shift, with their mark and a Copy link each',
      side: { kind: 'copy' },
    }),
  copyBusy: () =>
    start({
      title: 'Copy link, busy',
      what: 'While the server issues Amina’s link',
      side: { kind: 'copy' },
      copy: 'slow',
      busy: 'amina',
    }),
  copyCopied: () =>
    start({
      title: 'Copied, not marked as sent',
      what: 'Link copied.; Amina stays Not sent, with Mark as sent',
      side: { kind: 'copy' },
      people: copied('amina'),
    }),
  copyMarked: () =>
    start({
      title: 'Marked as sent',
      what: 'Sent, not read; out of Send the briefing to {n}; Link sent',
      side: { kind: 'copy' },
      people: marked('amina'),
    }),
  copyNotIssued: () =>
    start({
      title: 'No link could be issued',
      what: 'Nothing copied or recorded; the row as it was',
      side: { kind: 'copy' },
      copy: 'notIssued',
      missed: 'tolu',
    }),
  copyRefused: () =>
    start({
      title: 'The clipboard refused',
      what: 'The read-only Link field; it counts as a copy',
      side: { kind: 'copy' },
      people: copied('tolu'),
      handHeld: { id: 'tolu', url: SAMPLE_LINK },
    }),
  copyNobody: () =>
    start({
      title: 'Nobody on a shift',
      what: '[Nobody has a shift yet.] with [Give someone a shift]',
      side: { kind: 'copy' },
      people: people().map((one) => ({ ...one, shift: null })),
    }),
  copyLoading: () =>
    start({
      title: 'Copy a person’s link, loading',
      what: 'Bones while the list loads',
      side: { kind: 'copy' },
      loading: true,
    }),
  checkLoading: () =>
    start({
      title: 'The check, working out the cost',
      what: '[Working out the cost…]',
      side: { kind: 'check', target: 'all' },
      checkAt: 'loading',
    }),
  checkEnough: () =>
    start({
      title: 'The check, enough credits',
      what: 'Messages and credits per channel and in total; Credits after sending: 1,345.',
      side: { kind: 'check', target: 'all' },
    }),
  checkSmsShort: () =>
    start({
      title: 'The check, SMS short',
      what: '2 SMS messages will wait for credits. Credits cannot be added in the app.',
      side: { kind: 'check', target: 'all' },
      balance: 70,
      people: allSms(),
    }),
  checkWhatsAppShort: () =>
    start({
      title: 'The check, SMS and WhatsApp short',
      what: '1 WhatsApp message and 1 SMS message will wait. Credits cannot be added in the app.',
      side: { kind: 'check', target: 'all' },
      balance: 70,
    }),
  checkShortAsk: () =>
    start({
      title: 'The check, short, Ask an owner',
      what: 'Without billing.manage',
      side: { kind: 'check', target: 'all' },
      balance: 70,
      billing: false,
    }),
  checkFailed: () =>
    start({
      title: 'The cost did not load',
      what: 'Nothing was sent, with Try again',
      side: { kind: 'check', target: 'all' },
      checkAt: 'failed',
    }),
  resultSent: () =>
    start({
      title: 'Sent',
      what: 'Sent to 3. 1 has no mobile number.',
      people: sendTo(
        people(),
        dueAll(people()),
        checkOf(dueAll(people()), noMobileFor(people(), 'all'), BALANCE),
      ).people,
      result: { lines: resultLines(3, 1, 0), held: [] },
    }),
  resultHeld: () =>
    start({
      title: 'Some held: no credits',
      what: '2 held, each with Copy link, then Mark as sent',
      people: afterShortSend(),
      result: { lines: resultLines(1, 1, 2), held: HELD },
    }),
  stoppedRow: () =>
    start({
      title: 'Stopped texts',
      what: 'Tolu and Sade replied STOP: Stopped texts under their state; Sade keeps Copy link, not Send again. Send the briefing to 2',
      people: stoppedOn(['tolu', 'sade'])(people()),
    }),
  waitingRow: () =>
    start({
      title: 'A text waits until 09:00',
      what: 'Amina reads Not sent · Text waits until 09:00, their time; out of Send the briefing to 2',
      people: people().map((one) => (one.id === 'amina' ? { ...one, waitText: true } : one)),
    }),
  checkQuiet: () =>
    start({
      title: 'The check at 22:40',
      what: 'Texts to 3 people wait until 09:00, their time.',
      side: { kind: 'check', target: 'all' },
      quiet: true,
    }),
  resultStopped: () =>
    start({
      title: 'Sent, with stopped texts',
      what: 'Sent to 2. 1 has no mobile number. 1 has stopped texts.',
      people: afterSendAt(stoppedOn(['tolu'])(people()), false),
      result: { lines: resultLines(2, 1, 0, 1, 0), held: [] },
    }),
  resultWaiting: () =>
    start({
      title: 'Sent at 22:40, waiting',
      what: '1 has no mobile number. 1 has stopped texts. 2 wait until 09:00, their time.',
      people: afterSendAt(stoppedOn(['tolu'])(people()), true),
      quiet: true,
      result: { lines: resultLines(0, 1, 0, 1, 2), held: [] },
    }),
  sendFailed: () =>
    start({
      title: 'The send failed',
      what: 'Press Send the briefing to 3: nothing goes, no credits used',
      side: { kind: 'check', target: 'all' },
      sendFails: true,
    }),
} satisfies Record<string, () => BriefingStart>;

export type BriefingState = keyof typeof STATES;

export const BRIEFING_STATES = Object.keys(STATES) as BriefingState[];

export function briefingStateOf(raw: string | null | undefined): BriefingState | null {
  return raw != null && Object.hasOwn(STATES, raw) ? (raw as BriefingState) : null;
}

export function briefingStart(state: BriefingState): BriefingStart {
  return STATES[state]();
}

/** The roster under the briefing: no Text links before epic 36 ships, the roster read-only with staff.read only, and Text links to {n} otherwise. */
export function rosterUnder(state: BriefingState): 'populated' | 'smsReadOnly' | 'smsOn' {
  if (state === 'notLive') return 'populated';

  return state === 'readOnly' ? 'smsReadOnly' : 'smsOn';
}

export const BRIEFING_BOARDS = BRIEFING_STATES.map((state) => ({
  title: `Briefing · ${STATES[state]().title}`,
  what: STATES[state]().what,
  href: `/demo/events/evt-wed-4?area=staff&staff=${rosterUnder(state)}&briefing=${state}`,
}));
