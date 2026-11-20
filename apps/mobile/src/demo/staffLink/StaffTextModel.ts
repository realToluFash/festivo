import { type LinkState, type Texting, NOW, W, YOU, acts, seed } from './StaffLinkModel.ts';
import { type OnRoster, sampleRoster } from './StaffRosterModel.ts';

const one = (n: number, single: string, many: string) => (n === 1 ? single : many);
const counted = (n: number) => n.toLocaleString('en-GB');

/** sc-77904's words as the AC quotes [en] (#77928, #77937, #77953); [bracketed] ones are the drawing's, for [en]. */
export const TW = {
  text: 'Text the link',
  bulk: (n: number) => `Text links to ${n}`,
  sending: 'Sending text…',
  held: 'Text held: no credits',
  waits: (time: string) => `Text waits until ${time}, their time`,
  notDelivered: (time: string) => `Text not delivered · ${time}`,
  stopped: 'Stopped texts',
  sendingTo: (name: string) => `Sending the link to ${name}.`,
  checkOne: (name: string) => `[Text the link to ${name}?]`,
  checkMany: (n: number) => `[Text links to ${n} ${one(n, 'person', 'people')}?]`,
  checkLine: '[Each gets a text with their own link. Links sent before keep working.]',
  thisTextUses: (c: number) => `This text uses ${counted(c)} ${one(c, 'credit', 'credits')}.`,
  textsUse: (c: number) => `Texts use ${counted(c)} ${one(c, 'credit', 'credits')}.`,
  after: (c: number) => `Credits after sending: ${counted(c)}.`,
  smsWaits: (w: number) =>
    `${counted(w)} ${one(w, 'SMS message', 'SMS messages')} will wait for credits.`,
  quiet: (n: number, time: string) =>
    `Texts to ${counted(n)} ${one(n, 'person', 'people')} wait until ${time}, their time.`,
  notInApp: 'Credits cannot be added in the app.',
  askOwner: 'Ask an owner',
  cancel: 'Cancel',
  allSent: '[Everyone with a mobile number has been sent a link.]',
  noMobile: (m: number) => `${m} ${one(m, 'has', 'have')} no mobile number.`,
  stoppedCount: (k: number) => `${k} ${one(k, 'has', 'have')} stopped texts.`,
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
    r.sending === 0 ? '' : `Sending to ${r.sending} ${one(r.sending, 'person', 'people')}.`,
    r.m === 0 ? '' : TW.noMobile(r.m),
    r.k === 0 ? '' : TW.stoppedCount(r.k),
    r.held === 0 ? '' : `${r.held} held: no credits.`,
    r.waits === 0 ? '' : `${r.waits} ${one(r.waits, 'waits', 'wait')} until ${r.time}, their time.`,
  ].filter((line) => line !== '');
}

/** A sample of sc-3928's unit costs: one text's credits by its number's country, never the event's. */
export const CREDITS_A_TEXT: Readonly<Record<string, number>> = {
  NG: 62,
  GB: 9,
  FR: 13,
  ES: 14,
  PT: 8,
  BR: 10,
  MX: 29,
  US: 2,
};

export const BALANCE = 1500;
export const QUIET_ENDS = '09:00';
export const SENT_MS = 2400;

export function creditsFor(country = 'NG'): number {
  return CREDITS_A_TEXT[country] ?? 0;
}

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
    s.who.mobile &&
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

export function checkOf(n: number, credits: number, m = 0, k = 0): Check {
  const afford = Math.min(n, Math.floor(credits / creditsFor()));
  const uses = afford * creditsFor();

  return { n, m, k, uses, after: credits - uses, wait: n - afford };
}

export function askText(s: LinkState, open: boolean): LinkState {
  if (s.texting == null) return s;

  return { ...s, texting: { ...s.texting, checking: open, checkFailed: false } };
}

/** The confirm: refused, it says so in the check; otherwise the text sends, is held, or waits for 09:00. */
export function pressText(s: LinkState): LinkState {
  const t = s.texting;
  if (t == null) return s;
  if (t.refused) return { ...s, texting: { ...t, checkFailed: true }, say: W.notIssued };
  const pending = t.quiet ? 'waits' : t.credits < creditsFor() ? 'held' : 'sending';
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
      credits: pending === 'sending' ? t.credits - creditsFor() : t.credits,
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
  return person.mobile && person.stopped !== true && person.pending == null;
}

export function owed(person: OnRoster): boolean {
  return (
    textable(person) &&
    (person.status === 'none' || person.status === 'copied' || person.status === 'shared')
  );
}

export function bulkCheck(people: readonly OnRoster[], credits: number): Check {
  return checkOf(
    people.filter(owed).length,
    credits,
    people.filter((p) => !p.mobile && p.status === 'none').length,
    people.filter((p) => p.mobile && p.stopped === true).length,
  );
}

export interface Pressed {
  people: OnRoster[];
  credits: number;
  lines: string[];
}

export function textAll(people: readonly OnRoster[], credits: number, quiet: boolean): Pressed {
  const ids = people.filter(owed).map((p) => p.id);
  const afford = quiet ? 0 : Math.min(ids.length, Math.floor(credits / creditsFor()));
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
    credits: credits - go.size * creditsFor(),
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
