import { EVENT_OF_KEY, sampleEvent } from '../events/EventsSample.ts';
import { LINK_CHARS, asSent, smsParts, textCost } from '../events/MakeLive.ts';
import { ORG, formatCount } from '../messages/MessagesSample.ts';
import { W, WW, say } from '../messages/MessagesWords.ts';
import {
  type LinkState,
  type Texting,
  type Trail,
  NOW,
  W as LW,
  YOU,
  acts,
  seed,
} from './StaffLinkModel.ts';
import { type OnRoster, sampleRoster } from './StaffRosterModel.ts';

const PLURAL = new Intl.PluralRules('en');

/** The count's CLDR plural form in en, one or other. */
function byCount(count: number, one: string, other: string): string {
  return (PLURAL.select(count) === 'one' ? one : other).replaceAll('{count}', formatCount(count));
}

/** sc-77904's words as the AC quotes [en] (#77928, #77937, #77953); [bracketed] ones are the drawing's, for [en]. */
export const TW = {
  text: 'Text the link',
  bulk: (n: number) => byCount(n, 'Text links to {count}', 'Text links to {count}'),
  sending: 'Sending text…',
  held: 'Text held: no credits',
  waits: (time: string) => `Text waits until ${time}, their time`,
  notDelivered: (time: string) => `Text not delivered · ${time}`,
  stopped: 'Stopped texts',
  sendingTo: (name: string) => `Sending the link to ${name}.`,
  checkOne: (name: string) => `[Text the link to ${name}?]`,
  checkMany: (n: number) =>
    byCount(n, '[Text links to {count} person?]', '[Text links to {count} people?]'),
  checkLine: '[Each gets a text with their own link. Links sent before keep working.]',
  thisTextUses: (c: number) =>
    byCount(c, 'This text uses {count} credit.', 'This text uses {count} credits.'),
  textsUse: (c: number) => byCount(c, 'Texts use {count} credit.', 'Texts use {count} credits.'),
  after: (c: number) => `Credits after sending: ${formatCount(c)}.`,
  smsWaits: (w: number) => say.waits('sms', w),
  quiet: (n: number, time: string) => say.quietWait(n, time),
  notInApp: W.creditsNotInApp,
  askOwner: WW.askOwner,
  cancel: W.cancel,
  allSent: '[Everyone with a mobile number has been sent a link.]',
  sendingToCount: (n: number) =>
    byCount(n, 'Sending to {count} person.', 'Sending to {count} people.'),
  noMobile: (m: number) =>
    byCount(m, '{count} has no mobile number.', '{count} have no mobile number.'),
  stoppedCount: (k: number) =>
    byCount(k, '{count} has stopped texts.', '{count} have stopped texts.'),
  heldCount: (h: number) => byCount(h, '{count} held: no credits.', '{count} held: no credits.'),
  waitCount: (w: number, time: string) =>
    byCount(
      w,
      `{count} waits until ${time}, their time.`,
      `{count} wait until ${time}, their time.`,
    ),
};

export interface Result {
  sending: number;
  m: number;
  k: number;
  held: number;
  waits: number;
  time: string;
}

/** Each sentence only above 0, every one with its full stop; a held or waiting person only in their own line. */
export function resultLines(r: Result): string[] {
  return [
    ...(r.sending > 0 ? [TW.sendingToCount(r.sending)] : []),
    ...(r.m > 0 ? [TW.noMobile(r.m)] : []),
    ...(r.k > 0 ? [TW.stoppedCount(r.k)] : []),
    ...(r.held > 0 ? [TW.heldCount(r.held)] : []),
    ...(r.waits > 0 ? [TW.waitCount(r.waits, r.time)] : []),
  ];
}

/** The text in the event's language, the first form that fits one part, as [en] settled them (#77928). */
function staffSmsForms(link: string): string[] {
  const event = sampleEvent(EVENT_OF_KEY.wed)?.name ?? '';

  return [
    `Your staff link for ${event} from ${ORG}: ${link}`,
    `Your staff link from ${ORG}: ${link}`,
    `Your staff link: ${link}`,
  ];
}

/** A first text from the organisation to a number ends on the STOP line, which may take it to two parts. */
export function staffSmsParts(first: boolean): number {
  const forms = staffSmsForms('x'.repeat(LINK_CHARS));
  const fits = forms.find((text) => smsParts(asSent(text, false)) === 1) ?? forms.at(-1) ?? '';

  return smsParts(asSent(fits, first));
}

/** sc-3928's rate for the person's own number, times the parts of their text. */
export function textCostOf(mobile: string | null, trail: Trail | null): number {
  if (mobile == null) throw new Error('No number to text');

  return textCost({ phone: mobile, parts: staffSmsParts(trail?.via !== 'text') });
}

export const BALANCE = 1500;
export const QUIET_ENDS = '09:00';
export const SENT_MS = 2400;

