import { demoWords } from './demoWords.ts';
import type { InviteSms } from './inviteSms.ts';
import type { Ticks } from './messages.ts';
import { SW } from './messagesSmsWords.ts';

export { SW };

const sw = demoWords(SW);

export const SMS_GROUP = 'SMS (sc-3946)';

export const SMS_STATES = [
  { key: 'smsLine', name: 'SMS ticked: who it reaches' },
  { key: 'checkQuiet', name: 'The check, texts waiting for morning' },
  { key: 'checkQuietBoth', name: 'The check, texts and WhatsApp waiting' },
  { key: 'checkNow', name: 'Happening now at 23:00: nothing waits' },
  { key: 'reachedSmsFailed', name: 'Who it reached, texts that failed' },
  { key: 'previewFirstText', name: 'Preview: a first text' },
  { key: 'invitePreviewUnicode', name: 'The invitation previewed as Lucía Ortega: Unicode' },
] as const;

export type SmsState = (typeof SMS_STATES)[number]['key'];

export function isSmsState(state: string | null): state is SmsState {
  return SMS_STATES.some((one) => one.key === state);
}

/** The sample's clock for a check: inside hours, 09:41 with some numbers outside them, or 23:00 while the event is Happening now. */
export type Hour = 'quiet' | 'live';

export type SmsSample = 'all' | 'coming' | 'notReplied';

/** Who SMS reaches per audience, each guest counted once: a mobile number not stopped, then none, then stopped (sc-3946 AC). */
export const SMS_REACH: Record<SmsSample, { reaches: number; noMobile: number; stopped: number }> =
  {
    all: { reaches: 39, noMobile: 102, stopped: 1 },
    coming: { reaches: 31, noMobile: 65, stopped: 0 },
    notReplied: { reaches: 9, noMobile: 16, stopped: 0 },
  };

export function smsReachLine(sample: SmsSample): string {
  const { reaches, noMobile, stopped } = SMS_REACH[sample];
  const cant = [
    ...(noMobile > 0 ? [sw.many('noMobile', noMobile)] : []),
    ...(stopped > 0 ? [sw.many('stoppedTexts', stopped)] : []),
  ];

  return [
    sw.filled(SW.smsReaches, { count: reaches, total: reaches + noMobile + stopped }),
    ...(cant.length > 0 ? [sw.listed(cant)] : []),
  ].join(' · ');
}

export const OPENS_AT = '09:00';

/** Coming's numbers outside 09:00 to 20:00 their time at 09:41 London: three in Colombia (04:41) and Rafael Costa's in Rio (06:41). */
export const QUIET_NUMBERS: readonly { id: string; country: string; byWhatsApp: boolean }[] = [
  { id: 'valentina', country: 'CO', byWhatsApp: false },
  { id: 'co-2', country: 'CO', byWhatsApp: false },
  { id: 'co-3', country: 'CO', byWhatsApp: false },
  { id: 'rafael', country: 'BR', byWhatsApp: true },
];

/** The check's one wait line (sc-3946, l10n #45570): the people whose text or WhatsApp message waits for 09:00 their time, or null when nothing waits. */
export function waitLine(ticks: Ticks, hour: Hour | undefined): string | null {
  if (hour !== 'quiet') return null;

  const waiting = QUIET_NUMBERS.filter((one) =>
    one.byWhatsApp ? ticks.whatsApp || ticks.sms : ticks.sms,
  ).length;

  if (waiting === 0) return null;

  const slots = { time: OPENS_AT };

  if (ticks.sms && ticks.whatsApp) return sw.many('bothWait', waiting, slots);

  return ticks.sms ? sw.many('textsWait', waiting, slots) : sw.many('whatsAppWait', waiting, slots);
}

/** The SMS card's head (pm #45575): "SMS · 2 parts · GSM-7 · 177 characters". */
export function counterOf({ parts, chars, unicode }: InviteSms): string {
  return [
    sw.many('counterParts', parts),
    unicode ? SW.unicode : SW.gsm7,
    sw.many('counterChars', chars),
  ].join(' · ');
}

export function firstTextLine(organisation: string): string {
  return sw.filled(SW.firstText, { organisation });
}

export type FailReason = '30005' | '30006' | '30003' | '30007' | 'other' | 'none';

/** A failed text's reason as a row phrase (l10n #45569), the provider's code in brackets. */
export function failedWhy(reason: FailReason, code?: string): string {
  switch (reason) {
    case '30005':
      return sw.filled(SW.notInUse, { code: reason });
    case '30006':
      return sw.filled(SW.cannotReceive, { code: reason });
    case '30003':
      return sw.filled(SW.phoneOff, { code: reason });
    case '30007':
      return sw.filled(SW.blocked, { code: reason });
    case 'other':
      return sw.filled(SW.noReasonCode, { code: code ?? '' });
    case 'none':
      return SW.noReason;
  }
}
