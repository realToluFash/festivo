import { type LinkState, type Texting, NOW, W, YOU, acts, seed } from './StaffLinkModel.ts';
import { type OnRoster, sampleRoster } from './StaffRosterModel.ts';

/** sc-77904's words; [bracketed] ones are proposals waiting for [en]. */
export const TW = {
  text: 'Text the link',
  textSent: (name: string) => `Text sent to ${name}.`,
  held: 'Held: no credits',
  heldLine: '[It goes once there are credits. Share or copy the link meanwhile.]',
  stopped: 'Stopped texts',
  stoppedLine: '[They replied STOP. Share or copy the link instead.]',
  waits: 'Waits until 08:00, their time',
  waitsLine: '[Quiet hours: it goes in the morning.]',
  bulk: (n: number) => `Text links to ${n}`,
  allSent: '[Everyone with a mobile number has been sent a link.]',
  checkTitle: (n: number) => `Text links to ${n} ${n === 1 ? 'person' : 'people'}?`,
  checkLine: 'Each of them gets a text with their own link. Links sent before keep working.',
  noMobile: (m: number) =>
    m === 1
      ? '1 has no mobile number and is left out.'
      : `${m} have no mobile number and are left out.`,
  stoppedSkip: (k: number) =>
    `${k} stopped texts and ${k === 1 ? 'is' : 'are'} left out. Share or copy their link instead.`,
  uses: (c: number) => `Texts use ${counted(c)} ${c === 1 ? 'credit' : 'credits'}.`,
  after: (c: number) => `Balance after sending: ${counted(c)} ${c === 1 ? 'credit' : 'credits'}.`,
  wait: (w: number) => `${w} ${w === 1 ? 'text' : 'texts'} will wait for credits.`,
  send: 'Send',
  notNow: 'Not now',
};

function counted(n: number): string {
  return n.toLocaleString('en-GB');
}

/** A sample of sc-3928's unit costs: the credits one text costs by its number's country, never the event's. */
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

export const SAMPLE_COUNTRY = 'NG';
export const BALANCE = 1500;

export function creditsFor(country: string = SAMPLE_COUNTRY): number {
  return CREDITS_A_TEXT[country] ?? 0;
}

const texting = (over: Partial<Texting> = {}): Texting => ({
  credits: BALANCE,
  fails: false,
  stopped: false,
  quietWaits: false,
  clock: NOW,
  note: null,
  ...over,
});

export function offersText(s: LinkState): boolean {
  return (
    s.texting != null &&
    acts(s) &&
    !s.texting.stopped &&
    s.texting.note == null &&
    !s.asking &&
    s.view === 'manage'
  );
}

export type TextOutcome = 'sent' | 'notSent' | 'held' | 'waits';

/** Proposal, #77921: quiet hours do not hold a staff link (point 1), unless pm says they do. */
export function outcomeOf(t: Texting): TextOutcome {
  if (t.fails) return 'notSent';
  if (t.credits < creditsFor()) return 'held';
  if (t.quietWaits && (t.clock >= '21:00' || t.clock < '08:00')) return 'waits';

  return 'sent';
}

export function textSent(s: LinkState): LinkState {
  const t = s.texting ?? texting();
  const said = TW.textSent(s.who.name);
  const moved =
    s.status === 'opened'
      ? { status: s.status, trail: s.trail }
      : { status: 'sent' as const, trail: { by: YOU, at: t.clock, via: 'text' as const } };

  return {
    ...s,
    ...moved,
    busy: null,
    failed: false,
    texting: { ...t, credits: t.credits - creditsFor() },
    toast: said,
    say: said,
  };
}

export function textNotSent(s: LinkState): LinkState {
  return { ...s, busy: null, failed: true, say: W.notIssued };
}

/** Held for credits (proposal, #77921, point 4) or waiting for the morning: the status stays, with the note. */
export function textHeld(s: LinkState, note: 'held' | 'waits'): LinkState {
  const t = s.texting ?? texting();

  return {
    ...s,
    busy: null,
    texting: { ...t, note },
    say: note === 'held' ? TW.held : TW.waits,
  };
}

export function afterText(s: LinkState): LinkState {
  const outcome = outcomeOf(s.texting ?? texting());
  if (outcome === 'notSent') return textNotSent(s);
  if (outcome === 'held' || outcome === 'waits') return textHeld(s, outcome);

  return textSent(s);
}

export const TEXT_STATES = [
  'smsOn',
  'textBusy',
  'textSent',
  'textOpened',
  'textNotSent',
  'textHeld',
  'stopped',
  'quiet',
  'quietWaits',
  'noCredits',
  'smsReadOnly',
] as const;

export type TextStateName = (typeof TEXT_STATES)[number];

export function textStateOf(raw: string | null | undefined): TextStateName | null {
  return TEXT_STATES.find((one) => one === raw) ?? null;
}

