import { writtenTime } from './clock.ts';
import { demoWords } from './demoWords.ts';
import { type InviteSms, LINK_CHARS, THEIR_LINK, smsParts } from './inviteSms.ts';
import type { Channel, Delivery, GuestId, SampleGuest } from './messages.ts';
import { IW } from './messagesInviteWords.ts';
import { NW } from './messagesNoticeWords.ts';
import { MW } from './messagesWords.ts';

export { NW };

const mw = demoWords(MW);
const nw = demoWords(NW);

export const NOTICE_STATES = [
  { key: 'noticeNoConsent', name: 'Refused: has not agreed to WhatsApp' },
  { key: 'noticeNoTemplate', name: 'Refused: the WhatsApp message can’t be used' },
  { key: 'noticeStoppedWhatsApp', name: 'Refused: stopped WhatsApp' },
  { key: 'noticeStopped', name: 'Refused: texted STOP' },
  { key: 'noticeBouncing', name: 'Refused: address bouncing, none left' },
  { key: 'noticeSpam', name: 'Refused: reported as spam' },
  { key: 'noticeUnsubscribed', name: 'Refused: unsubscribed' },
  { key: 'noticeWindowClosed', name: 'The 24 hours ran out while writing' },
  { key: 'noticeWindowRefused', name: 'The 24 hours ran out, then refused' },
  { key: 'noticeQuiet', name: 'Quiet hours: the notice waits' },
  { key: 'noticeAskOwner', name: 'Too few credits: Ask an owner' },
  { key: 'noticeAskSent', name: 'Too few credits: owners asked' },
  { key: 'noticeAskFailed', name: 'Too few credits: asking failed' },
  { key: 'textsBackOn', name: 'Texts back on after START' },
  { key: 'attachmentsNotKept', name: 'Attachments not kept' },
  { key: 'sharedNumber', name: 'A number two guests share' },
  { key: 'readOnly', name: 'Read-only member' },
] as const;

export type NoticeState = (typeof NOTICE_STATES)[number]['key'];

export function isNoticeState(state: string | null): state is NoticeState {
  return NOTICE_STATES.some((one) => one.key === state);
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
  | { kind: 'day'; day: string }
  | { kind: 'stopped'; channel: 'sms' | 'whatsApp'; at: string }
  | { kind: 'started'; at: string }
  | { kind: 'shared'; count: number }
  | { kind: 'later'; text: string; at: string; attachments: number };

export type Asking = 'ready' | 'sent' | 'failed';

export interface NoticeCase {
  id: GuestId | 'unknown';
  turn?: Partial<SampleGuest>;
  blocks?: Partial<Record<Channel, Block>>;
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
export const ZONE = 'Europe/London';
export const QUIET_UNTIL = '09:00';
export const SHARED_NUMBER = '+44 7700 900412';

const LANGUAGES: Partial<Record<GuestId, string>> = {
  ines: 'pt',
  lucia: 'es',
  kwame: 'en',
  valentina: 'es',
};

const KWAME_WHATSAPP: Partial<SampleGuest> = {
  where: 'whatsApp',
  day: 'Sun, Nov 1',
  row: 'Sun',
  toldBy: 'whatsApp',
  canAlso: ['email', 'sms'],
};

const LUCIA_YESTERDAY: Partial<SampleGuest> = {
  where: 'whatsApp',
  day: 'Mon, Nov 2',
  at: '09:40',
  row: 'Mon',
};

const STOPPED_TEXTS: Extra = { kind: 'stopped', channel: 'sms', at: '21:40' };

export function noticeCaseOf(state: string | null): NoticeCase | null {
  switch (state) {
    case 'noticeNoConsent':
      return {
        id: 'kwame',
        turn: KWAME_WHATSAPP,
        blocks: { whatsApp: 'notAgreed' },
        askedFirst: true,
        typed: true,
      };
    case 'noticeNoTemplate':
      return { id: 'lucia', blocks: { whatsApp: 'noTemplate' }, typed: true };
    case 'noticeStoppedWhatsApp':
      return {
        id: 'lucia',
        turn: { where: 'whatsApp' },
        blocks: { whatsApp: 'stoppedWhatsApp' },
        extras: [{ kind: 'stopped', channel: 'whatsApp', at: '08:15' }],
        typed: true,
      };
    case 'noticeStopped':
      return { id: 'kwame', blocks: { sms: 'textedStop' }, extras: [STOPPED_TEXTS], typed: true };
    case 'noticeBouncing':
      return { id: 'ines', blocks: { email: 'bouncing' }, parking: 'bounced', typed: true };
    case 'noticeSpam':
      return { id: 'ines', blocks: { email: 'spam' }, parking: 'spam', typed: true };
    case 'noticeUnsubscribed':
      return { id: 'ines', blocks: { email: 'unsubscribed' }, typed: true };
    case 'noticeWindowClosed':
      return { id: 'lucia', turn: LUCIA_YESTERDAY, windowClosed: true, typed: true };
    case 'noticeWindowRefused':
      return {
        id: 'lucia',
        turn: LUCIA_YESTERDAY,
        blocks: { whatsApp: 'noTemplate' },
        windowClosed: true,
        typed: true,
      };
    case 'noticeQuiet':
      return { id: 'valentina', quiet: QUIET_UNTIL, typed: true };
    case 'noticeAskOwner':
      return { id: 'lucia', ask: 'ready', typed: true };
    case 'noticeAskSent':
      return { id: 'lucia', ask: 'sent', typed: true };
    case 'noticeAskFailed':
      return { id: 'lucia', ask: 'failed', typed: true };
    case 'textsBackOn':
      return {
        id: 'kwame',
        extras: [STOPPED_TEXTS, { kind: 'day', day: NW.today }, { kind: 'started', at: '08:30' }],
      };
    case 'attachmentsNotKept':
      return {
        id: 'unknown',
        extras: [
          { kind: 'day', day: NW.today },
          {
            kind: 'later',
            text: 'Our train gets in at 16:10. The tickets are attached, in case the shuttle can meet it. Marc',
            at: '08:47',
            attachments: 2,
          },
        ],
      };
    case 'sharedNumber':
      return {
        id: 'kwame',
        extras: [{ kind: 'shared', count: 2 }],
        shared: { number: SHARED_NUMBER, count: 2 },
      };
    case 'readOnly':
      return { id: 'ines', hidden: true };
    default:
      return null;
  }
}

export interface Reader {
  name: string;
  initials: string;
  role: string;
}

/** Who reads the state, when it isn't the owner: Ask an owner's member without billing.manage, and the built-in Read-only role. */
export function readerOf(state: string | null): Reader | undefined {
  switch (state) {
    case 'noticeAskOwner':
    case 'noticeAskSent':
    case 'noticeAskFailed':
      return { name: 'Bisi Okafor', initials: 'BO', role: 'Admin' };
    case 'readOnly':
      return { name: 'Kofi Mensah', initials: 'KM', role: 'Read-only' };
    default:
      return undefined;
  }
}

/** The guest's language named in the reader's own (l10n #45417). */
export function languageOf(id: GuestId | 'unknown', locale = 'en'): string {
  const code = id === 'unknown' ? 'en' : (LANGUAGES[id] ?? 'en');

  return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
}

function stopWhen(locale: string): { date: string; time: string } {
  return {
    date: new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: ZONE,
    }).format(new Date(TEXTED_STOP_AT)),
    time: writtenTime(TEXTED_STOP_AT, locale, ZONE),
  };
}