export function texting(over: Partial<Texting> = {}): Texting {
  return {
    credits: BALANCE,
    refused: false,
    undelivered: false,
    quiet: false,
    clock: NOW,
    billing: true,
    stopped: false,
    pending: null,
    notDelivered: null,
    before: null,
    checking: false,
    checkFailed: false,
    ...over,
  };
}

export function offersText(s: LinkState): boolean {
  return (
    s.texting != null &&
    acts(s) &&
    s.view === 'manage' &&
    s.who.mobile != null &&
    !s.texting.stopped &&
    s.texting.pending == null &&
    !s.asking
  );
}

export interface Check {
  n: number;
  m: number;
  k: number;
  uses: number;
  after: number;
  wait: number;
}

/** How many of the texts, in order, the credits pay for. */
function affordable(costs: readonly number[], credits: number): number {
  let left = credits;
  const short = costs.findIndex((cost) => {
    left -= cost;
    return left < 0;
  });

  return short === -1 ? costs.length : short;
}

const total = (costs: readonly number[]) => costs.reduce((sum, cost) => sum + cost, 0);

export function checkOf(costs: readonly number[], credits: number, m = 0, k = 0): Check {
  const afford = affordable(costs, credits);
  const uses = total(costs.slice(0, afford));

  return { n: costs.length, m, k, uses, after: credits - uses, wait: costs.length - afford };
}

export function costOfText(s: LinkState): number {
  return textCostOf(s.who.mobile, s.trail);
}

export function askText(s: LinkState, open: boolean): LinkState {
  if (s.texting == null) return s;

  return { ...s, texting: { ...s.texting, checking: open, checkFailed: false } };
}

/** The confirm: refused, it says so in the check; otherwise the text sends, is held, or waits for 09:00. */
export function pressText(s: LinkState): LinkState {
  const t = s.texting;
  if (t == null) return s;
  if (t.refused) return { ...s, texting: { ...t, checkFailed: true }, say: LW.notIssued };
  const cost = costOfText(s);
  const pending = t.quiet ? 'waits' : t.credits < cost ? 'held' : 'sending';
  const say =
    pending === 'sending'
      ? TW.sendingTo(s.who.name)
      : pending === 'held'
        ? `${TW.held}.`
        : `${TW.waits(QUIET_ENDS)}.`;

  return {
    ...s,
    failed: false,
    texting: {
      ...t,
      checking: false,
      checkFailed: false,
      pending,
      notDelivered: null,
      credits: pending === 'sending' ? t.credits - cost : t.credits,
    },
    toast: say,
    say,
  };
}

/** Twilio reports sent: Link sent by you, unless already opened, since the status only moves forward. */
export function reportedSent(s: LinkState): LinkState {
  const t = s.texting;
  if (t?.pending !== 'sending') return s;
  if (s.status === 'opened') return { ...s, texting: { ...t, pending: null }, say: '' };
  const before = t.undelivered ? { status: s.status, trail: s.trail } : null;

  return {
    ...s,
    status: 'sent',
    trail: { by: YOU, at: t.clock, via: 'text' },
    texting: { ...t, pending: null, before },
    say: '',
  };
}

/** Twilio reports undelivered: back to what the other deliveries make it, with the time. */
export function reportedUndelivered(s: LinkState): LinkState {
  const t = s.texting;
  if (t?.before == null) return s;

  return {
    ...s,
    status: t.before.status,
    trail: t.before.trail,
    texting: { ...t, before: null, notDelivered: NOW },
  };
}

/** Mark as sent and Replace link withdraw a waiting text: it never goes and uses no credits. */
export function withdrawn(s: LinkState): LinkState {
  const t = s.texting;
  if (t == null || (t.pending !== 'held' && t.pending !== 'waits')) return s;

  return { ...s, texting: { ...t, pending: null } };
}

export const TEXT_STATES = [
  'smsOn',
  'textCheck',
  'textCheckShort',
  'textCheckQuiet',
  'textNotSent',
  'textSending',
  'textSent',
  'textOpened',
  'textHeld',
  'textWaits',
  'textUndelivered',
  'stopped',
  'noCredits',
  'smsReadOnly',
] as const;

export type TextStateName = (typeof TEXT_STATES)[number];

export function textStateOf(raw: string | null | undefined): TextStateName | null {
  return TEXT_STATES.find((name) => name === raw) ?? null;
}

const NIGHT = { clock: '22:40', quiet: true } as const;

export function textSeed(name: TextStateName): LinkState {
  const on = (over: Partial<Texting>, from: LinkState = seed('none')): LinkState => ({
    ...from,
    texting: texting(over),
  });
  const quietly = (s: LinkState): LinkState => ({ ...s, toast: '', say: '' });
  switch (name) {
    case 'textCheck':
      return on({ checking: true });
    case 'textCheckShort':
      return on({ checking: true, credits: 0 });
    case 'textCheckQuiet':
      return on({ checking: true, ...NIGHT });
    case 'textNotSent':
      return on({ checking: true, checkFailed: true, refused: true });
    case 'textSending':
      return pressText(on({}));
    case 'textSent':
      return quietly(reportedSent(pressText(on({}))));
    case 'textOpened':
      return quietly(reportedSent(pressText(on({}, seed('opened')))));
    case 'textHeld':
      return on({ pending: 'held', credits: 0 });
    case 'textWaits':
      return on({ pending: 'waits', ...NIGHT });
    case 'textUndelivered':
      return on({ notDelivered: NOW });
    case 'stopped':
      return on({ stopped: true });
    case 'noCredits':
      return { ...on({ credits: 0, pending: 'held' }, seed('copied')) };
    case 'smsReadOnly':
      return on({}, seed('readOnly'));
    default:
      return on({});
  }
}

