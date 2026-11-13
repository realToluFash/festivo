import { writtenTime } from '../clock.ts';
import { LINK_CHARS, smsParts } from '../events/MakeLive.ts';
import { LIVE } from '../events/EventsWords.ts';
import { READER_ZONE } from '../events/EventsSample.ts';
import type { Messages } from './MessagesModel.ts';
import {
  ANSWERS,
  DAYS,
  GUESTS,
  type GuestKey,
  LOW_BALANCE,
  type MarkKey,
  PREVIEW,
  type SampleGuest,
} from './MessagesSample.ts';
import { type ChannelKey, W, say } from './MessagesWords.ts';
import { NW, sayNotice } from './NoticeWords.ts';
import { NO_STOPS } from './StopWriting.ts';

export const NOTICE_STATES = [
  'noticeNoConsent',
  'noticeNoTemplate',
  'noticeStoppedWhatsApp',
  'noticeStopped',
  'noticeBouncing',
  'noticeSpam',
  'noticeUnsubscribed',
  'noticeWindowClosed',
  'noticeWindowRefused',
  'noticeQuiet',
  'noticeAskOwner',
  'noticeAskSent',
  'noticeAskFailed',
  'textsBackOn',
  'attachmentsNotKept',
  'sharedNumber',
  'readOnly',
] as const;

export type NoticeState = (typeof NOTICE_STATES)[number];

export function isNoticeState(state: string | null): state is NoticeState {
  return NOTICE_STATES.some((one) => one === state);
}

export type Block =
  | 'notAgreed'
  | 'noTemplate'
  | 'stoppedWhatsApp'
  | 'textedStop'
  | 'bouncing'
  | 'spam'
  | 'unsubscribed';

export type Extra =
  | { kind: 'today' }
  | { kind: 'stopped'; channel: 'sms' | 'wa'; time: string }
  | { kind: 'started'; time: string }
  | { kind: 'shared'; count: number }
  | { kind: 'later'; text: string; time: string; attachments: number };

export type Asking = 'ready' | 'sent' | 'failed';

export interface Turn {
  channel?: ChannelKey;
  asked?: Partial<SampleGuest['asked']>;
}

export interface NoticeCase {
  key: GuestKey;
  turn?: Turn;
  others?: readonly ChannelKey[];
  blocks?: Partial<Record<ChannelKey, Block>>;
  askedFirst?: boolean;
  parking?: 'bounced' | 'spam';
  extras?: readonly Extra[];
  typed?: boolean;
  windowClosed?: boolean;
  quiet?: string;
  ask?: Asking;
  shared?: { number: string; count: number };
  hidden?: boolean;
}

export const TEXTED_STOP_AT = '2026-11-02T21:40:00Z';
export const QUIET_UNTIL = '09:00';
export const SHARED_NUMBER = '+44 7700 900412';
export const LATER_TEXT =
  'Our train gets in at 16:10. The tickets are attached, in case the shuttle can meet it. Marc';

const LANGUAGES: Partial<Record<GuestKey, string>> = {
  ines: 'pt',
  lucia: 'es',
  kwame: 'en',
  valentina: 'es',
};

const KWAME_WHATSAPP: Turn = {
  channel: 'wa',
  asked: { where: 'wa', day: '2026-11-01' },
};
const LUCIA_YESTERDAY: Turn = {
  asked: { where: 'wa', day: DAYS.parking, time: '09:40' },
};
const STOPPED_TEXTS: Extra = { kind: 'stopped', channel: 'sms', time: '21:40' };

export function noticeCaseOf(state: string | null): NoticeCase | null {
  switch (state) {
    case 'noticeNoConsent':
      return {
        key: 'kwame',
        turn: KWAME_WHATSAPP,
        others: ['email', 'sms'],
        blocks: { wa: 'notAgreed' },
        askedFirst: true,
        typed: true,
      };
    case 'noticeNoTemplate':
      return { key: 'lucia', blocks: { wa: 'noTemplate' }, typed: true };
    case 'noticeStoppedWhatsApp':
      return {
        key: 'lucia',
        turn: { asked: { where: 'wa' } },
        blocks: { wa: 'stoppedWhatsApp' },
        extras: [{ kind: 'stopped', channel: 'wa', time: '08:15' }],
        typed: true,
      };
    case 'noticeStopped':
      return {
        key: 'kwame',
        others: ['email'],
        blocks: { sms: 'textedStop' },
        extras: [STOPPED_TEXTS],
        typed: true,
      };
    case 'noticeBouncing':
      return { key: 'ines', blocks: { email: 'bouncing' }, parking: 'bounced', typed: true };
    case 'noticeSpam':
      return { key: 'ines', blocks: { email: 'spam' }, parking: 'spam', typed: true };
    case 'noticeUnsubscribed':
      return { key: 'ines', blocks: { email: 'unsubscribed' }, typed: true };
    case 'noticeWindowClosed':
      return { key: 'lucia', turn: LUCIA_YESTERDAY, windowClosed: true, typed: true };
    case 'noticeWindowRefused':
      return {
        key: 'lucia',
        turn: LUCIA_YESTERDAY,
        blocks: { wa: 'noTemplate' },
        windowClosed: true,
        typed: true,
      };
    case 'noticeQuiet':
      return { key: 'valentina', quiet: QUIET_UNTIL, typed: true };
    case 'noticeAskOwner':
      return { key: 'lucia', ask: 'ready', typed: true };
    case 'noticeAskSent':
      return { key: 'lucia', ask: 'sent', typed: true };
    case 'noticeAskFailed':
      return { key: 'lucia', ask: 'failed', typed: true };
    case 'textsBackOn':
      return {
        key: 'kwame',
        extras: [STOPPED_TEXTS, { kind: 'today' }, { kind: 'started', time: '08:30' }],
      };
    case 'attachmentsNotKept':
      return {
        key: 'unknown',
        extras: [
          { kind: 'today' },
          { kind: 'later', text: LATER_TEXT, time: '08:47', attachments: 2 },
        ],
      };
    case 'sharedNumber':
      return {
        key: 'kwame',
        extras: [{ kind: 'shared', count: 2 }],
        shared: { number: SHARED_NUMBER, count: 2 },
      };
    case 'readOnly':
      return { key: 'ines', hidden: true };
    default:
      return null;
  }
}