export function reasonOf(block: Block, language: string, locale = 'en-US'): string {
  switch (block) {
    case 'notAgreed':
      return MW.hasNotAgreedWhatsApp;
    case 'noTemplate':
      return nw.filled(NW.noTemplate, { language });
    case 'stoppedWhatsApp':
      return MW.stoppedWhatsApp;
    case 'textedStop':
      return nw.filled(NW.textedStopOn, stopWhen(locale));
    case 'bouncing':
      return MW.addressBouncing;
    case 'spam':
      return NW.reportedSpam;
    default:
      return MW.unsubscribed;
  }
}

/** The same reason in Who it reached's short form, after Not sent under the answer (pm, #45485). */
export function notSentWhy(block: Block, language: string): string {
  switch (block) {
    case 'noTemplate':
      return nw.filled(NW.unavailableIn, { language });
    case 'textedStop':
      return MW.textedStop;
    default:
      return reasonOf(block, language);
  }
}

export function markOf(block: Block): Delivery {
  return block === 'textedStop' || block === 'stoppedWhatsApp' || block === 'unsubscribed'
    ? 'optout'
    : 'notsent';
}

export interface Refusal {
  block: Block;
  reason: string;
  mark: Delivery;
  others: readonly Channel[];
}

export function refusalOf(
  by: Channel,
  blocks: Partial<Record<Channel, Block>>,
  canAlso: readonly Channel[],
  language: string,
  affordable: (channel: Channel) => boolean = () => true,
): Refusal | null {
  const block = blocks[by];

  if (block == null) return null;

  return {
    block,
    reason: reasonOf(block, language),
    mark: markOf(block),
    others: canAlso.filter((one) => one !== by && blocks[one] == null && affordable(one)),
  };
}

export function attachmentsWords(count: number): string {
  return nw.many('attachmentsNotKept', count);
}

export function quietLine(by: Channel, time: string): string | null {
  if (by === 'email') return null;

  return nw.filled(by === 'sms' ? NW.textWaitsUntil : NW.whatsAppWaitsUntil, { time });
}

/** Soirely's text that the hosts have written (sc-3976, l10n #45754), counted with the guest's link as built; a first text to a number ends on the STOP line. */
export function noticeSmsOf(hosts: string, event: string, first = false): InviteSms {
  const words = mw.filled(MW.noticeSms, { hosts, event, link: THEIR_LINK });

  return asBuilt(first ? `${words}\n${IW.smsStop}` : words);
}

/** A text as it goes: plain punctuation, the link at its built length. */
export function asBuilt(text: string): InviteSms {
  const plain = text.replaceAll('’', "'");
  const built = plain.replace(THEIR_LINK, 'x'.repeat(LINK_CHARS));

  return { text: plain, chars: [...built].length, parts: smsParts(built) };
}

/** A paid notice's credits: an SMS costs its parts × the credits a part for the number's country. */
export function noticeCredits(by: Channel, perPart: number, parts: number): number {
  if (by === 'email') return 0;

  return by === 'sms' ? perPart * parts : perPart;
}

const DAYS = ['Sat, Oct 31', 'Sun, Nov 1', 'Mon, Nov 2', 'Today'];

export function stampOf(day: string, at: string): string {
  return `${String(DAYS.indexOf(day)).padStart(2, '0')} ${at}`;
}