export function textingFor(person: OnRoster, over: Partial<Texting>): Texting {
  return texting({
    ...over,
    stopped: person.stopped === true,
    pending: person.pending ?? null,
    notDelivered: person.notDelivered ?? null,
  });
}

export function textable(person: OnRoster): boolean {
  return person.mobile != null && person.stopped !== true && person.pending == null;
}

export function owed(person: OnRoster): boolean {
  return (
    textable(person) &&
    (person.status === 'none' || person.status === 'copied' || person.status === 'shared')
  );
}

const costOfPerson = (p: OnRoster) => textCostOf(p.mobile, p.trail);

export function bulkCheck(people: readonly OnRoster[], credits: number): Check {
  return checkOf(
    people.filter(owed).map(costOfPerson),
    credits,
    people.filter((p) => p.mobile == null && p.status === 'none').length,
    people.filter((p) => p.mobile != null && p.stopped === true).length,
  );
}

export interface Pressed {
  people: OnRoster[];
  credits: number;
  lines: string[];
}

export function textAll(people: readonly OnRoster[], credits: number, quiet: boolean): Pressed {
  const due = people.filter(owed);
  const ids = due.map((p) => p.id);
  const costs = due.map(costOfPerson);
  const afford = quiet ? 0 : affordable(costs, credits);
  const go = new Set(quiet ? [] : ids.slice(0, afford));
  const held = new Set(quiet ? [] : ids.slice(afford));
  const waits = new Set(quiet ? ids : []);
  const check = bulkCheck(people, credits);

  return {
    people: people.map((p) =>
      go.has(p.id)
        ? { ...p, pending: 'sending' as const, notDelivered: null }
        : held.has(p.id)
          ? { ...p, pending: 'held' as const }
          : waits.has(p.id)
            ? { ...p, pending: 'waits' as const }
            : p,
    ),
    credits: credits - total(costs.slice(0, go.size)),
    lines: resultLines({
      sending: go.size,
      m: check.m,
      k: check.k,
      held: held.size,
      waits: waits.size,
      time: QUIET_ENDS,
    }),
  };
}

export function sentOn(person: OnRoster): OnRoster {
  if (person.pending !== 'sending') return person;
  if (person.status === 'opened') return { ...person, pending: null };

  return {
    ...person,
    pending: null,
    status: 'sent',
    trail: { by: YOU, at: NOW, via: 'text' },
  };
}

let creditsLeft = BALANCE;

export function creditsNow(): number {
  return creditsLeft;
}

export function setCredits(credits: number): void {
  creditsLeft = credits;
}

export interface TextRoster {
  people: OnRoster[];
  credits: number;
  quiet: boolean;
  billing: boolean;
  checking: boolean;
  toast: string[] | null;
}

const OWED = new Set(['tolu', 'amina', 'kunle', 'emeka', 'chinedu']);

export function textRoster(state: string): TextRoster | null {
  const base = sampleRoster();
  const list = (over: Partial<TextRoster> = {}): TextRoster => ({
    people: base,
    credits: BALANCE,
    quiet: false,
    billing: true,
    checking: false,
    toast: null,
    ...over,
  });
  const pressedTo = (credits: number, quiet: boolean, after = (p: OnRoster) => p) => {
    const pressed = textAll(base, credits, quiet);
    return list({
      people: pressed.people.map(after),
      credits: pressed.credits,
      quiet,
      toast: pressed.lines,
    });
  };
  switch (state) {
    case 'smsOn':
    case 'smsReadOnly':
      return list();
    case 'bulkCheck':
      return list({ checking: true });
    case 'bulkCheckShort':
      return list({ checking: true, credits: 150 });
    case 'bulkCheckAsk':
      return list({ checking: true, credits: 150, billing: false });
    case 'bulkCheckQuiet':
      return list({ checking: true, quiet: true });
    case 'bulkSending':
      return pressedTo(BALANCE, false);
    case 'bulkResult':
      return pressedTo(BALANCE, false, sentOn);
    case 'bulkHeld':
      return pressedTo(150, false);
    case 'bulkQuiet':
      return pressedTo(BALANCE, true);
    case 'bulkNone':
      return list({
        people: base.map((p) => (OWED.has(p.id) ? sentOn({ ...p, pending: 'sending' }) : p)),
      });
    case 'stopped':
      return list({ people: base.map((p) => (p.id === 'chinedu' ? { ...p, stopped: true } : p)) });
    default:
      return null;
  }
}
