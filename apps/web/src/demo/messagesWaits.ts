import { demoWords } from './demoWords.ts';
import type { Channel, Check, Ticks, Untellable } from './messages.ts';
import type { Audience } from './messagesTo.ts';
import { MW } from './messagesWords.ts';
import { WW } from './messagesWaitsWords.ts';

export { WW };

const mw = demoWords(MW);
const ww = demoWords(WW);

export const WAITS_STATES = [
  { key: 'checkWaitsWa', name: 'Too few credits, WhatsApp' },
  { key: 'checkWaitsSms', name: 'Too few credits, SMS' },
  { key: 'checkWaitsBoth', name: 'Too few credits, both' },
  { key: 'checkWaitsNoEmail', name: 'Too few credits, no email' },
  { key: 'checkWaitsOnly', name: 'Too few credits, WhatsApp only' },
  { key: 'askOwner', name: 'Ask an owner' },
  { key: 'askSent', name: 'Ask an owner, sent' },
  { key: 'askSentOne', name: 'Ask an owner, one owner' },
  { key: 'askFailed', name: 'Ask an owner, not sent' },
  { key: 'sendWithout', name: 'After Send without SMS' },
] as const;

export type WaitsState = (typeof WAITS_STATES)[number]['key'];

const ticked = (...on: readonly Channel[]): Ticks => ({
  email: on.includes('email'),
  sms: on.includes('sms'),
  whatsApp: on.includes('whatsApp'),
});

export const EMAIL_ONLY = ticked('email');

const CHECK_TICKS: Partial<Record<WaitsState, Ticks>> = {
  checkWaitsWa: ticked('email', 'whatsApp'),
  checkWaitsSms: ticked('email', 'sms'),
  checkWaitsBoth: ticked('email', 'sms', 'whatsApp'),
  checkWaitsNoEmail: ticked('sms', 'whatsApp'),
  checkWaitsOnly: ticked('whatsApp'),
  askOwner: ticked('email', 'sms'),
  askSent: ticked('email', 'sms'),
  askSentOne: ticked('email', 'sms'),
  askFailed: ticked('email', 'sms'),
};

/** The ticks a check state opens with at a balance of 0, or null for any other state. */
export function waitsTicksOf(state: string | null): Ticks | null {
  return CHECK_TICKS[state as WaitsState] ?? null;
}

export type Billing = 'add' | 'ready' | 'asking' | 'sent' | 'failed';

export function billingOf(state: string | null): Billing {
  switch (state) {
    case 'askOwner':
      return 'ready';
    case 'askSent':
    case 'askSentOne':
      return 'sent';
    case 'askFailed':
      return 'failed';
    default:
      return 'add';
  }
}

export function ownersOf(state: string | null): number {
  return state === 'askSentOne' ? 1 : 2;
}

export function askedWords(owners: number): string {
  return ww.many('ownersSent', owners);
}

const TOMAS: Untellable = { name: 'Tomás Ferreira', why: [MW.addressBouncing, MW.noPhone] };
const JOAQUIN: Untellable = { name: 'Joaquín Ruiz', why: [MW.noEmail, MW.noPhone] };
const SMS_ONLY: readonly Untellable[] = [
  { name: 'Amaka Eze', why: [MW.noEmail, MW.smsIsOff] },
  { name: 'Priyanka Nair', why: [MW.noEmail, MW.smsIsOff] },
];
const COMING_N = 96;

/** Coming · 96: Email 92, a mobile 31, 3 of them on WhatsApp; with both ticked each phone is told once (sc-3954). */
export function waitsFiguresOf(ticks: Ticks): {
  counts: Record<Channel, number>;
  cantTell: number;
  names: readonly Untellable[];
  smsOff: number;
} {
  const counts = {
    email: ticks.email ? 92 : 0,
    sms: ticks.sms ? (ticks.whatsApp ? 28 : 31) : 0,
    whatsApp: ticks.whatsApp ? 3 : 0,
  };

  if (ticks.email && ticks.sms) return { counts, cantTell: 2, names: [TOMAS, JOAQUIN], smsOff: 0 };
  if (ticks.email) return { counts, cantTell: 4, names: SMS_ONLY, smsOff: 2 };

  return {
    counts,
    cantTell: COMING_N - counts.sms - counts.whatsApp,
    names: [TOMAS, JOAQUIN],
    smsOff: 0,
  };
}

function isComing(audience: Audience): boolean {
  return (
    audience.kind === 'who' &&
    audience.conditions.length === 1 &&
    audience.conditions[0] === 'coming'
  );
}

const ORDER: readonly Channel[] = ['email', 'sms', 'whatsApp'];

/** The check at a balance of 0: no credits line while a paid message waits, and Coming's own figures. */
export function waitsCheckOf(check: Check, audience: Audience, ticks: Ticks): Check {
  if (!ticks.sms && !ticks.whatsApp) return check;
  if (!isComing(audience)) return { ...check, credits: null };

  const { counts, cantTell, names, smsOff } = waitsFiguresOf(ticks);

  return {
    ...check,
    pills: ORDER.filter((channel) => ticks[channel]).map((channel) => ({
      channel,
      count: counts[channel],
    })),
    smsOff: smsOff > 0 ? mw.many('smsOff', smsOff) : null,
    cantTell,
    cant: names.slice(0, Math.min(2, cantTell)),
    credits: null,
  };
}

export interface Waits {
  either: boolean;
  lines: readonly string[];
  way: { word: string; ticks: Ticks } | null;
}

/** What waits for credits, WhatsApp first, and the one way past that still leaves something to send. */
export function waitsOf(check: Check, ticks: Ticks): Waits | null {
  const count = (channel: Channel) =>
    check.pills.find((pill) => pill.channel === channel)?.count ?? 0;
  const wa = ticks.whatsApp ? count('whatsApp') : 0;
  const sms = ticks.sms ? count('sms') : 0;

  if (wa === 0 && sms === 0) return null;

  const lines = [
    ...(wa > 0 ? [mw.many('whatsAppWaits', wa)] : []),
    ...(sms > 0 ? [mw.many('smsWaits', sms)] : []),
  ];
  const way = !ticks.email
    ? null
    : wa > 0 && sms > 0
      ? { word: WW.sendByEmailOnly, ticks: EMAIL_ONLY }
      : wa > 0
        ? { word: WW.sendWithoutWhatsApp, ticks: { ...ticks, whatsApp: false } }
        : { word: WW.sendWithoutSms, ticks: { ...ticks, sms: false } };

  return { either: ticks.email, lines, way };
}
