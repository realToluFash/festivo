import { listFormat } from '@soirely/domain';

import type { Action, Check, Draft } from './MessagesModel.ts';
import { CANT_TELL, SMS_ONLY, TO_FIGURES, formatCount } from './MessagesSample.ts';
import type { ChannelKey } from './MessagesWords.ts';

/** sc-3963's too-few-credits branch of the check, in the AC's English (l10n #23662, #23680). */
export const WW = {
  either: 'Email goes either way.',
  withoutWa: 'Send without WhatsApp',
  withoutSms: 'Send without SMS',
  emailOnly: 'Send by email only',
  askOwner: 'Ask an owner',
  askFailed: 'Not sent. Try again in a moment.',
} as const;

export const sayWaits = {
  waits: (channel: 'sms' | 'wa', count: number) => {
    const name = channel === 'wa' ? 'WhatsApp' : 'SMS';

    return count === 1
      ? `1 ${name} message will wait for credits.`
      : `${count} ${name} messages will wait for credits.`;
  },
  asked: (owners: number) =>
    owners === 1
      ? 'The owner has been sent the link to Plan and billing.'
      : 'The owners have been sent the link to Plan and billing.',
  toldHow: (channels: string) =>
    `Your message goes on their page. Soirely tells them it is there by ${channels}.`,
};

const IN_TOLD: Record<ChannelKey, string> = { email: 'email', sms: 'text', wa: 'WhatsApp' };

export type Ask = 'ready' | 'asking' | 'sent' | 'failed';

/** Who reads the check: with billing.manage the app's line, without it Ask an owner; `owners` picks the confirmation's form. */
export interface Waits {
  canBill: boolean;
  owners: number;
  ask: Ask;
}

export interface WaysPast {
  label: string;
  drops: readonly ChannelKey[];
}

export interface WaitsCheck {
  check: Check;
  told: string;
  either: boolean;
  waiting: readonly { key: 'sms' | 'wa'; count: number }[];
  way: WaysPast | null;
}

export const OWNER: Waits = { canBill: true, owners: 2, ask: 'ready' };
const ADMIN: Waits = { canBill: false, owners: 2, ask: 'ready' };

function ticks(...on: readonly ChannelKey[]): Record<ChannelKey, boolean> {
  return { email: on.includes('email'), sms: on.includes('sms'), wa: on.includes('wa') };
}

/** Each sc-3963 `?state=`, on Coming · 96 at a balance of 0 credits; Bisi Okafor, Admin, reads the ask states. */
export const WAITS_STARTS: Partial<
  Record<
    string,
    { channels: Record<ChannelKey, boolean>; waits: Waits; step: 'check' | 'countdown' }
  >
> = {
  checkWaitsWa: { channels: ticks('email', 'wa'), waits: OWNER, step: 'check' },
  checkWaitsSms: { channels: ticks('email', 'sms'), waits: OWNER, step: 'check' },
  checkWaitsBoth: { channels: ticks('email', 'sms', 'wa'), waits: OWNER, step: 'check' },
  checkWaitsNoEmail: { channels: ticks('sms', 'wa'), waits: OWNER, step: 'check' },
  checkWaitsOnly: { channels: ticks('wa'), waits: OWNER, step: 'check' },
  askOwner: { channels: ticks('email', 'sms'), waits: ADMIN, step: 'check' },
  askSent: { channels: ticks('email', 'sms'), waits: { ...ADMIN, ask: 'sent' }, step: 'check' },
  askSentOne: {
    channels: ticks('email', 'sms'),
    waits: { ...ADMIN, owners: 1, ask: 'sent' },
    step: 'check',
  },
  askFailed: {
    channels: ticks('email', 'sms'),
    waits: { ...ADMIN, ask: 'failed' },
    step: 'check',
  },
  sendWithout: { channels: ticks('email'), waits: OWNER, step: 'countdown' },
};

function wayOf(channels: Record<ChannelKey, boolean>): WaysPast | null {
  if (!channels.email) return null;
  if (channels.sms && channels.wa) return { label: WW.emailOnly, drops: ['sms', 'wa'] };

  return channels.wa
    ? { label: WW.withoutWa, drops: ['wa'] }
    : { label: WW.withoutSms, drops: ['sms'] };
}

/** At 0 credits every ticked paid message waits (sc-3932); each phone is told once, by WhatsApp where they agreed (sc-3954). Null when nothing waits. */
export function waitsCheckOf(draft: Draft, balance: number, locale = 'en-US'): WaitsCheck | null {
  const { channels, to } = draft;
  if (balance > 0 || draft.zero.includes(to) || (!channels.sms && !channels.wa)) return null;
  const figures = TO_FIGURES[to];
  const counts = {
    email: figures.email,
    sms: channels.wa ? figures.sms - figures.wa : figures.sms,
    wa: figures.wa,
  };
  const ticked = (['email', 'sms', 'wa'] as const).filter((key) => channels[key]);
  const smsOff = channels.email && !channels.sms ? SMS_ONLY[to].length : 0;
  const phones = channels.sms ? figures.sms : figures.wa;
  const cantTell = channels.email ? figures.cantTell + smsOff : figures.count - phones;
  const names = (smsOff > 0 ? SMS_ONLY[to] : CANT_TELL[to]).slice(0, 2);
  const waiting = (['wa', 'sms'] as const)
    .filter((key) => channels[key])
    .map((key) => ({ key, count: counts[key] }));

  return {
    check: {
      count: figures.count,
      told: ticked.map((key) => ({ key, count: counts[key] })),
      cantTell,
      smsOff,
      names,
      seeAll: cantTell > names.length,
      credits: 0,
      after: formatCount(balance),
      whatsApp: channels.wa,
    },
    told: sayWaits.toldHow(
      listFormat(locale, { style: 'long', type: 'conjunction' }).format(
        ticked.map((key) => IN_TOLD[key]),
      ),
    ),
    either: channels.email,
    waiting,
    way: wayOf(channels),
  };
}

/** Send without: the dropped channels unticked, then straight into the ten seconds, as Send does; nobody moves to another channel. */
export function sendWithout(drops: readonly ChannelKey[]): Action[] {
  return [...drops.map((key): Action => ({ type: 'channel', key })), { type: 'confirm' }];
}

/** A press while one is under way, or once sent, sends nothing more; a press after a failure clears it and tries again. */
export function pressAsk(ask: Ask): { ask: Ask; sends: boolean } {
  return ask === 'asking' || ask === 'sent'
    ? { ask, sends: false }
    : { ask: 'asking', sends: true };
}

export function askAnswered(ask: Ask, ok: boolean): Ask {
  if (ask !== 'asking') return ask;

  return ok ? 'sent' : 'failed';
}

/** The ask's answer comes back after this long in the demo; it always goes. */
export const ASK_MS = 700;
