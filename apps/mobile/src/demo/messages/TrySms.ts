import { smsEncoding } from '../events/MakeLive.ts';
import {
  EVENT,
  type GroupKey,
  HOSTS,
  type Mobile,
  NOW,
  type ReachLine,
  formatCount,
} from './MessagesSample.ts';
import { CHANNEL_WORD, W, say } from './MessagesWords.ts';
import { QUIET_UNTIL, noticeCredits, noticeSmsOf } from './NoticeStates.ts';
import { sayNotice } from './NoticeWords.ts';

export type Texted = 'sent' | 'waiting' | 'held';

const QUIET_FROM = '20:00';

/** Quiet hours (sc-3946): a text waits while it is before 09:00 or from 20:00 in the guest's own time. */
export function isQuiet(theirTime: string): boolean {
  return theirTime < QUIET_UNTIL || theirTime >= QUIET_FROM;
}

export interface SmsChance {
  group: GroupKey;
  told: boolean;
  mobile?: Mobile | undefined;
  lines: readonly ReachLine[];
}

const NOT_OFFERED: readonly GroupKey[] = ['reached', 'inProgress', 'held'];

function onItsWay(line: ReachLine): boolean {
  return (
    line.word.startsWith(CHANNEL_WORD.sms) ||
    line.mark === 'sending' ||
    line.word.endsWith(W.tooLate)
  );
}

/** Who Try SMS instead is offered to (sc-3966, Decided 13 Nov): not reached and not told, nothing in progress, held or too late, a mobile that has not stopped texts, and no text for this message; whatever their email line reads. */
export function offersTrySms({ group, told, mobile, lines }: SmsChance): boolean {
  return (
    !told &&
    !NOT_OFFERED.includes(group) &&
    mobile != null &&
    mobile.stopped !== true &&
    !lines.some(onItsWay)
  );
}

export interface TrySmsView {
  credits: number;
  count: string;
  uses: string;
  waits: string | null;
  quiet: string | null;
}

/** Try SMS instead, pressed: the guest's own text counted with its link as built (sc-3946), its credits, and either wait. */
export function trySmsOf(mobile: Mobile, balance: number): TrySmsView {
  const sms = noticeSmsOf(HOSTS, EVENT);
  const credits = noticeCredits('sms', mobile.perPart, sms.parts);
  const short = credits > balance;

  return {
    credits,
    count: say.smsCount(sms.parts, smsEncoding(sms.text), sms.chars),
    uses: short
      ? say.textUses(credits)
      : say.noticeCost('sms', credits, formatCount(balance - credits)),
    waits: short ? say.waits('sms', 1) : null,
    quiet: isQuiet(mobile.theirTime) ? sayNotice.waitsUntil(false, QUIET_UNTIL) : null,
  };
}

/** Send by SMS: held when the credits fall short, waiting in their quiet hours, else sent now. */
export function textedOf(mobile: Mobile, balance: number): Texted {
  const cost = trySmsOf(mobile, balance);
  if (cost.waits != null) return 'held';

  return cost.quiet == null ? 'sent' : 'waiting';
}

/** The balance after Send by SMS: a held text has used nothing yet. */
export function balanceAfterText(mobile: Mobile, balance: number): number {
  return textedOf(mobile, balance) === 'held'
    ? balance
    : balance - trySmsOf(mobile, balance).credits;
}

export const TEXTED_LINE: Record<Texted, ReachLine> = {
  sent: { mark: 'sent', word: say.where(CHANNEL_WORD.sms, W.sent), reason: NOW },
  waiting: { mark: 'sending', word: CHANNEL_WORD.sms, reason: sayNotice.waitingUntil(QUIET_UNTIL) },
  held: { mark: 'sending', word: say.where(CHANNEL_WORD.sms, W.held) },
};

export function textedLines(lines: readonly ReachLine[], texted: Texted): readonly ReachLine[] {
  return [...lines.slice(0, -1), TEXTED_LINE[texted], ...lines.slice(-1)];
}

export function textedGroup(texted: Texted): 'inProgress' | 'held' {
  return texted === 'held' ? 'held' : 'inProgress';
}

/** sc-3966's states of Who it reached, each a `?state=` in both demos. */
export const REASON_STATES = [
  'reasons',
  'trySms',
  'trySmsQuiet',
  'trySmsShort',
  'trySmsSent',
  'closedReached',
  'reachedQuiet',
] as const;

export function isReasonState(state: string | null): boolean {
  return REASON_STATES.some((one) => one === state);
}

export type ReachSample = 'reasons' | 'nightText';
