import {
  EVENT_ON,
  type GuestMobile,
  HAPPENING_NOW,
  PHONE_ZONES,
  QUIET_NOW,
} from './MessagesSample.ts';
import type { ChannelKey } from './MessagesWords.ts';
import { QUIET_UNTIL } from './NoticeStates.ts';
import { FAILED_REASON, type Quiet, SMSW, saySms } from './SmsWords.ts';

export const SMS_STATES = [
  'smsLine',
  'checkQuiet',
  'checkQuietBoth',
  'checkNow',
  'reachedSmsFailed',
  'previewFirstText',
] as const;

export type SmsState = (typeof SMS_STATES)[number];

export function isSmsState(state: string | null): state is SmsState {
  return SMS_STATES.some((one) => one === state);
}

const CLOCKS: Partial<Record<SmsState, string>> = {
  checkQuiet: QUIET_NOW,
  checkQuietBoth: QUIET_NOW,
  checkNow: HAPPENING_NOW,
};

export function smsStart(state: string | null): { clock?: string; smsFailed?: boolean } {
  if (state === 'reachedSmsFailed') return { smsFailed: true };
  const clock = isSmsState(state) ? CLOCKS[state] : undefined;

  return clock == null ? {} : { clock };
}

export function clockNote(clock: string | undefined): string | null {
  return clock === HAPPENING_NOW ? SMSW.happeningNow : null;
}

export type Encoding = 'gsm7' | 'unicode';

export interface SmsCount {
  parts: number;
  encoding: Encoding;
  chars: number;
}

export function smsHead(count: SmsCount): string {
  return saySms.head(count.parts, count.encoding, count.chars);
}

export function failedReason(code: string | null): string {
  if (code == null) return SMSW.noReason;
  const reason = FAILED_REASON[code];

  return reason == null ? saySms.noReason(code) : reason(code);
}

export const QUIET_FROM = '20:00';

function minutesOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);

  return hours * 60 + minutes;
}

export function zoneOf(phone: string, fallback = 'Europe/London'): string {
  return PHONE_ZONES.find((one) => phone.startsWith(`${one.code} `))?.zone ?? fallback;
}

export function wallTime(instant: string, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: zone,
  }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((one) => one.type === type)?.value ?? '00';

  return `${part('hour')}:${part('minute')}`;
}

export function isQuiet(instant: string, zone: string): boolean {
  const at = minutesOf(wallTime(instant, zone));

  return at < minutesOf(QUIET_UNTIL) || at >= minutesOf(QUIET_FROM);
}

export interface QuietWait {
  by: Quiet;
  count: number;
}

/** Nothing waits while the event is happening; with both ticked, a mobile that agreed to WhatsApp goes by WhatsApp only. */
export function quietWaitOf(
  mobiles: readonly GuestMobile[],
  channels: Record<ChannelKey, boolean>,
  now: string,
  event: { starts: string; ends: string } = EVENT_ON,
): QuietWait | null {
  const at = Date.parse(now);
  if (at >= Date.parse(event.starts) && at < Date.parse(event.ends)) return null;
  if (!channels.sms && !channels.wa) return null;
  const count = mobiles.filter(
    (one) => (channels.sms || (channels.wa && one.whatsApp)) && isQuiet(now, zoneOf(one.phone)),
  ).length;
  if (count === 0) return null;

  return { by: channels.sms && channels.wa ? 'both' : channels.sms ? 'sms' : 'wa', count };
}

export function quietLineOf(
  mobiles: readonly GuestMobile[],
  channels: Record<ChannelKey, boolean>,
  now: string | undefined,
): string | null {
  if (now == null) return null;
  const wait = quietWaitOf(mobiles, channels, now);

  return wait == null ? null : saySms.waits(wait.by, wait.count, QUIET_UNTIL);
}
