import { type Entry, type RosterStart, rosterWith, sample } from './roster.ts';
import type { DemoLink } from './settings.ts';
import { type Delivered, type Trail, NOW_AT, YOU, afterCopy } from './staffLink.ts';
import { texting } from './staffText.ts';
import { STATIONS_EVENT } from './stations.ts';

/** The briefing on the event's Staff page (sc-3917, Staffing.dc.html › Tweaks › Briefing on page e34): house rules and everyone's shift, sent with one tap. */
export type Brief = 'read' | 'sent' | 'none' | 'changed';

export interface Person extends Entry {
  brief: Brief;
  /** A briefing text waiting for credits (sc-3932): it goes by itself once there are credits. */
  heldText: boolean;
  /** How the briefing reaches them when it goes; push is free and is never counted. */
  channel: 'sms' | 'whatsApp';
  /** A copy from the briefing (the copy list, a changed row or the held result), and whether it was then marked as sent. */
  briefCopy: { trail: Trail; marked: boolean } | null;
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
  loading: '[Loading the staff…]',
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
  if (one.heldText) return BW.held;

  return null;
}

export function dueAll(people: readonly Person[]): Person[] {
  return people.filter(
    (one) => one.mobile != null && one.shift != null && one.brief === 'none' && !one.heldText,
  );
}

/** Send to {n} changed: held people are left out, since their text goes by itself once there are credits. */
export function dueChanged(people: readonly Person[]): Person[] {
  return people.filter((one) => one.brief === 'changed' && one.mobile != null && !one.heldText);
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
  paid: readonly string[];
}

const cost = (one: Person) => (one.channel === 'whatsApp' ? WHATSAPP_CREDITS : SMS_CREDITS);

export type Target = 'all' | 'changed' | string;

export function noMobileFor(people: readonly Person[], target: Target): number {
  if (target === 'all')
    return people.filter((one) => one.shift != null && one.mobile == null && one.brief === 'none')
      .length;
  if (target === 'changed')
    return people.filter((one) => one.brief === 'changed' && one.mobile == null).length;

  return 0;
}

/** sc-3931 on sc-3929's reservation preview: a text is paid only when the balance covers its whole cost; the lines count what is paid, and the rest wait. */
export function checkOf(due: readonly Person[], noMobile: number, balance: number): Check {
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
    paid: paid.map((one) => one.id),
  };
}

export function sendTo(
  people: readonly Person[],
  due: readonly Person[],
  check: Check,
): { people: Person[]; sent: number; held: string[] } {
  const ids = new Set(due.map((one) => one.id));
  const paid = new Set(check.paid);
  const held: string[] = [];
  const next = people.map((one): Person => {
    if (!ids.has(one.id)) return one;
    if (!paid.has(one.id)) {
      held.push(one.id);
      return { ...one, heldText: true };
    }
    const opened = one.link === 'opened';

    return {
      ...one,
      brief: 'sent',
      link: opened ? 'opened' : 'sent',
      trail: opened ? (one.trail ?? null) : { by: YOU, at: NOW_AT, via: 'text' },
    };
  });

  return { people: next, sent: paid.size, held };
}

export function resultLines(sent: number, noMobile: number, held: number): string[] {
  return [
    BW.sentTo(sent),
    ...(noMobile > 0 ? [BW.noMobileCount(noMobile)] : []),
    ...(held > 0 ? [BW.heldCount(held)] : []),
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
  loading: boolean;
  check: Target | null;
  checkAt: 'loading' | 'shown' | 'failed';
  balance: number;
  billing: boolean;
  sendFails: boolean;
  result: { lines: string[]; held: string[] } | null;
  said: string | null;
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
    loading: false,
    check: null,
    checkAt: 'shown',
    balance: BALANCE,
    billing: true,
    sendFails: false,
    result: null,
    said: null,
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
const SAMPLE_URL = 'https://soirely.com/s/7Gk2pQ9xVb4mT1sR8nLw3c';

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
  copyLoading: () =>
    start({
      name: 'Copy a person’s link, loading',
      note: 'Bones while the list loads; still with Reduce motion.',
      side: { kind: 'copy' },
      loading: true,
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
  sendFailed: () =>
    start({
      name: 'The send failed outright',
      note: 'Press Send the briefing to 3 in the check: nothing goes, and no credits are used.',
      check: 'all',
      sendFails: true,
    }),
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
    manage: b.access === 'manage',
    finished: b.finished,
    copy: b.copy === 'slow' ? 'works' : b.copy,
    sms: b.live ? texting({ credits: b.balance, billing: b.billing }) : null,
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
        'copyLoading',
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
      ] as const
    ).map(link),
  },
  {
    name: 'The result',
    states: (['resultSent', 'resultHeld', 'resultHeldRefused', 'sendFailed'] as const).map(link),
  },
];