export function textSeed(name: TextStateName): LinkState {
  const s: LinkState = { ...seed('none'), texting: texting() };
  const opened: LinkState = { ...s, status: 'opened', trail: { by: '', at: '19:05' } };
  const quiet = { ...s, texting: texting({ clock: '22:40' }) };
  switch (name) {
    case 'textBusy':
      return { ...s, busy: 'text' };
    case 'textSent':
      return textSent(s);
    case 'textOpened':
      return textSent(opened);
    case 'textNotSent':
      return { ...textNotSent(s), texting: texting({ fails: true }), say: '' };
    case 'textHeld':
      return { ...textHeld({ ...s, texting: texting({ credits: 0 }) }, 'held'), say: '' };
    case 'stopped':
      return { ...s, texting: texting({ stopped: true }) };
    case 'quiet':
      return textSent(quiet);
    case 'quietWaits':
      return {
        ...textHeld({ ...s, texting: texting({ clock: '22:40', quietWaits: true }) }, 'waits'),
        say: '',
      };
    case 'noCredits':
      return {
        ...s,
        status: 'copied',
        trail: { by: YOU, at: NOW },
        texting: texting({ credits: 0, note: 'held' }),
      };
    case 'smsReadOnly':
      return { ...s, view: 'read' };
    default:
      return s;
  }
}

export function textingFor(person: OnRoster, credits: number): Texting {
  return texting({
    credits,
    stopped: person.stopped === true,
    note: person.held === true ? 'held' : null,
  });
}

/** {n}: a number, not stopped or held, reading No link yet, Copied or Shared. */
export function owed(person: OnRoster): boolean {
  return (
    person.mobile &&
    person.stopped !== true &&
    person.held !== true &&
    (person.status === 'none' || person.status === 'copied' || person.status === 'shared')
  );
}

export interface Check {
  n: number;
  /** No mobile number among those not yet sent one. */
  m: number;
  k: number;
  afford: number;
  uses: number;
  after: number;
  wait: number;
}

export function checkOf(people: readonly OnRoster[], credits: number): Check {
  const n = people.filter(owed).length;
  const each = creditsFor();
  const afford = Math.min(n, Math.floor(credits / each));
  const uses = afford * each;

  return {
    n,
    m: people.filter((p) => !p.mobile && p.status === 'none').length,
    k: people.filter((p) => p.mobile && p.stopped === true).length,
    afford,
    uses,
    after: credits - uses,
    wait: n - afford,
  };
}

/** "Sent to {n}. {m} have no mobile number.", the second sentence left out at 0; held and stopped counted too. */
export function resultLine(sent: number, m: number, k: number, held: number): string {
  const heldLine = held === 0 ? '' : ` ${held} ${held === 1 ? 'is' : 'are'} held: no credits.`;
  const left = [
    m === 0 ? '' : `${m} ${m === 1 ? 'has' : 'have'} no mobile number`,
    k === 0 ? '' : `${k} stopped texts`,
  ]
    .filter((one) => one !== '')
    .join(' and ');

  return `Sent to ${sent}.${heldLine}${left === '' ? '' : ` ${left}.`}`;
}

export interface Sent {
  people: OnRoster[];
  credits: number;
  line: string;
}

/** Text links to {n}: what credits cover goes now, the rest is held (sc-3932). */
export function sendAll(people: readonly OnRoster[], credits: number): Sent {
  const check = checkOf(people, credits);
  const due = people.filter(owed).map((p) => p.id);
  const go = new Set(due.slice(0, check.afford));
  const wait = new Set(due.slice(check.afford));

  return {
    people: people.map((p) =>
      go.has(p.id)
        ? { ...p, status: 'sent', trail: { by: YOU, at: NOW, via: 'text' }, held: false }
        : wait.has(p.id)
          ? { ...p, held: true }
          : p,
    ),
    credits: credits - check.uses,
    line: resultLine(go.size, check.m, check.k, wait.size),
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
  checking: boolean;
  toast: string | null;
}

export function textRoster(state: string): TextRoster | null {
  const base = sampleRoster();
  const one = (people: OnRoster[], credits = BALANCE): TextRoster => ({
    people,
    credits,
    checking: false,
    toast: null,
  });
  switch (state) {
    case 'smsOn':
    case 'smsReadOnly':
      return one(base);
    case 'bulkCheck':
      return { ...one(base), checking: true };
    case 'bulkCheckShort':
      return { ...one(base, 150), checking: true };
    case 'bulkResult': {
      const sent = sendAll(base, BALANCE);
      return { ...one(sent.people, sent.credits), toast: sent.line };
    }
    case 'bulkHeld': {
      const held = new Set(['tolu', 'kunle', 'emeka']);
      const sent = sendAll(
        base.map((p) => (held.has(p.id) ? { ...p, held: true } : p)),
        2 * creditsFor() + 26,
      );
      return { ...one(sent.people, sent.credits), toast: resultLine(2, 1, 0, 3) };
    }
    case 'bulkNone':
      return one(sendAll(base, BALANCE).people);
    case 'stopped':
      return one(base.map((p) => (p.id === 'chinedu' ? { ...p, stopped: true } : p)));
    default:
      return null;
  }
}