/** Who reads the state when it isn't the owner: Ask an owner's member without billing.manage, and the built-in Read-only role. */
export function readerOf(state: string | null): string | null {
  switch (state) {
    case 'noticeAskOwner':
    case 'noticeAskSent':
    case 'noticeAskFailed':
      return 'Bisi Okafor';
    case 'readOnly':
      return 'Kofi Mensah';
    default:
      return null;
  }
}

export function noticeStart(state: string | null): Partial<Messages> {
  const notice = noticeCaseOf(state);

  if (notice == null) return {};
  const typed = notice.typed === true ? (ANSWERS[notice.key] ?? '') : '';
  const reader = readerOf(state);

  return {
    notice,
    open: { kind: 'guest', key: notice.key },
    typed: typed === '' ? {} : { [notice.key]: typed },
    ...(notice.ask == null ? {} : { balance: LOW_BALANCE }),
    ...(notice.key === 'unknown' ? { matched: 'Camille Dubois' } : {}),
    ...(notice.hidden === true ? { stopping: { ...NO_STOPS, manage: false } } : {}),
    ...(reader == null ? {} : { reader }),
  };
}

export function caseFor(m: Pick<Messages, 'notice'>, key: GuestKey): NoticeCase | null {
  return m.notice?.key === key ? m.notice : null;
}

/** A guest as the open state has them: sc-3976's states change one fact of the sample, such as the channel they wrote by. */
export function guestOf(m: Pick<Messages, 'notice'>, key: GuestKey): SampleGuest {
  const turn = caseFor(m, key)?.turn;
  const guest = GUESTS[key];

  if (turn == null) return guest;

  return {
    ...guest,
    channel: turn.channel ?? guest.channel,
    asked: { ...guest.asked, ...turn.asked },
  };
}

/** The guest's language named in the reader's own (l10n #45417). */
export function languageOf(key: GuestKey, locale = 'en'): string {
  const code = LANGUAGES[key] ?? 'en';

  return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
}

function stopWhen(locale: string): { date: string; time: string } {
  const at = new Date(TEXTED_STOP_AT);

  return {
    date: new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: READER_ZONE,
    }).format(at),
    time: writtenTime(at, locale, READER_ZONE),
  };
}

export function reasonOf(block: Block, language: string, locale = 'en-US'): string {
  switch (block) {
    case 'notAgreed':
      return W.hasNotAgreedWhatsApp;
    case 'noTemplate':
      return sayNotice.noTemplate(language);
    case 'stoppedWhatsApp':
      return W.stoppedWhatsApp;
    case 'textedStop': {
      const when = stopWhen(locale);

      return sayNotice.textedStopOn(when.date, when.time);
    }
    case 'bouncing':
      return W.addressBouncing;
    case 'spam':
      return NW.reportedSpam;
    default:
      return W.unsubscribed;
  }
}

/** The same reason in Who it reached's short form, after Not sent under the answer (pm, #45485). */
export function notSentWhy(block: Block, language: string): string {
  switch (block) {
    case 'noTemplate':
      return sayNotice.unavailableIn(language);
    case 'textedStop':
      return W.textedStop;
    default:
      return reasonOf(block, language);
  }
}

export function markOf(block: Block): MarkKey {
  return block === 'textedStop' || block === 'stoppedWhatsApp' || block === 'unsubscribed'
    ? 'optout'
    : 'notsent';
}

export interface Refusal {
  block: Block;
  reason: string;
  mark: MarkKey;
  others: readonly ChannelKey[];
}

export function refusalOf(
  by: ChannelKey,
  blocks: Partial<Record<ChannelKey, Block>>,
  others: readonly ChannelKey[],
  language: string,
  affordable: (channel: ChannelKey) => boolean = () => true,
): Refusal | null {
  const block = blocks[by];

  if (block == null) return null;

  return {
    block,
    reason: reasonOf(block, language),
    mark: markOf(block),
    others: others.filter((one) => one !== by && blocks[one] == null && affordable(one)),
  };
}

export function quietLine(by: ChannelKey, time: string): string | null {
  return by === 'email' ? null : sayNotice.waitsUntil(by === 'wa', time);
}

/** Soirely's text that the hosts have written (l10n #45754), counted with the guest's link as built; a first text to a number ends on the STOP line. */
export function noticeSmsOf(
  hosts: string,
  event: string,
  first = false,
): { text: string; chars: number; parts: number } {
  const words = say.noticeSms(hosts, event, PREVIEW.link).replaceAll('’', "'");
  const text = first ? `${words}\n${LIVE.smsStop}` : words;
  const built = text.replace(PREVIEW.link, 'x'.repeat(LINK_CHARS));

  return { text, chars: [...built].length, parts: smsParts(built) };
}

export function noticeCredits(by: ChannelKey, perPart: number, parts: number): number {
  if (by === 'email') return 0;

  return by === 'sms' ? perPart * parts : perPart;
}

const ORDER = ['2026-10-31', '2026-11-01', DAYS.parking, DAYS.today];

/** When a conversation's latest question came, comparable: Needs you is newest first. */
export function stampOf(day: string, time: string): string {
  return `${String(ORDER.indexOf(day)).padStart(2, '0')} ${time}`;
}
