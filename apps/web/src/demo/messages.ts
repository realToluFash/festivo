import { writtenTime } from './clock.ts';
import type { SampleEvent } from './events.ts';
import { demoWords } from './demoWords.ts';
import { MESSAGES_WORD, MW } from './messagesWords.ts';
import {
  type Audience,
  type Group,
  type SentToId,
  COMING,
  NOT_REPLIED,
  SENT_TO,
  countOf,
  isSentTo,
  sentToRow,
  toLine,
  toSeedOf,
} from './messagesTo.ts';
import { type PersonId, previewDraftOf } from './messagesPreviewSample.ts';
import { EMAIL_ONLY, WAITS_STATES, waitsTicksOf } from './messagesWaits.ts';
import { type Stop, STOPPED_AT, STOP_GROUP, STOP_STATES, isStopState } from './messagesStop.ts';
import type { DemoLink } from './settings.ts';

/** Messaging B · Conversations (page e36, board/messaging-b-spec.md): the sample and the inbox's rules; the words are in messagesWords.ts. */
export { MW };

export const { filled, many, listed } = demoWords(MW);

export const MESSAGE_STATES = [
  { key: 'first', name: 'Messages, first time' },
  { key: 'loading', name: 'Loading' },
  { key: 'inUse', name: 'Messages in use' },
  { key: 'conversation', name: 'A conversation' },
  { key: 'replyArrived', name: 'A reply arriving' },
  { key: 'answered', name: 'A reply answered' },
  { key: 'channelReply', name: 'A reply that came by a channel' },
  { key: 'noticeCost', name: 'The notice’s cost before Send' },
  { key: 'noticeWaits', name: 'Too few credits: the notice waits' },
  { key: 'noticeNotSent', name: 'A notice that waited and could not go' },
  { key: 'to', name: 'Writing to many: To' },
  { key: 'write', name: 'Writing to many' },
  { key: 'preview', name: 'The preview' },
  { key: 'check', name: 'The check' },
  { key: 'countdown', name: 'Ten seconds' },
  { key: 'cancelled', name: 'Cancelled' },
  { key: 'sending', name: 'Sending' },
  { key: 'sent', name: 'Sent' },
  { key: 'failed', name: 'A failed send' },
  { key: 'reached', name: 'Who it reached' },
  { key: 'fix', name: 'A fix' },
  { key: 'resend', name: 'A resend' },
  { key: 'tell', name: 'Tell guests' },
  { key: 'untold', name: 'Not told yet' },
  { key: 'invited', name: 'Invitations sent' },
  { key: 'scheduled', name: 'Scheduled' },
  { key: 'bell', name: 'The bell' },
  { key: 'invitedReached', name: 'Who it reached, an invitation' },
  { key: 'sentReached', name: 'Who it reached, just sent' },
  { key: 'notMatched', name: 'A sender not matched' },
  { key: 'matchPicker', name: 'Who is this?' },
  { key: 'matched', name: 'Matched' },
  { key: 'later', name: 'Later…: when it goes' },
  { key: 'scheduledEdit', name: 'Editing a scheduled message' },
  { key: 'sendNow', name: 'Send now' },
  { key: 'cancelAsk', name: 'Cancel…, asked' },
  { key: 'scheduledCancelled', name: 'Cancelled, scheduled' },
  { key: 'fixed', name: 'After a fix' },
  { key: 'sentAgain', name: 'Sent again' },
  { key: 'added', name: 'After Add an email address' },
  { key: 'addedPhone', name: 'After Add a phone number' },
  { key: 'notNow', name: 'After Not now' },
  { key: 'told', name: 'Marked as told' },
  { key: 'filterMenu', name: 'The filter, open' },
  { key: 'filtered', name: 'Filtered: Bounced' },
  { key: 'resendInvited', name: 'A resend, an invitation' },
  { key: 'resendSent', name: 'A resend, just sent' },
  { key: 'checkAll', name: 'The check, All guests' },
  { key: 'checkNotReplied', name: 'The check, Not replied' },
  { key: 'checkChannels', name: 'The check, SMS off' },
  { key: 'noSubject', name: 'No subject' },
  { key: 'followUp', name: 'A follow-up' },
  { key: 'tellPlace', name: 'Tell guests, a new place' },
  { key: 'closedDraft', name: 'New unavailable, a draft' },
  { key: 'closedEnded', name: 'New unavailable, finished over 30 days ago' },
  { key: 'whoAdded', name: 'A quick pick, then a condition' },
  { key: 'whoNone', name: 'Guests who…, no condition' },
  { key: 'whoNoneSend', name: 'Send with no condition' },
  { key: 'whoMany', name: 'Several conditions' },
  { key: 'whoGroup', name: 'Is in group: which group?' },
  { key: 'whoCounting', name: 'The count refreshing' },
  { key: 'seeWho', name: 'See who' },
  { key: 'whoNobody', name: 'Nobody matches' },
  { key: 'whoRenamed', name: 'A renamed group' },
  { key: 'whoDeleted', name: 'A deleted group' },
  { key: 'saveName', name: 'Save this audience' },
  { key: 'saveBlank', name: 'A blank name' },
  { key: 'saveLong', name: 'A name over 60' },
  { key: 'saveTaken', name: 'A used name' },
  { key: 'saveFull', name: 'The 21st' },
  { key: 'saved', name: 'Saved' },
  { key: 'savedChanged', name: 'A saved audience, changed' },
  { key: 'audienceMenu', name: 'More actions' },
  { key: 'rename', name: 'Rename' },
  { key: 'renamed', name: 'Renamed, accents only' },
  { key: 'deleteAsk', name: 'Delete…, asked' },
  { key: 'deletedPicked', name: 'Deleted, the picked one' },
  { key: 'noManage', name: 'Without messages.manage' },
  { key: 'resolvedRow', name: 'Sent to conditions' },
  { key: 'nobodyDue', name: 'Nobody matched when it was due' },
  { key: 'insert', name: 'Insert' },
  { key: 'previewAs', name: 'Preview as' },
  { key: 'previewGreetAs', name: 'Previewed as Bisi Adewale' },
  { key: 'previewChose', name: 'Previewed as Camille Dubois' },
  { key: 'previewLoading', name: 'Filling it in' },
  { key: 'previewMarkup', name: 'A Greet as with markup' },
  { key: 'typedBraces', name: 'A typed {Greeting}' },
  { key: 'previewBraces', name: 'Typed braces, previewed' },
  { key: 'noTokens', name: 'Nothing to fill in' },
  { key: 'previewNobody', name: 'Nobody to preview' },
  { key: 'editConflict', name: 'Not saved: Bisi Okafor changed it' },
  { key: 'editSent', name: 'Not saved: already sent' },
  { key: 'editCancelled', name: 'Not saved: cancelled' },
  { key: 'editTooLate', name: 'Not saved: too late to send' },
  { key: 'whatsAppLine', name: 'WhatsApp ticked: who it reaches' },
  { key: 'checkWhatsApp', name: 'The check, with WhatsApp' },
  { key: 'whatsAppRead', name: 'WhatsApp’s receipts' },
  ...WAITS_STATES,
  ...STOP_STATES,
] as const;

export type MessagesState = (typeof MESSAGE_STATES)[number]['key'];

/** Why nothing can be sent on an event that can't send (sc-3942, Decided 8 Nov), one sentence per reason, the app's too. */
export function closedOf(state: MessagesState | null): string | null {
  switch (state) {
    case 'closedDraft':
      return MW.closedDraft;
    case 'closedEnded':
      return MW.closedEnded;
    default:
      return null;
  }
}

export function messagesStateOf(raw: string | null): MessagesState | null {
  return MESSAGE_STATES.find((one) => one.key === raw)?.key ?? null;
}

export const SAMPLE_EVENT = 'evt-wed-4';
export const MESSAGES_AT = `/demo/events/${SAMPLE_EVENT}/messages`;

export const MESSAGES_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Messages',
    states: MESSAGE_STATES.filter((one) => !isStopState(one.key)).map((one) => ({
      to: `${MESSAGES_AT}?state=${one.key}`,
      name: one.name,
    })),
  },
  {
    name: STOP_GROUP,
    states: STOP_STATES.map((one) => ({ to: `${MESSAGES_AT}?state=${one.key}`, name: one.name })),
  },
];

export const READER = 'Folake Adeyemi';
export const NOW = '09:41';
export const HOSTS = 'Adaeze Obi and Tunde Bakare';
export const EVENT_NAME = 'Adaeze & Tunde’s wedding';
export const ORGANISATION = 'Ire Events';
export const GUESTS_N = 142;
export const BALANCE = 1500;
export const THEIR_LINK = '[their own link]';
export const PAGE_WHEN = `Thu, Nov 5 · ${writtenTime('18:00', 'en')} · The Landmark`;
export const ZONE = 'London time (GMT)';
export const ZONE_SHORT = 'London time';
export const ENDS = { date: 'Sat, Nov 7', time: '15:00', at: '2026-11-07T15:00:00Z' };
export const CLOCK = '2026-11-03T09:41:00Z';

export type Channel = 'email' | 'sms' | 'whatsApp';
export type Where = 'page' | Channel;
export type GuestId = 'ines' | 'lucia' | 'kwame' | 'marta';
export type ConvoId =
  | GuestId
  | 'unknown'
  | 'parking'
  | 'invite'
  | 'receipts'
  | SentToId
  | `sched${string}`
  | `new${string}`;

export interface SampleGuest {
  initials: string;
  name: string;
  contact: string;
  asked: string;
  where: Where;
  day: string;
  at: string;
  row: string;
  toldBy: Channel;
  /** The guest's other channels that can carry Soirely's notice when theirs can't now. */
  canAlso: readonly Channel[];
}

export const GUESTS: Record<GuestId, SampleGuest> = {
  ines: {
    initials: 'ID',
    name: 'Inês Duarte',
    contact: 'ines.duarte@sapo.pt',
    asked: 'Can we bring our son? Our sitter cancelled for Thursday.',
    where: 'page',
    day: 'Today',
    at: '08:12',
    row: '08:12',
    toldBy: 'email',
    canAlso: [],
  },
  lucia: {
    initials: 'LO',
    name: 'Lucía Ortega',
    contact: '+34 612 345 678 · lucia.ortega@gmail.com',
    asked: 'Is there parking at The Landmark?',
    where: 'page',
    day: 'Today',
    at: '07:58',
    row: '07:58',
    toldBy: 'whatsApp',
    canAlso: ['email', 'sms'],
  },
  kwame: {
    initials: 'KM',
    name: 'Kwame Mensah',
    contact: '+44 7700 900412 · kwame.mensah@outlook.com',
    asked: 'What is the dress code?',
    where: 'sms',
    day: 'Mon, Nov 2',
    at: '21:14',
    row: 'Mon',
    toldBy: 'sms',
    canAlso: ['email'],
  },
  marta: {
    initials: 'MS',
    name: 'Marta Silva',
    contact: 'marta.silva@gmail.com',
    asked: 'Thank you, see you Thursday!',
    where: 'page',
    day: 'Sat, Oct 31',
    at: '11:05',
    row: 'Sat',
    toldBy: 'email',
    canAlso: [],
  },
};

export const UNKNOWN = {
  address: 'm.dubois@orange.fr',
  text: 'Camille and I will both be there. Marc',
  day: 'Mon, Nov 2',
  at: '21:05',
  row: 'Mon',
} as const;

export const MATCHES: readonly { name: string; initials: string; line: string }[] = [
  { name: 'Camille Dubois', initials: 'CD', line: 'camille.dubois@orange.fr' },
  { name: 'Claude Dubois', initials: 'CD', line: MW.noEmail },
  { name: 'Duboise Akande', initials: 'DA', line: '+234 802 555 0199' },
];

export const ANSWERS: Partial<Record<GuestId, string>> = {
  ines: 'Of course. We will set a place for your son at your table.',
  kwame: 'Formal: suits and long dresses are welcome.',
  lucia: 'Yes: free parking under the hotel, entrance on Calle Mayor.',
};

/** What Soirely's notice costs per guest's number (sc-3928's utility credits for their number's country, one SMS part; the app's `NOTICE_CREDITS`), as sc-3929's preview would give it. */
const NOTICE_PRICE: Record<GuestId | 'unknown', Partial<Record<Channel, number>>> = {
  ines: {},
  lucia: { whatsApp: 4, sms: 14 },
  kwame: { sms: 9 },
  marta: {},
  unknown: {},
};

/** `noticeNotSent`, as the app's `HELD_TOO_LONG`: Lucía's earlier question, and the answer whose WhatsApp notice waited 48 hours and could not go. */
export const HELD_TOO_LONG = {
  day: 'Sun, Nov 1',
  asked: 'Is there a vegetarian menu?',
  askedAt: '08:02',
  answer: 'Yes. Tell us on your page and the kitchen will plan for it.',
  answeredAt: '08:30',
};

export function noticePrice(id: GuestId | 'unknown', by: Channel): number {
  return by === 'email' ? 0 : (NOTICE_PRICE[id][by] ?? 0);
}

export interface Notice {
  credits: number;
  cost: string | null;
  waits: string | null;
  others: readonly Channel[];
}

/** The composer's line before Send (sc-3976, sc-3931): the cost and the credits after, or the wait line and the channels that can tell them now. */
export function noticeOf(
  id: GuestId | 'unknown',
  by: Channel,
  balance: number,
  canAlso: readonly Channel[],
): Notice {
  const credits = noticePrice(id, by);

  if (credits === 0) return { credits, cost: null, waits: null, others: [] };
  if (credits > balance)
    return {
      credits,
      cost: null,
      waits: many(by === 'sms' ? 'smsWaits' : 'whatsAppWaits', 1),
      others: canAlso.filter((one) => one !== by && noticePrice(id, one) <= balance),
    };

  const uses = many(by === 'sms' ? 'noticeTextUses' : 'noticeWhatsAppUses', credits);

  return {
    credits,
    cost: `${uses} ${filled(MW.creditsAfter, { count: balance - credits })}`,
    waits: null,
    others: [],
  };
}

export type Token = 'greeting' | 'event' | 'date' | 'hosts';
export type Segment = { kind: 'text'; text: string } | { kind: 'token'; token: Token };

export const TOKENS: readonly Token[] = ['greeting', 'event', 'date', 'hosts'];

export function tokenWord(token: Token): string {
  switch (token) {
    case 'greeting':
      return MW.greeting;
    case 'event':
      return MW.tokenEvent;
    case 'date':
      return MW.tokenDate;
    default:
      return MW.tokenHosts;
  }
}

const greeted = (text: string): readonly Segment[] => [
  { kind: 'token', token: 'greeting' },
  { kind: 'text', text },
];

export const PARKING = {
  subject: 'Parking at The Landmark',
  body: greeted(', parking is on Marylebone Road. The car park entrance is on Melcombe Place.'),
  day: 'Mon, Nov 2',
  at: '18:20',
  row: 'Mon',
} as const;

export const INVITE = {
  day: 'Mon, Oct 12',
  row: 'Oct 12',
  date: 'Thursday, Nov 5',
  by: 'Friday, Oct 30',
};

export const NEW_MESSAGE = {
  subject: 'Parking and the dress code',
  body: greeted(
    ', a few things before Thursday. Parking is on Marylebone Road, and the dress code is formal. If anything changes for you, answer here.',
  ),
} as const;

export const FOLLOW_UP = 'Also: the car park closes at 23:30, so plan your way home.';

export function fill(body: readonly Segment[], greeting: string): string {
  return body
    .map((part) => {
      if (part.kind === 'text') return part.text;
      switch (part.token) {
        case 'greeting':
          return greeting;
        case 'event':
          return EVENT_NAME;
        case 'date':
          return INVITE.date;
        default:
          return HOSTS;
      }
    })
    .join('');
}

export function plainOf(body: readonly Segment[]): string {
  return body.map((part) => (part.kind === 'text' ? part.text : tokenWord(part.token))).join('');
}

export function blank(body: readonly Segment[]): boolean {
  return body.every((part) => part.kind === 'text' && part.text.trim() === '');
}

export {
  type Audience,
  type Condition,
  CONDITIONS,
  COMING,
  NOT_REPLIED,
  audienceWords,
  chipWords,
  conditionWord,
  countOf,
  refusalOf,
  toLine,
} from './messagesTo.ts';

export interface Untellable {
  name: string;
  why: readonly string[];
}

const TOMAS: Untellable = { name: 'Tomás Ferreira', why: [MW.addressBouncing, MW.noPhone] };
const JOAQUIN: Untellable = { name: 'Joaquín Ruiz', why: [MW.noEmail, MW.noPhone] };
const SOPHIE: Untellable = { name: 'Sophie Laurent', why: [MW.unsubscribed, MW.textedStop] };
const MEI: Untellable = { name: 'Mei Lin Chen', why: [MW.noEmail, MW.noPhone] };
const SMS_ONLY: readonly Untellable[] = [
  { name: 'Amaka Eze', why: [MW.noEmail, MW.smsIsOff] },
  { name: 'Priyanka Nair', why: [MW.noEmail, MW.smsIsOff] },
];

export type Ticks = Record<Channel, boolean>;

type Sample = 'all' | 'coming' | 'notReplied';

/** Which of the boards' three samples an audience counts as: All guests, Hasn't replied alone, or Coming (every other). */
function sampleOf(audience: Audience): Sample {
  if (audience.kind === 'all') return 'all';

  return audience.conditions[0] === 'notReplied' && audience.conditions.length === 1
    ? 'notReplied'
    : 'coming';
}

/** sc-3928's utility credits for one WhatsApp message, by the number's calling code. */
const UTILITY_CREDITS: readonly { code: string; country: string; credits: number }[] = [
  { code: '+234', country: 'Nigeria', credits: 2 },
  { code: '+55', country: 'Brazil', credits: 2 },
  { code: '+52', country: 'Mexico', credits: 2 },
  { code: '+44', country: 'United Kingdom', credits: 5 },
  { code: '+33', country: 'France', credits: 5 },
  { code: '+34', country: 'Spain', credits: 4 },
  { code: '+49', country: 'Germany', credits: 9 },
];

export function whatsAppCredits(number: string): number {
  return UTILITY_CREDITS.find((one) => number.startsWith(`${one.code} `))?.credits ?? 0;
}

export const WHATSAPP_NUMBERS: Readonly<Record<string, string>> = {
  lucia: '+34 612 345 678',
  kwame: '+44 7700 900412',
  duboise: '+234 802 555 0199',
  rafael: '+55 21 99555 0142',
};

interface WhatsAppSample {
  reaches: readonly string[];
  noMobile: number;
  stopped: number;
  notAgreed: number;
}

/** WhatsApp per audience (sc-3950 spec §4): the guests it reaches, then each guest it can't, counted once. */
const WHATSAPP: Record<Sample, WhatsAppSample> = {
  all: {
    reaches: ['lucia', 'kwame', 'duboise', 'rafael'],
    noMobile: 102,
    stopped: 2,
    notAgreed: 34,
  },
  coming: { reaches: ['lucia', 'kwame', 'rafael'], noMobile: 65, stopped: 1, notAgreed: 27 },
  notReplied: { reaches: ['duboise'], noMobile: 16, stopped: 0, notAgreed: 8 },
};

export function whatsAppCreditsFor(ids: readonly string[]): number {
  return ids.reduce((sum, id) => sum + whatsAppCredits(WHATSAPP_NUMBERS[id] ?? ''), 0);
}

export interface WhatsAppReach {
  reaches: number;
  of: number;
  noMobile: number;
  stopped: number;
  notAgreed: number;
  credits: number;
}

export function whatsAppOf(audience: Audience): WhatsAppReach {
  const { reaches, noMobile, stopped, notAgreed } = WHATSAPP[sampleOf(audience)];

  return {
    reaches: reaches.length,
    of: reaches.length + noMobile + stopped + notAgreed,
    noMobile,
    stopped,
    notAgreed,
    credits: whatsAppCreditsFor(reaches),
  };
}

export function whatsAppLine(audience: Audience): string {
  const reach = whatsAppOf(audience);

  const cant = [
    ...(reach.noMobile > 0 ? [many('noMobile', reach.noMobile)] : []),
    ...(reach.stopped > 0 ? [many('stoppedCount', reach.stopped)] : []),
    ...(reach.notAgreed > 0 ? [many('notAgreedWhatsApp', reach.notAgreed)] : []),
  ];

  return [
    filled(MW.whatsAppReaches, { count: reach.reaches, total: reach.of }),
    ...(cant.length > 0 ? [listed(cant)] : []),
  ].join(' · ');
}

/** Each audience's notices per channel and who no ticked channel reaches: the boards' sample (Web-1 and Web-4). */
export function figuresOf(
  audience: Audience,
  ticks: Ticks = TICKS,
): {
  counts: Record<Channel, number>;
  cantTell: number;
  names: readonly Untellable[];
  smsOff: number;
} {
  const sample = sampleOf(audience);
  const base =
    sample === 'all'
      ? { counts: { email: 124, sms: 39, whatsApp: 4 }, cantTell: 9, names: [TOMAS, SOPHIE] }
      : sample === 'notReplied'
        ? { counts: { email: 23, sms: 9, whatsApp: 1 }, cantTell: 1, names: [MEI] }
        : { counts: { email: 92, sms: 31, whatsApp: 3 }, cantTell: 2, names: [TOMAS, JOAQUIN] };
  const notReplied = audience.kind === 'who' && audience.conditions[0] === 'notReplied';
  const smsOff = !ticks.sms && ticks.email && !notReplied ? SMS_ONLY.length : 0;
  const { sms, whatsApp } = base.counts;
  const counts =
    ticks.sms && ticks.whatsApp ? { ...base.counts, sms: sms - whatsApp } : base.counts;

  if (smsOff === 0) return { ...base, counts, smsOff: 0 };

  return { ...base, counts, cantTell: base.cantTell + smsOff, names: SMS_ONLY, smsOff };
}

export const CHANNELS: readonly Channel[] = ['email', 'sms', 'whatsApp'];

export function channelWord(channel: Channel): string {
  return channel === 'email' ? MW.email : channel === 'sms' ? MW.sms : MW.whatsApp;
}

export interface Check {
  count: number;
  pills: readonly { channel: Channel; count: number }[];
  told: string | null;
  smsOff: string | null;
  cantTell: number;
  cant: readonly Untellable[];
  credits: string | null;
  whatsApp: string | null;
}

/** The check before it goes (sc-3942, sc-3963): who is told and how, who cannot be, and the credits. */
export function checkOf(audience: Audience, ticks: Ticks, groups: readonly Group[]): Check {
  const count = countOf(audience, groups) ?? 0;
  const { counts, cantTell, names, smsOff } = figuresOf(audience, ticks);
  const on = CHANNELS.filter((channel) => ticks[channel]);
  const credits =
    (ticks.sms ? counts.sms : 0) + (ticks.whatsApp ? whatsAppOf(audience).credits : 0);
  const by = on.map((channel) =>
    channel === 'email' ? MW.byEmail : channel === 'sms' ? MW.bySms : MW.byWhatsApp,
  );
  const after = filled(MW.creditsAfter, { count: BALANCE - credits });

  return {
    count,
    pills: on.map((channel) => ({ channel, count: counts[channel] })),
    told: on.length === 0 ? null : filled(MW.toldThere, { channels: listed(by) }),
    smsOff: smsOff > 0 ? many('smsOff', smsOff) : null,
    cantTell: on.length === 0 ? 0 : cantTell,
    cant: on.length === 0 ? [] : names.slice(0, Math.min(2, cantTell)),
    credits:
      on.length === 0
        ? null
        : credits === 0
          ? MW.emailNoCredits
          : `${ticks.whatsApp ? many('textsAndWhatsAppUse', credits) : many('textsUse', credits)} ${after}`,
    whatsApp: ticks.whatsApp ? whatsAppLine(audience) : null,
  };
}

export function toldWords(ticks: Ticks): string {
  const on = CHANNELS.filter((channel) => ticks[channel]).map(channelWord);

  return [
    MW.onTheirPageLower,
    ...(on.length > 0 ? [filled(MW.toldByChannels, { channels: listed(on) })] : []),
  ].join(' · ');
}

export type Delivery =
  | 'delivered'
  | 'sent'
  | 'sending'
  | 'held'
  | 'bounced'
  | 'notsent'
  | 'unconfirmed'
  | 'optout'
  | 'none';
export type Kind =
  'inProgress' | 'bounced' | 'notSent' | 'notConfirmed' | 'optedOut' | 'none' | 'cant';
export type AddressFix = 'fixEmail' | 'addEmail' | 'addPhone';
export type Fix = AddressFix | 'toldInPerson' | 'copyLink';

export interface Line {
  mark: Delivery;
  word: string;
  why?: string;
}

export interface Unreached {
  id: string;
  initials: string;
  name: string;
  kind: Kind;
  lines: readonly Line[];
  fixes: readonly Fix[];
  address?: string;
  updated?: readonly string[];
  offer?: boolean;
}

/** An address saved in Who it reached, the guest's own, so every message sees it; Send again and Not now are per message. */
export interface Update {
  fix: AddressFix;
  address: string;
  sentOn: readonly ConvoId[];
  laterOn: readonly ConvoId[];
}

interface Saved {
  fix: AddressFix;
  address: string;
  sent: boolean;
  later: boolean;
}

function savedOn(inbox: Inbox, id: string, thread: ConvoId): readonly Saved[] {
  return (inbox.updates[id] ?? []).map(({ sentOn, laterOn, ...one }) => ({
    ...one,
    sent: sentOn.includes(thread),
    later: laterOn.includes(thread),
  }));
}

const PAGE_LINE: Line = { mark: 'none', word: MW.theirPage, why: MW.notSeenYet };
const NO_PHONE: Line = { mark: 'none', word: MW.sms, why: MW.noPhone };
const NO_EMAIL: Line = { mark: 'none', word: MW.email, why: MW.noEmail };
const NOTHING: readonly Line[] = [
  { mark: 'none', word: MW.noEmail },
  { mark: 'none', word: MW.noPhone },
];

function person(
  id: string,
  name: string,
  kind: Kind,
  lines: readonly Line[],
  fixes: readonly Fix[],
  last: Line = PAGE_LINE,
): Unreached {
  const initials = name
    .split(' ')
    .filter((_, index, all) => index === 0 || index === all.length - 1)
    .map((part) => part[0] ?? '')
    .join('');

  return { id, initials, name, kind, lines: [...lines, last], fixes };
}

const bounced = (why: string): Line => ({
  mark: 'bounced',
  word: `${MW.email} · ${MW.bounced}`,
  why,
});
const unconfirmed: Line = {
  mark: 'unconfirmed',
  word: `${MW.sms} · ${MW.sent}`,
  why: MW.notConfirmed,
};
const optedOut = (channel: 'email' | 'sms'): Line => ({
  mark: 'optout',
  word: `${channel === 'email' ? MW.email : MW.sms} · ${MW.notSent}`,
  why: channel === 'email' ? MW.unsubscribed : MW.textedStop,
});

export const OLD_ADDRESS = 'tomas.ferreira@gmial.com';
export const NEW_ADDRESS = 'tomas.ferreira@gmail.com';
export const SENT_AGAIN_AT = '09:44';

/** Parking at The Landmark's eleven, grouped as sc-3966 counts them (Web-2, rebuilt). */
export const PARKING_UNREACHED: readonly Unreached[] = [
  {
    ...person(
      'tomas',
      'Tomás Ferreira',
      'bounced',
      [bounced(`${MW.doesntExist} (5.1.1)`), NO_PHONE],
      ['fixEmail', 'addPhone', 'toldInPerson'],
    ),
    address: OLD_ADDRESS,
  },
  {
    ...person(
      'yuki',
      'Yuki Tanaka',
      'bounced',
      [bounced(`${MW.inboxFull} (4.2.2)`), NO_PHONE],
      ['fixEmail', 'addPhone', 'toldInPerson'],
    ),
    address: 'yuki.tanaka@icloud.com',
  },
  {
    ...person(
      'seun',
      'Oluwaseun Adebayo',
      'bounced',
      [bounced(`${MW.refusedIt} (5.7.1)`), NO_PHONE],
      ['fixEmail', 'addPhone', 'toldInPerson'],
    ),
    address: 'seun.adebayo@yahoo.com',
  },
  person('amaka', 'Amaka Eze', 'notConfirmed', [unconfirmed, NO_EMAIL], ['toldInPerson']),
  person('priyanka', 'Priyanka Nair', 'notConfirmed', [unconfirmed, NO_EMAIL], ['toldInPerson']),
  person(
    'sophie',
    'Sophie Laurent',
    'optedOut',
    [optedOut('email'), optedOut('sms')],
    ['toldInPerson'],
  ),
  person(
    'lars',
    'Lars Johansson',
    'optedOut',
    [optedOut('email'), NO_PHONE],
    ['addPhone', 'toldInPerson'],
  ),
  person(
    'fatima',
    'Fatima Zahra El Idrissi',
    'optedOut',
    [optedOut('sms'), NO_EMAIL],
    ['addEmail', 'toldInPerson'],
  ),
  person(
    'diego',
    'Diego Herrera',
    'optedOut',
    [optedOut('email'), optedOut('sms')],
    ['toldInPerson'],
  ),
  person('joaquin', 'Joaquín Ruiz', 'none', NOTHING, ['addEmail', 'addPhone', 'toldInPerson']),
  person('mei', 'Mei Lin Chen', 'none', NOTHING, ['addEmail', 'addPhone', 'toldInPerson']),
];

const NOT_INVITED: Line = { mark: 'none', word: MW.theirInvitation, why: MW.notYetInvited };

export const INVITE_UNREACHED: readonly Unreached[] = [
  person(
    'joaquin',
    'Joaquín Ruiz',
    'none',
    NOTHING,
    ['addEmail', 'addPhone', 'copyLink'],
    NOT_INVITED,
  ),
  person('mei', 'Mei Lin Chen', 'none', NOTHING, ['addEmail', 'addPhone', 'copyLink'], NOT_INVITED),
];

/** Who a message just sent reached so far (sentReached): two in progress drawn, the rest counted. */
export const SO_FAR = {
  reached: 38,
  inProgress: 56,
  more: 54,
  progress: [
    person(
      'kwame',
      'Kwame Mensah',
      'inProgress',
      [
        { mark: 'sending', word: MW.email, why: MW.sending },
        { mark: 'sent', word: `${MW.sms} · ${MW.sent}`, why: NOW },
      ],
      ['toldInPerson'],
    ),
    person(
      'marta',
      'Marta Silva',
      'inProgress',
      [{ mark: 'sent', word: `${MW.email} · ${MW.sent}`, why: NOW }],
      ['toldInPerson'],
    ),
  ],
  done: [
    person(
      'ines',
      'Inês Duarte',
      'none',
      [{ mark: 'delivered', word: `${MW.email} · ${MW.delivered}`, why: NOW }],
      [],
      {
        mark: 'delivered',
        word: MW.theirPage,
        why: filled(MW.seen, { time: '09:42' }),
      },
    ),
  ],
  cant: [
    {
      ...person(
        'tomas',
        'Tomás Ferreira',
        'notSent',
        [
          { mark: 'notsent', word: `${MW.email} · ${MW.notSent}`, why: MW.addressBouncing },
          NO_PHONE,
        ],
        ['fixEmail', 'addPhone', 'toldInPerson'],
      ),
      address: OLD_ADDRESS,
    },
    person('joaquin', 'Joaquín Ruiz', 'none', NOTHING, ['addEmail', 'addPhone', 'toldInPerson']),
  ],
};

export const PARKING_REACHED: readonly Unreached[] = [
  person(
    'ines',
    'Inês Duarte',
    'none',
    [{ mark: 'delivered', word: `${MW.email} · ${MW.delivered}`, why: '09:12' }],
    [],
    { mark: 'delivered', word: MW.theirPage, why: filled(MW.seen, { time: '09:20' }) },
  ),
  person(
    'kwame',
    'Kwame Mensah',
    'none',
    [{ mark: 'delivered', word: `${MW.sms} · ${MW.delivered}`, why: '09:13' }],
    [],
  ),
];

export const INVITE_REACHED: readonly Unreached[] = [
  person(
    'ines',
    'Inês Duarte',
    'none',
    [{ mark: 'delivered', word: `${MW.email} · ${MW.delivered}`, why: '10:02' }],
    [],
    { mark: 'delivered', word: MW.theirInvitation, why: filled(MW.seen, { time: '10:15' }) },
  ),
  person(
    'kwame',
    'Kwame Mensah',
    'none',
    [{ mark: 'delivered', word: `${MW.sms} · ${MW.delivered}`, why: '10:03' }],
    [],
    { mark: 'none', word: MW.theirInvitation, why: MW.notSeenYet },
  ),
];

export function fixWord(fix: Fix): string {
  switch (fix) {
    case 'fixEmail':
      return MW.fixEmail;
    case 'addEmail':
      return MW.addEmail;
    case 'addPhone':
      return MW.addPhone;
    case 'copyLink':
      return MW.copyLink;
    default:
      return MW.toldInPerson;
  }
}

export interface Reach {
  reached: number;
  of: number;
  seen: number;
  parts: readonly { kind: 'reached' | Kind; count: number }[];
}

export const KIND_ORDER: readonly Kind[] = [
  'inProgress',
  'bounced',
  'notSent',
  'notConfirmed',
  'optedOut',
  'none',
  'cant',
];

export function reachFrom(of: number, seen: number, unreached: readonly Unreached[]): Reach {
  const parts = KIND_ORDER.map((kind) => ({
    kind,
    count: unreached.filter((one) => one.kind === kind).length,
  })).filter((part) => part.count > 0);

  return {
    reached: of - unreached.length,
    of,
    seen,
    parts: [{ kind: 'reached', count: of - unreached.length }, ...parts],
  };
}

export function legendWord(kind: 'reached' | Kind): string {
  switch (kind) {
    case 'reached':
      return MW.legendReached;
    case 'inProgress':
      return MW.legendInProgress;
    case 'bounced':
      return MW.legendBounced;
    case 'notConfirmed':
      return MW.legendNotConfirmed;
    case 'optedOut':
      return MW.legendOptedOut;
    case 'notSent':
      return MW.legendNotSent;
    case 'cant':
      return MW.legendCantBeTold;
    default:
      return MW.legendNoEmailOrPhone;
  }
}

export function reachLine(
  reach: Reach,
  lead: string = filled(MW.seenByStart, { count: reach.seen }),
): string {
  const counted = reach.parts.flatMap((part) => {
    switch (part.kind) {
      case 'inProgress':
        return [many('inProgressCount', part.count)];
      case 'bounced':
        return [many('bouncedCount', part.count)];
      case 'notSent':
        return [many('notSentCount', part.count)];
      case 'notConfirmed':
        return [many('notConfirmedCount', part.count)];
      case 'optedOut':
        return [many('optedOutCount', part.count)];
      case 'none':
        return [many('noEmailOrPhoneCount', part.count)];
      case 'cant':
        return [many('cantBeToldCount', part.count)];
      default:
        return [];
    }
  });

  return [lead, ...counted].join(' · ');
}

export const PARKING_OF = GUESTS_N;
export const PARKING_SEEN = 87;
export const INVITE_REACH = { reached: 140, of: GUESTS_N, seen: 121 };

export function reachedOfThread(thread: ConvoId): ReachedOf {
  return thread === 'parking' || thread === 'invite' || thread === 'receipts' ? thread : 'new';
}

export function phoneProblem(value: string): string | null {
  const typed = value.trim();

  return typed.startsWith('+') && typed.replaceAll(/\D/gu, '').length >= 7 ? null : MW.phoneShape;
}

const UPDATED_WORDS: Record<AddressFix, string> = {
  fixEmail: MW.emailChangedSince,
  addEmail: MW.emailAddedSince,
  addPhone: MW.phoneAddedSince,
};

function sentOver(lines: readonly Line[], update: Saved): readonly Line[] {
  const phone = update.fix === 'addPhone';
  const channel = phone ? MW.sms : MW.email;
  const sent: Line = {
    mark: 'sent',
    word: `${channel} · ${MW.sent} · ${SENT_AGAIN_AT}`,
    why: update.address,
  };
  const at = lines.findIndex(
    (line) => line.word.startsWith(channel) || line.word === (phone ? MW.noPhone : MW.noEmail),
  );

  return at < 0 ? [sent, ...lines] : lines.map((line, index) => (index === at ? sent : line));
}

/** A person as their saved addresses leave them: each channel's line kept until it is sent again, then In progress. */
export function updatedPerson(person: Unreached, updates: readonly Saved[]): Unreached {
  if (updates.length === 0) return person;
  if (updates.every((one) => one.sent))
    return {
      ...person,
      kind: 'inProgress',
      lines: updates.reduce(sentOver, person.lines),
      fixes: ['toldInPerson'],
    };

  const used = updates.map((one) => one.fix);
  const offer = updates.some((one) => !one.later);

  return {
    ...person,
    fixes: offer ? [] : person.fixes.filter((fix) => !(used as readonly Fix[]).includes(fix)),
    updated: updates.map((one) => UPDATED_WORDS[one.fix]),
    offer,
  };
}

/** Parking's shape told by email and WhatsApp (sc-3950 spec §3's sample), for WhatsApp's receipts. */
export const RECEIPTS = {
  ticks: { email: true, sms: false, whatsApp: true } as Ticks,
  reached: 124,
  cant: 18,
  emailAt: '18:21',
};

/** Boards v515: nothing held, so WhatsApp went with the email, 18:20 to 18:24. */
const RECEIPT: Record<string, Line> = {
  lucia: { mark: 'sent', word: `${MW.whatsApp} · ${MW.sent}`, why: '18:20' },
  duboise: { mark: 'delivered', word: `${MW.whatsApp} · ${MW.delivered}`, why: '18:21' },
  kwame: { mark: 'delivered', word: `${MW.whatsApp} · ${MW.read}`, why: '18:24' },
  rafael: { mark: 'bounced', word: `${MW.whatsApp} · ${MW.failedReceipt}` },
};

const RECEIPTS_FOR: readonly (readonly [string, string])[] = [
  ['lucia', 'Lucía Ortega'],
  ['duboise', 'Duboise Akande'],
  ['kwame', 'Kwame Mensah'],
  ['rafael', 'Rafael Costa'],
];

export function receiptPeople(): readonly Unreached[] {
  return RECEIPTS_FOR.map(([id, name]) =>
    person(
      id,
      name,
      'none',
      [
        { mark: 'delivered', word: `${MW.email} · ${MW.delivered}`, why: RECEIPTS.emailAt },
        RECEIPT[id] ?? { mark: 'sent', word: `${MW.whatsApp} · ${MW.sent}` },
      ],
      [],
    ),
  );
}

/** Not reached on any channel, each with WhatsApp's reason (`opted_out`, `no_whatsapp_consent`). */
export const RECEIPTS_UNREACHED: readonly Unreached[] = [
  person(
    'amaka',
    'Amaka Eze',
    'cant',
    [
      NO_EMAIL,
      { mark: 'notsent', word: `${MW.whatsApp} · ${MW.notSent}`, why: MW.hasNotAgreedWhatsApp },
    ],
    [],
  ),
  person(
    'sophie',
    'Sophie Laurent',
    'cant',
    [
      optedOut('email'),
      { mark: 'optout', word: `${MW.whatsApp} · ${MW.notSent}`, why: MW.stoppedWhatsApp },
    ],
    [],
  ),
];

export const RECEIPTS_REACH: Reach = {
  reached: RECEIPTS.reached,
  of: GUESTS_N,
  seen: PARKING_SEEN,
  parts: [
    { kind: 'reached', count: RECEIPTS.reached },
    { kind: 'cant', count: RECEIPTS.cant },
  ],
};

const RECEIPTS_REACHED: readonly Unreached[] = [
  person(
    'ines',
    'Inês Duarte',
    'none',
    [{ mark: 'delivered', word: `${MW.email} · ${MW.delivered}`, why: RECEIPTS.emailAt }],
    [],
    { mark: 'delivered', word: MW.theirPage, why: filled(MW.seen, { time: '09:20' }) },
  ),
];

/** The receipts' Who it reached (boards v509): its WhatsApp four as their own group, never a filter, then Can't be told and Reached. */
function receiptsWho(): Who {
  const four = receiptPeople();

  return {
    reach: RECEIPTS_REACH,
    line: reachLine(RECEIPTS_REACH),
    groups: [
      { key: 'whatsApp', name: MW.whatsApp, people: four, count: four.length, more: 0 },
      {
        key: 'cant',
        name: MW.legendCantBeTold,
        people: RECEIPTS_UNREACHED,
        count: RECEIPTS.cant,
        more: RECEIPTS.cant - RECEIPTS_UNREACHED.length,
      },
      { key: 'told', name: MW.markedAsTold, people: [], count: 0, more: 0 },
      {
        key: 'reached',
        name: MW.legendReached,
        people: RECEIPTS_REACHED,
        count: RECEIPTS.reached,
        more: RECEIPTS.reached - RECEIPTS_REACHED.length,
      },
    ],
    waiting: [],
  };
}

export type Show = 'everyone' | 'notReached' | 'reached' | 'told' | Kind;

export interface ReachGroup {
  key: 'reached' | 'told' | 'whatsApp' | Kind;
  name: string;
  people: readonly Unreached[];
  count: number;
  more: number;
}

export interface Who {
  reach: Reach;
  line: string;
  groups: readonly ReachGroup[];
  /** Who a resend is for: not reached, not marked as told, and not in progress. */
  waiting: readonly Unreached[];
}

function baseOf(of: ReachedOf): readonly Unreached[] {
  return of === 'parking' ? PARKING_UNREACHED : of === 'invite' ? INVITE_UNREACHED : SO_FAR.cant;
}

/** Who it reached for one message: its summary, its groups in Everyone's order, and who a resend is for; `groups` are the event's own. */
export function whoOf(inbox: Inbox, of: ReachedOf, thread: ConvoId, groups: readonly Group[]): Who {
  if (of === 'receipts') return receiptsWho();

  const marks = inbox.marked[thread] ?? [];
  const mine = (one: Unreached) => updatedPerson(one, savedOn(inbox, one.id, thread));
  const people = baseOf(of)
    .filter((one) => !marks.includes(one.id))
    .map(mine);
  const toldLine: Line = {
    mark: 'delivered',
    word: MW.toldInPersonLine,
    why: filled(MW.markedBy, { name: READER, time: SENT_AGAIN_AT }),
  };
  const markable = of === 'new' ? [...SO_FAR.progress, ...baseOf(of)] : baseOf(of);
  const marked = marks
    .flatMap((id) => markable.filter((one) => one.id === id))
    .map(mine)
    .map(({ updated: _updated, offer: _offer, ...one }) => ({
      ...one,
      lines: [...one.lines, toldLine],
      fixes: [],
    }));
  const told: ReachGroup = {
    key: 'told',
    name: MW.markedAsTold,
    people: marked,
    count: marked.length,
    more: 0,
  };
  const waiting = people.filter((one) => one.kind !== 'inProgress');

  if (of === 'new') {
    const sent = people.filter((one) => one.kind === 'inProgress');
    const left = SO_FAR.progress.filter((one) => !marks.includes(one.id));
    const progress = [...left, ...sent];
    const inProgress = SO_FAR.inProgress - (SO_FAR.progress.length - left.length) + sent.length;
    const reached = SO_FAR.reached + marked.length;
    const reach: Reach = {
      reached,
      of: countOf(outsIn(inbox, thread)[0]?.to ?? COMING, groups) ?? 0,
      seen: 3,
      parts: [
        { kind: 'reached', count: reached },
        { kind: 'inProgress', count: inProgress },
        ...(waiting.length > 0 ? [{ kind: 'cant' as const, count: waiting.length }] : []),
      ],
    };

    return {
      reach,
      line: [
        many('inProgressCount', inProgress),
        ...(waiting.length > 0 ? [many('cantBeToldCount', waiting.length)] : []),
        filled(MW.seenBy, { count: reach.seen }),
      ].join(' · '),
      groups: [
        {
          key: 'inProgress',
          name: MW.legendInProgress,
          people: progress,
          count: inProgress,
          more: inProgress - progress.length,
        },
        { key: 'cant', name: MW.legendCantBeTold, people: waiting, count: waiting.length, more: 0 },
        told,
        {
          key: 'reached',
          name: MW.legendReached,
          people: SO_FAR.done,
          count: SO_FAR.reached,
          more: SO_FAR.reached - SO_FAR.done.length,
        },
      ],
      waiting,
    };
  }

  const reach =
    of === 'parking'
      ? reachFrom(PARKING_OF, PARKING_SEEN, people)
      : reachFrom(INVITE_REACH.of, INVITE_REACH.seen, people);
  const delivered = reach.reached - marked.length;
  const drawn = of === 'parking' ? PARKING_REACHED : INVITE_REACHED;

  return {
    reach,
    line:
      of === 'invite'
        ? reachLine(
            reach,
            `${many('nowInvitedCount', INVITE_REACH.reached)} · ${filled(MW.seenBy, { count: INVITE_REACH.seen })}`,
          )
        : reachLine(reach),
    groups: [
      ...KIND_ORDER.map((kind) => {
        const these = people.filter((one) => one.kind === kind);

        return { key: kind, name: legendWord(kind), people: these, count: these.length, more: 0 };
      }),
      told,
      {
        key: 'reached',
        name: MW.legendReached,
        people: drawn,
        count: delivered,
        more: delivered - drawn.length,
      },
    ],
    waiting,
  };
}

function isNotReached(group: ReachGroup): boolean {
  return group.key !== 'told' && group.key !== 'reached' && group.key !== 'whatsApp';
}

export interface ShowItem {
  key: Show;
  word: string;
  count: number;
}

/** The Filter's choices, each counted: Everyone, Not reached, each group there is, Reached and Marked as told. */
export function showItems(who: Who): readonly ShowItem[] {
  const groups = who.groups.filter(isNotReached);

  return [
    { key: 'everyone', word: MW.everyone, count: who.reach.of },
    {
      key: 'notReached',
      word: MW.notReachedWord,
      count: groups.reduce((sum, group) => sum + group.count, 0),
    },
    ...groups
      .filter((group) => group.count > 0)
      .map((group) => ({ key: group.key as Kind, word: group.name, count: group.count })),
    { key: 'reached', word: MW.legendReached, count: who.reach.reached },
    {
      key: 'told',
      word: MW.markedAsTold,
      count: who.groups.find((group) => group.key === 'told')?.count ?? 0,
    },
  ];
}

export const EMPTY_LINE: Partial<Record<Show, string>> = {
  notReached: MW.nobodyLeft,
  reached: MW.nobodyReached,
  told: MW.nobodyMarked,
};

const ALWAYS: readonly Show[] = ['everyone', 'notReached', 'reached', 'told'];

/** The one time the Filter moves on its own (sc-3966's AC): a group offered only while it has someone, left with nobody, gives way to Not reached, or to Everyone once nobody is left not reached. */
export function showAfter(who: Who, show: Show): Show {
  const items = showItems(who);

  if (ALWAYS.includes(show) || items.some((item) => item.key === show)) return show;

  return (items.find((item) => item.key === 'notReached')?.count ?? 0) > 0
    ? 'notReached'
    : 'everyone';
}

export function shownOf(
  who: Who,
  show: Show,
): { heading: string; groups: readonly ReachGroup[]; empty: string | null } {
  const item = showItems(who).find((one) => one.key === show);
  const count = item?.count ?? 0;
  const heading =
    show === 'notReached'
      ? filled(MW.notReached, { count })
      : `${item?.word ?? legendWord(show as Kind)} · ${count}`;
  const groups = who.groups.filter((group) => {
    switch (show) {
      case 'everyone':
        return group.count > 0;
      case 'notReached':
        return isNotReached(group) && group.count > 0;
      default:
        return group.key === show;
    }
  });
  const empty = groups.every((group) => group.count === 0) ? (EMPTY_LINE[show] ?? null) : null;

  return { heading, groups, empty };
}

const TELLABLE_NOW: readonly string[] = ['yuki', 'amaka', 'priyanka'];
const STILL_FIRST: readonly string[] = ['joaquin', 'sophie'];

export interface ResendCheck {
  waiting: number;
  count: number;
  unconfirmed: number;
  still: number;
  cant: readonly string[];
  credits: number;
}

/** A resend's check, from Who it reached as it is now: who can be told again, and who still can't. */
export function resendOf(
  inbox: Inbox,
  thread: ConvoId,
  ticks: Ticks,
  groups: readonly Group[],
): ResendCheck {
  const of = reachedOfThread(thread);
  const { waiting } = whoOf(inbox, of, thread, groups);
  const unsent = (id: string) => savedOn(inbox, id, thread).filter((one) => !one.sent);
  const tellable = waiting.filter(
    (one) => (of === 'parking' && TELLABLE_NOW.includes(one.id)) || unsent(one.id).length > 0,
  );
  const still = waiting.filter((one) => !tellable.includes(one));
  const shown =
    of === 'parking'
      ? [
          ...STILL_FIRST.flatMap((id) => still.filter((one) => one.id === id)),
          ...still.filter((one) => !STILL_FIRST.includes(one.id)),
        ].slice(0, 2)
      : still;
  const phones = tellable.filter(
    (one) =>
      one.kind === 'notConfirmed' || unsent(one.id).some((update) => update.fix === 'addPhone'),
  ).length;

  return {
    waiting: waiting.length,
    count: tellable.length,
    unconfirmed: tellable.filter((one) => one.kind === 'notConfirmed').length,
    still: still.length,
    cant: shown.map((one) =>
      [one.name, ...one.lines.slice(0, -1).map((line) => line.why ?? line.word)].join(' · '),
    ),
    credits:
      (ticks.sms ? phones : 0) +
      (ticks.whatsApp ? whatsAppCreditsFor(tellable.map((one) => one.id)) : 0),
  };
}

export type Stage = 'countdown' | 'sending' | 'sent' | 'failed';

export interface Out {
  thread: ConvoId;
  subject: string;
  body: readonly Segment[];
  to: Audience;
  ticks: Ticks;
  stage: Stage;
  left: number;
  at: string;
  seen: number;
  soFar?: number;
}

export interface Draft {
  thread: ConvoId;
  to: Audience;
  ticks: Ticks;
  subject: string;
  body: readonly Segment[];
  step: 'write' | 'preview' | 'check';
  seed: number;
  openTo?: boolean;
  opens?: 'insert' | 'previewAs' | 'filling' | undefined;
  previewAs?: PersonId;
}

export interface Sched {
  id: ConvoId;
  subject: string;
  body: readonly Segment[];
  to: Audience;
  ticks: Ticks;
  day: string;
  time: string;
  cancelledAt: string | null;
  cancelledBy?: string;
  outcome?: 'sent' | 'tooLate';
}

export interface Answer {
  text: string;
  at: string;
  stage: 'sending' | 'told' | 'seen';
  seen?: string;
  /** The channel Soirely's notice went by, when it was not the guest's own. */
  by?: Channel;
  /** A notice held for credits, or one that waited and could not go. */
  notice?: 'held' | 'tooLate';
}

export type ReachedOf = 'parking' | 'invite' | 'receipts' | 'new';

export type Pane =
  | { kind: 'idle' }
  | { kind: 'convo'; id: ConvoId }
  | { kind: 'compose' }
  | { kind: 'reached'; of: ReachedOf; thread: ConvoId };

export interface Told {
  item: string;
  line: string;
  venue?: boolean;
}

export interface Inbox {
  loading: boolean;
  present: readonly ConvoId[];
  done: readonly ConvoId[];
  doneAt: Partial<Record<ConvoId, string>>;
  answers: Partial<Record<GuestId | 'unknown', readonly Answer[]>>;
  balance: number;
  /** `noticeNotSent`: Lucía's earlier question, whose answer's notice was held 48 hours for credits. */
  heldTooLong?: boolean;
  arrived: ConvoId | null;
  /** The arrived row's wash and its "now"; the settle clears only this, so the row keeps its place and time. */
  fresh: ConvoId | null;
  matched: string | null;
  pane: Pane;
  draft: Draft | null;
  cancelled: boolean;
  outs: readonly Out[];
  scheds: readonly Sched[];
  unreached: readonly Unreached[];
  /** Keyed by guest id: the addresses Who it reached saved for each guest, seen by every message. */
  updates: Readonly<Record<string, readonly Update[]>>;
  marked: Readonly<Partial<Record<ConvoId, readonly string[]>>>;
  resend: { thread: ConvoId; ticks: Ticks } | null;
  untold: readonly Told[];
  /** sc-3978: who stopped each guest writing from their page, and when. */
  stopped?: Partial<Record<GuestId, Stop>>;
}

export const TICKS: Ticks = { email: true, sms: true, whatsApp: false };

const ALL: readonly ConvoId[] = [
  'ines',
  'lucia',
  'kwame',
  'unknown',
  'parking',
  'sched',
  'marta',
  'invite',
];

export const SCHEDULED: Sched = {
  id: 'sched',
  subject: 'On the day: where to find us',
  body: greeted(
    ', we start at 18:00 at The Landmark, 222 Marylebone Road. The doors open at 17:30.',
  ),
  to: COMING,
  ticks: TICKS,
  day: '2026-11-05',
  time: '09:00',
  cancelledAt: null,
};

export function isNew(id: ConvoId): boolean {
  return id.startsWith('new');
}

export function isSched(id: ConvoId): boolean {
  return id.startsWith('sched');
}

function nextId(taken: ReadonlySet<string>, stem: 'new' | 'sched'): ConvoId {
  if (!taken.has(stem)) return stem;

  let n = 2;

  while (taken.has(`${stem}${n}`)) n += 1;

  return `${stem}${n}`;
}

export function freshId(inbox: Inbox): ConvoId {
  return nextId(new Set(inbox.outs.map((out) => out.thread)), 'new');
}

export function dayWords(day: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));
}

export function draftOf(
  to: Audience,
  step: Draft['step'] = 'write',
  full = true,
  thread: ConvoId = 'new',
): Draft {
  return {
    thread,
    to,
    ticks: TICKS,
    subject: full ? NEW_MESSAGE.subject : '',
    body: full ? NEW_MESSAGE.body : [],
    step,
    seed: 0,
  };
}

function outOf(stage: Stage, extra: Partial<Out> = {}): Out {
  return {
    thread: 'new',
    subject: NEW_MESSAGE.subject,
    body: NEW_MESSAGE.body,
    to: COMING,
    ticks: TICKS,
    stage,
    left: 10,
    at: NOW,
    seen: 3,
    ...extra,
  };
}

function wall(iso: string, timeZone: string, parts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, ...parts }).format(new Date(iso));
}

/** What a save changed that guests rely on (sc-4330): the start's day or time, and the venue. */
export function toldOf(was: SampleEvent, now: SampleEvent): Told[] {
  const day = (iso: string) =>
    wall(iso, now.timeZone, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = (iso: string) => writtenTime(iso, 'en-US', now.timeZone);
  const told: Told[] = [];

  if (day(was.startsAt) !== day(now.startsAt))
    told.push({
      item: MW.newDate,
      line: filled(MW.dateMoved, { new: day(now.startsAt), old: day(was.startsAt) }),
    });
  else if (time(was.startsAt) !== time(now.startsAt))
    told.push({
      item: MW.newStartTime,
      line: filled(MW.startMoved, { new: time(now.startsAt), old: time(was.startsAt) }),
    });
  if ((was.venue?.name ?? '') !== (now.venue?.name ?? '') && now.venue != null)
    told.push({
      item: MW.newVenue,
      line: filled(MW.venueMoved, { new: now.venue.name, old: was.venue?.name ?? '' }),
      venue: true,
    });

  return told;
}

export const STARTS_LATER: Told = {
  item: MW.newStartTime,
  line: filled(MW.startMoved, { new: writtenTime('17:30', 'en'), old: writtenTime('18:00', 'en') }),
};

export const ROSEWOOD = {
  name: 'Rosewood London',
  address: '252 High Holborn, London WC1V 7EN',
  city: 'London',
};

export const NEW_PLACE: Told = {
  item: MW.newVenue,
  line: filled(MW.venueMoved, { new: ROSEWOOD.name, old: 'The Landmark' }),
  venue: true,
};

function compose(base: Inbox, to: Audience, step: Draft['step'], ticks: Ticks = TICKS): Inbox {
  return { ...base, pane: { kind: 'compose' }, draft: { ...draftOf(to, step), ticks } };
}

export function seedOf(state: MessagesState | null): Inbox {
  const base: Inbox = {
    loading: false,
    present: ALL,
    done: ['marta'],
    doneAt: {},
    answers: {},
    balance: BALANCE,
    arrived: null,
    fresh: null,
    matched: null,
    pane: { kind: 'idle' },
    draft: null,
    cancelled: false,
    outs: [],
    scheds: [SCHEDULED],
    unreached: PARKING_UNREACHED,
    updates: {},
    marked: {},
    resend: null,
    untold: [],
  };
  const open = (id: ConvoId) => ({ kind: 'convo', id }) as const;
  const parkingReached = { kind: 'reached', of: 'parking', thread: 'parking' } as const;
  const saved = (id: string, fix: AddressFix, address: string, more: Partial<Update> = {}) => ({
    ...base,
    pane: parkingReached,
    updates: { [id]: [{ fix, address, sentOn: [], laterOn: [], ...more }] },
  });

  const allTicked: Ticks = { email: true, sms: true, whatsApp: true };

  switch (state) {
    case 'whatsAppLine':
      return compose(base, { kind: 'all' }, 'write', allTicked);
    case 'checkWhatsApp':
      return compose(base, { kind: 'all' }, 'check', allTicked);
    case 'whatsAppRead':
      return {
        ...base,
        present: ALL.map((id) => (id === 'parking' ? 'receipts' : id)),
        pane: { kind: 'reached', of: 'receipts', thread: 'receipts' },
      };
    case 'first':
    case 'closedDraft':
      return { ...base, present: [] };
    case 'closedEnded':
      return { ...base, present: ALL.filter((id) => id !== 'sched'), scheds: [] };
    case 'loading':
      return { ...base, loading: true };
    case 'conversation':
    case 'bell':
    case 'stopAction':
    case 'stopAsk':
    case 'stopFailed':
      return { ...base, pane: open('ines') };
    case 'stopped':
    case 'letAgainFailed':
    case 'stoppedNoManage':
      return { ...base, pane: open('ines'), stopped: { ines: { by: READER, at: STOPPED_AT } } };
    case 'replyArrived':
      return { ...base, present: ALL.filter((id) => id !== 'lucia'), pane: open('ines') };
    case 'answered':
      return {
        ...base,
        done: ['ines', 'marta'],
        doneAt: { ines: '09:20' },
        answers: {
          ines: [{ text: ANSWERS.ines ?? '', at: '09:20', stage: 'seen', seen: '09:31' }],
        },
        pane: open('ines'),
      };
    case 'channelReply':
      return { ...base, pane: open('kwame') };
    case 'noticeCost':
      return { ...base, pane: open('lucia') };
    case 'noticeWaits':
      return { ...base, balance: 2, pane: open('lucia') };
    case 'noticeNotSent':
      return { ...base, balance: 2, heldTooLong: true, pane: open('lucia') };
    case 'to':
    case 'write':
      return compose(base, COMING, 'write');
    case 'preview':
      return compose(base, COMING, 'preview');
    case 'check':
    case 'later':
      return compose(base, COMING, 'check');
    case 'checkAll':
      return compose(base, { kind: 'all' }, 'check');
    case 'checkNotReplied':
      return compose(base, NOT_REPLIED, 'check');
    case 'checkChannels':
      return compose(base, COMING, 'check', { email: true, sms: false, whatsApp: false });
    case 'cancelled':
      return { ...compose(base, COMING, 'write'), cancelled: true };
    case 'countdown':
    case 'sending':
    case 'sent':
    case 'failed':
      return { ...base, pane: open('new'), outs: [outOf(state)] };
    case 'noSubject':
      return { ...base, pane: open('new'), outs: [outOf('sent', { subject: '', seen: 12 })] };
    case 'followUp':
      return {
        ...base,
        pane: open('new'),
        outs: [
          outOf('sent', { seen: 41 }),
          outOf('sending', {
            subject: '',
            body: [{ kind: 'text', text: FOLLOW_UP }],
            at: '10:05',
            soFar: 20,
          }),
        ],
      };
    case 'sentReached':
      return {
        ...base,
        pane: { kind: 'reached', of: 'new', thread: 'new' },
        outs: [outOf('sent')],
      };
    case 'reached':
    case 'fix':
      return { ...base, pane: parkingReached };
    case 'filterMenu':
    case 'filtered':
      return { ...base, pane: parkingReached };
    case 'fixed':
      return saved('tomas', 'fixEmail', NEW_ADDRESS);
    case 'sentAgain':
      return saved('tomas', 'fixEmail', NEW_ADDRESS, { sentOn: ['parking'] });
    case 'notNow':
      return saved('tomas', 'fixEmail', NEW_ADDRESS, { laterOn: ['parking'] });
    case 'added':
      return saved('joaquin', 'addEmail', 'joaquin.ruiz@gmail.com');
    case 'addedPhone':
      return saved('lars', 'addPhone', '+46 70 123 45 67');
    case 'told':
      return changed({ ...base, pane: parkingReached }, { kind: 'toldInPerson', id: 'amaka' });
    case 'resend':
      return { ...base, pane: open('parking'), resend: { thread: 'parking', ticks: TICKS } };
    case 'resendInvited':
      return { ...base, pane: open('invite'), resend: { thread: 'invite', ticks: TICKS } };
    case 'resendSent':
      return {
        ...base,
        pane: open('new'),
        outs: [outOf('sent')],
        resend: { thread: 'new', ticks: TICKS },
      };
    case 'untold':
      return { ...base, pane: open('ines'), untold: [STARTS_LATER] };
    case 'invited':
      return { ...base, pane: open('invite') };
    case 'invitedReached':
      return { ...base, pane: { kind: 'reached', of: 'invite', thread: 'invite' } };
    case 'notMatched':
    case 'matchPicker':
      return { ...base, pane: open('unknown') };
    case 'matched':
      return { ...base, pane: open('unknown'), matched: 'Camille Dubois' };
    case 'scheduled':
    case 'scheduledEdit':
    case 'sendNow':
    case 'cancelAsk':
    case 'editConflict':
    case 'editSent':
    case 'editCancelled':
    case 'editTooLate':
      return { ...base, pane: open('sched') };
    case 'scheduledCancelled':
      return {
        ...base,
        pane: open('sched'),
        scheds: [{ ...SCHEDULED, cancelledAt: '09:46' }],
      };
    case 'insert':
    case 'previewAs':
    case 'previewGreetAs':
    case 'previewChose':
    case 'previewLoading':
    case 'previewMarkup':
    case 'typedBraces':
    case 'previewBraces':
    case 'noTokens':
      return {
        ...base,
        pane: { kind: 'compose' },
        draft: { ...draftOf(COMING), ...previewDraftOf(state) },
      };
    case 'previewNobody':
      return compose(base, { kind: 'who', conditions: [] }, 'write');
    case 'sendWithout':
      return {
        ...base,
        balance: 0,
        pane: open('new'),
        outs: [outOf('countdown', { ticks: EMAIL_ONLY })],
      };
    default: {
      const waits = waitsTicksOf(state);

      if (waits != null) return { ...compose(base, COMING, 'check', waits), balance: 0 };

      const seed = toSeedOf(state);

      if (seed?.kind === 'compose')
        return {
          ...base,
          pane: { kind: 'compose' },
          draft: { ...draftOf(seed.to), openTo: seed.open },
        };
      if (seed?.kind === 'convo')
        return {
          ...base,
          present: [...ALL, ...seed.more],
          pane: open(seed.id),
          untold: seed.untold === true ? [STARTS_LATER] : [],
        };

      return base;
    }
  }
}

export type Lead =
  { kind: 'guest'; initials: string; unread: boolean } | { kind: 'unknown' } | { kind: 'many' };

export interface Tag {
  kind: 'notyet' | 'waiting' | 'ended';
  word: string;
}

export interface Row {
  id: ConvoId;
  title: string;
  line: string;
  when: string;
  lead: Lead;
  tag: Tag | null;
  fresh: boolean;
}

export interface Sections {
  top: readonly Row[];
  needs: readonly Row[];
  scheduled: readonly Row[];
  done: readonly Row[];
}

const GUEST_IDS: readonly GuestId[] = ['ines', 'lucia', 'kwame', 'marta'];

export function isGuest(id: ConvoId): id is GuestId {
  return (GUEST_IDS as readonly string[]).includes(id);
}

export function whereWord(where: Where): string {
  return where === 'page' ? MW.onTheirPage : channelWord(where);
}

function guestRow(inbox: Inbox, id: GuestId): Row {
  const guest = GUESTS[id];
  const done = inbox.done.includes(id);
  const answer = inbox.answers[id]?.at(-1);
  const arrived = inbox.arrived === id;
  const fresh = inbox.fresh === id;
  const said = answer == null ? guest.asked : filled(MW.you, { text: answer.text });
  const line = [
    whereWord(guest.where),
    said,
    ...(done && answer == null ? [filled(MW.doneByShort, { name: READER })] : []),
  ].join(' · ');

  return {
    id,
    title: guest.name,
    line,
    when: fresh ? MW.now : (answer?.at ?? (arrived ? NOW : guest.row)),
    lead: { kind: 'guest', initials: guest.initials, unread: !done },
    tag: null,
    fresh,
  };
}

function unknownRow(inbox: Inbox): Row {
  const answer = inbox.answers.unknown?.at(-1);
  const said = answer == null ? UNKNOWN.text : filled(MW.you, { text: answer.text });
  const match = MATCHES.find((one) => one.name === inbox.matched);

  return {
    id: 'unknown',
    title: match?.name ?? UNKNOWN.address,
    line: `${MW.email} · ${said}`,
    when: answer?.at ?? UNKNOWN.row,
    lead:
      match == null
        ? { kind: 'unknown' }
        : { kind: 'guest', initials: match.initials, unread: !inbox.done.includes('unknown') },
    tag: match == null ? { kind: 'notyet', word: MW.notMatched } : null,
    fresh: false,
  };
}

export function outReach(
  out: Out,
  groups: readonly Group[],
): {
  count: number;
  reached: number;
  soFar: number;
  seen: number;
} {
  const count = countOf(out.to, groups) ?? 0;

  return {
    count,
    reached: count - figuresOf(out.to, out.ticks).cantTell,
    soFar: out.soFar ?? Math.round(count * 0.4),
    seen: out.seen,
  };
}

export function outLine(out: Out, groups: readonly Group[]): string {
  const reach = outReach(out, groups);

  switch (out.stage) {
    case 'countdown':
      return filled(MW.sendingIn, { count: out.left });
    case 'sending':
      return filled(MW.reachedSoFar, { count: reach.soFar, total: reach.count });
    case 'sent':
      return filled(MW.reached, { count: reach.reached, total: reach.count });
    default:
      return MW.nothingWasSent;
  }
}

/** A message's name: its Subject, or with none its first line, shortened (pm, 7 Nov). */
export function outTitle(out: Pick<Out, 'subject' | 'body'>): string {
  const subject = out.subject.trim();

  if (subject !== '') return subject;

  const first = plainOf(out.body).trim().split('\n')[0]?.trim() ?? '';

  if (first.length <= 40) return first;

  const cut = first.slice(0, 41);
  const end = cut.lastIndexOf(' ');

  return `${(end > 0 ? cut.slice(0, end) : cut).replace(/[\s.,;:!?]+$/u, '')}…`;
}

export function outsIn(inbox: Inbox, thread: ConvoId): readonly Out[] {
  return inbox.outs.filter((out) => out.thread === thread);
}

function busy(out: Out | undefined): boolean {
  return out?.stage === 'countdown' || out?.stage === 'sending' || out?.stage === 'failed';
}

function manyRow(id: ConvoId, title: string, line: string, when: string, tag: Tag | null): Row {
  return { id, title, line, when, lead: { kind: 'many' }, tag, fresh: false };
}

/** Who cancelled a scheduled message and when: the reader, or (sc-3963's refused save) a colleague. */
export function cancelledWords(sched: Sched): string {
  return filled(MW.cancelledBy, {
    name: sched.cancelledBy ?? READER,
    time: sched.cancelledAt ?? '',
  });
}

function schedRow(sched: Sched, groups: readonly Group[]): Row {
  if (sched.cancelledAt != null)
    return manyRow(
      sched.id,
      outTitle(sched),
      cancelledWords(sched).split('.')[0] ?? '',
      sched.cancelledAt,
      { kind: 'ended', word: MW.cancelledTag },
    );
  if (sched.outcome === 'sent')
    return manyRow(
      sched.id,
      outTitle(sched),
      `${toLine(sched.to, groups)} · ${toldWords(sched.ticks)}`,
      sched.time,
      null,
    );
  if (sched.outcome === 'tooLate')
    return manyRow(
      sched.id,
      outTitle(sched),
      `${toLine(sched.to, groups)} · ${dayWords(sched.day)}, ${sched.time}`,
      '',
      { kind: 'ended', word: MW.notSentTooLate },
    );

  return manyRow(
    sched.id,
    outTitle(sched),
    `${toLine(sched.to, groups)} · ${dayWords(sched.day)}, ${sched.time}`,
    '',
    { kind: 'notyet', word: MW.scheduled },
  );
}

export function rowOf(inbox: Inbox, id: ConvoId, groups: readonly Group[]): Row {
  if (isGuest(id)) return guestRow(inbox, id);
  if (id === 'unknown') return unknownRow(inbox);
  if (isSentTo(id)) return sentToRow(id, groups);

  const outs = outsIn(inbox, id);
  const last = outs.at(-1);
  const sched = inbox.scheds.find((one) => one.id === id);

  if (sched != null && last == null) return schedRow(sched, groups);
  if (id === 'parking')
    return manyRow(
      id,
      PARKING.subject,
      last != null && busy(last)
        ? outLine(last, groups)
        : `${MW.toAll} · ${many('didntGetIt', inbox.unreached.length)}`,
      last == null ? PARKING.row : last.at,
      inbox.unreached.length === 0
        ? null
        : { kind: 'waiting', word: filled(MW.notReached, { count: inbox.unreached.length }) },
    );
  if (id === 'receipts')
    return manyRow(
      id,
      PARKING.subject,
      `${MW.toAll} · ${many('didntGetIt', RECEIPTS.cant)}`,
      PARKING.row,
      { kind: 'waiting', word: filled(MW.notReached, { count: RECEIPTS.cant }) },
    );
  if (id === 'invite')
    return manyRow(
      id,
      MW.invitation,
      last != null && busy(last)
        ? outLine(last, groups)
        : `${MW.toAll} · ${filled(MW.reached, { count: INVITE_REACH.reached, total: INVITE_REACH.of })}`,
      last == null ? INVITE.row : last.at,
      null,
    );

  return threadRow(inbox, id, groups);
}

function threadRow(inbox: Inbox, id: ConvoId, groups: readonly Group[]): Row {
  const outs = outsIn(inbox, id);
  const first = outs[0];
  const last = outs.at(-1);

  if (first == null || last == null) {
    const to = inbox.draft?.to ?? { kind: 'all' };

    return manyRow(id, MW.newMessage, `${toLine(to, groups)} · ${MW.notSentYet}`, NOW, null);
  }

  const title = outTitle(first);
  const missed = figuresOf(last.to, last.ticks).cantTell;

  if (last.stage === 'sent' && litOf(inbox) !== id && missed > 0)
    return manyRow(
      id,
      title,
      `${toLine(last.to, groups)} · ${many('didntGetIt', missed)}`,
      last.at,
      {
        kind: 'waiting',
        word: filled(MW.notReached, { count: missed }),
      },
    );

  const line =
    outs.length > 1 && busy(last)
      ? `${MW.followUp} · ${outLine(last, groups)}`
      : outLine(last, groups);

  return manyRow(
    id,
    title,
    line,
    last.at,
    last.stage === 'failed' ? { kind: 'notyet', word: MW.notSent } : null,
  );
}

export function litOf(inbox: Inbox): ConvoId | null {
  switch (inbox.pane.kind) {
    case 'convo':
      return inbox.pane.id;
    case 'reached':
      return inbox.pane.thread;
    case 'compose':
      return inbox.draft?.thread ?? null;
    default:
      return null;
  }
}

function threadsOf(inbox: Inbox): ConvoId[] {
  const ids: ConvoId[] = [
    ...new Set(
      inbox.outs.map((out) => out.thread).filter((id) => id !== 'parking' && id !== 'invite'),
    ),
  ];
  const draft = inbox.draft;

  if (
    inbox.pane.kind === 'compose' &&
    draft != null &&
    isNew(draft.thread) &&
    !ids.includes(draft.thread)
  )
    ids.push(draft.thread);

  return ids.reverse();
}

export function sectionsOf(inbox: Inbox, groups: readonly Group[]): Sections {
  const here = (id: ConvoId) => inbox.present.includes(id);
  const lit = litOf(inbox);
  const top: Row[] = [];
  const needs: Row[] = [];
  const done: Row[] = [];

  for (const id of threadsOf(inbox)) {
    const last = outsIn(inbox, id).at(-1);
    const row = rowOf(inbox, id, groups);

    if (id === lit || last == null || last.stage === 'countdown' || last.stage === 'sending')
      top.push(row);
    else if (row.tag != null) needs.push(row);
    else done.push(row);
  }

  const waiting: ConvoId[] = ['ines', 'lucia', 'kwame', 'unknown'];
  const arrived = inbox.arrived;

  if (arrived != null && here(arrived) && !inbox.done.includes(arrived))
    needs.push(rowOf(inbox, arrived, groups));
  for (const id of waiting)
    if (id !== arrived && here(id) && !inbox.done.includes(id))
      needs.push(rowOf(inbox, id, groups));
  if (here('parking') && inbox.unreached.length > 0) needs.push(rowOf(inbox, 'parking', groups));
  if (here('receipts')) needs.push(rowOf(inbox, 'receipts', groups));

  const scheds = inbox.scheds.filter(
    (one) => (one.id !== 'sched' || here('sched')) && outsIn(inbox, one.id).length === 0,
  );

  done.push(
    ...scheds
      .filter((one) => one.cancelledAt != null || one.outcome != null)
      .map((one) => schedRow(one, groups)),
  );
  done.push(...inbox.done.filter(here).map((id) => rowOf(inbox, id, groups)));
  done.push(
    ...SENT_TO.filter((id) => here(id) && outsIn(inbox, id).length === 0).map((id) =>
      sentToRow(id, groups),
    ),
  );
  if (here('parking') && inbox.unreached.length === 0) done.push(rowOf(inbox, 'parking', groups));
  if (here('invite')) done.push(rowOf(inbox, 'invite', groups));

  return {
    top,
    needs,
    scheduled: scheds
      .filter((one) => one.cancelledAt == null && one.outcome == null)
      .map((one) => schedRow(one, groups)),
    done,
  };
}

export function rowsInOrder(sections: Sections): readonly Row[] {
  return [...sections.top, ...sections.needs, ...sections.scheduled, ...sections.done];
}

export function countsOf(inbox: Inbox): { waiting: number; notMatched: number } {
  const open = (id: ConvoId) => inbox.present.includes(id) && !inbox.done.includes(id);
  const guests = (['ines', 'lucia', 'kwame'] as const).filter(open).length;

  return {
    waiting: guests + (inbox.matched != null && open('unknown') ? 1 : 0),
    notMatched: inbox.matched == null && open('unknown') ? 1 : 0,
  };
}

export function waitingLine(inbox: Inbox): { line: string; name: string } | null {
  const { waiting, notMatched } = countsOf(inbox);
  const parts = [
    ...(waiting > 0 ? [many('waiting', waiting)] : []),
    ...(notMatched > 0 ? [many('notMatchedCount', notMatched)] : []),
  ];

  return parts.length === 0
    ? null
    : { line: parts.join(' · '), name: [MESSAGES_WORD, ...parts].join(', ') };
}

export type Change =
  | { kind: 'open'; id: ConvoId }
  | { kind: 'idle' }
  | { kind: 'arrive'; id: ConvoId }
  | { kind: 'settle' }
  | { kind: 'done'; id: ConvoId; at: string }
  | { kind: 'waiting'; id: ConvoId }
  | { kind: 'answer'; id: GuestId | 'unknown'; text: string; by?: Channel }
  | { kind: 'told'; id: GuestId | 'unknown' }
  | { kind: 'compose'; draft: Draft }
  | { kind: 'draft'; draft: Partial<Draft> }
  | { kind: 'go' }
  | { kind: 'tick' }
  | { kind: 'cancel' }
  | { kind: 'stage'; from: Stage; to: Stage }
  | { kind: 'reached'; of: ReachedOf; thread: ConvoId }
  | { kind: 'toldInPerson'; id: string; thread?: ConvoId }
  | { kind: 'undoTold'; id: string; thread: ConvoId }
  | { kind: 'fixed'; id: string; thread: ConvoId; fix: AddressFix; address: string }
  | { kind: 'notNow'; id: string; thread: ConvoId }
  | { kind: 'sendAgain'; id: string; thread: ConvoId }
  | { kind: 'resend'; resend: Ticks | null }
  | { kind: 'untold'; untold: readonly Told[] }
  | { kind: 'match'; name: string }
  | { kind: 'schedule'; day: string; time: string }
  | { kind: 'resched'; id: ConvoId; sched: Partial<Sched> }
  | { kind: 'sendNow'; id: ConvoId }
  | { kind: 'stop'; id: GuestId; stop: Stop }
  | { kind: 'letWrite'; id: GuestId };

function lastAt(outs: readonly Out[], stage: Stage): number {
  for (let at = outs.length - 1; at >= 0; at -= 1) if (outs[at]?.stage === stage) return at;

  return -1;
}

function restage(inbox: Inbox, from: Stage, next: (out: Out) => Out): Inbox {
  const at = lastAt(inbox.outs, from);

  if (at < 0) return inbox;

  return { ...inbox, outs: inbox.outs.map((out, index) => (index === at ? next(out) : out)) };
}

function going(draft: Pick<Draft, 'thread' | 'subject' | 'body' | 'to' | 'ticks'>): Out {
  return {
    thread: draft.thread,
    subject: draft.subject,
    body: draft.body,
    to: draft.to,
    ticks: draft.ticks,
    stage: 'countdown',
    left: 10,
    at: NOW,
    seen: 3,
  };
}

export function changed(inbox: Inbox, change: Change): Inbox {
  switch (change.kind) {
    case 'stop':
      return { ...inbox, stopped: { ...inbox.stopped, [change.id]: change.stop } };
    case 'letWrite':
      return {
        ...inbox,
        stopped: Object.fromEntries(
          Object.entries(inbox.stopped ?? {}).filter(([id]) => id !== change.id),
        ),
      };
    case 'open':
      return {
        ...inbox,
        pane: { kind: 'convo', id: change.id },
        cancelled: false,
        resend: inbox.resend?.thread === change.id ? inbox.resend : null,
      };
    case 'idle':
      return { ...inbox, pane: { kind: 'idle' }, draft: null, cancelled: false };
    case 'arrive':
      return {
        ...inbox,
        present: inbox.present.includes(change.id) ? inbox.present : [...inbox.present, change.id],
        done: inbox.done.filter((id) => id !== change.id),
        arrived: change.id,
        fresh: change.id,
      };
    case 'settle':
      return { ...inbox, fresh: null };
    case 'done':
      return {
        ...inbox,
        done: [change.id, ...inbox.done.filter((id) => id !== change.id)],
        doneAt: { ...inbox.doneAt, [change.id]: change.at },
        arrived: inbox.arrived === change.id ? null : inbox.arrived,
        fresh: inbox.fresh === change.id ? null : inbox.fresh,
      };
    case 'waiting':
      return { ...inbox, done: inbox.done.filter((id) => id !== change.id) };
    case 'answer': {
      const by = change.by ?? (change.id === 'unknown' ? 'email' : GUESTS[change.id].toldBy);
      const credits = noticePrice(change.id, by);
      const held = credits > inbox.balance;
      const answer: Answer = {
        text: change.text,
        at: NOW,
        stage: 'sending',
        ...(change.by != null ? { by } : {}),
        ...(held ? { notice: 'held' as const } : {}),
      };

      return {
        ...inbox,
        balance: held ? inbox.balance : inbox.balance - credits,
        answers: { ...inbox.answers, [change.id]: [...(inbox.answers[change.id] ?? []), answer] },
      };
    }
    case 'told':
      return {
        ...inbox,
        answers: {
          ...inbox.answers,
          [change.id]: (inbox.answers[change.id] ?? []).map((answer) =>
            answer.stage === 'sending' ? { ...answer, stage: 'told' } : answer,
          ),
        },
      };
    case 'compose':
      return { ...inbox, pane: { kind: 'compose' }, draft: change.draft, cancelled: false };
    case 'draft':
      return inbox.draft == null ? inbox : { ...inbox, draft: { ...inbox.draft, ...change.draft } };
    case 'go': {
      const draft = inbox.draft;

      if (draft == null) return inbox;

      return {
        ...inbox,
        outs: [...inbox.outs, going(draft)],
        draft: null,
        cancelled: false,
        pane: { kind: 'convo', id: draft.thread },
      };
    }
    case 'tick':
      return restage(inbox, 'countdown', (out) =>
        out.left <= 1 ? { ...out, stage: 'sending', left: 0 } : { ...out, left: out.left - 1 },
      );
    case 'cancel': {
      const at = lastAt(inbox.outs, 'countdown');
      const out = inbox.outs[at];

      if (out == null) return inbox;

      const sched = inbox.scheds.find((one) => one.id === out.thread);

      if (sched != null)
        return {
          ...inbox,
          outs: inbox.outs.filter((_, index) => index !== at),
          pane: { kind: 'convo', id: sched.id },
        };

      return {
        ...inbox,
        outs: inbox.outs.filter((_, index) => index !== at),
        cancelled: true,
        pane: { kind: 'compose' },
        draft: {
          thread: out.thread,
          to: out.to,
          ticks: out.ticks,
          subject: out.subject,
          body: out.body,
          step: 'write',
          seed: (inbox.draft?.seed ?? 0) + 1,
        },
      };
    }
    case 'stage':
      return restage(inbox, change.from, (out) => ({ ...out, stage: change.to }));
    case 'reached':
      return {
        ...inbox,
        pane: { kind: 'reached', of: change.of, thread: change.thread },
        resend: null,
      };
    case 'toldInPerson': {
      const thread = change.thread ?? 'parking';
      const marks = inbox.marked[thread] ?? [];

      return {
        ...inbox,
        unreached:
          thread === 'parking'
            ? inbox.unreached.filter((one) => one.id !== change.id)
            : inbox.unreached,
        marked: {
          ...inbox.marked,
          [thread]: marks.includes(change.id) ? marks : [...marks, change.id],
        },
      };
    }
    case 'undoTold': {
      const kept = new Set([...inbox.unreached.map((one) => one.id), change.id]);

      return {
        ...inbox,
        unreached:
          change.thread === 'parking'
            ? PARKING_UNREACHED.filter((one) => kept.has(one.id))
            : inbox.unreached,
        marked: {
          ...inbox.marked,
          [change.thread]: (inbox.marked[change.thread] ?? []).filter((id) => id !== change.id),
        },
      };
    }
    case 'fixed':
    case 'notNow':
    case 'sendAgain': {
      const { id, thread } = change;
      const now = inbox.updates[id] ?? [];
      const next =
        change.kind === 'fixed'
          ? [...now, { fix: change.fix, address: change.address, sentOn: [], laterOn: [] }]
          : now.map((one) =>
              one.sentOn.includes(thread)
                ? one
                : change.kind === 'notNow'
                  ? { ...one, laterOn: [...one.laterOn, thread] }
                  : { ...one, sentOn: [...one.sentOn, thread] },
            );

      return { ...inbox, updates: { ...inbox.updates, [id]: next } };
    }
    case 'resend':
      return {
        ...inbox,
        resend:
          change.resend == null
            ? null
            : {
                thread:
                  inbox.resend?.thread ?? (inbox.pane.kind === 'convo' ? inbox.pane.id : 'parking'),
                ticks: change.resend,
              },
      };
    case 'untold':
      return { ...inbox, untold: change.untold };
    case 'match':
      return { ...inbox, matched: change.name };
    case 'schedule': {
      const draft = inbox.draft;

      if (draft == null) return inbox;

      const id = nextId(new Set(inbox.scheds.map((one) => one.id)), 'sched');

      return {
        ...inbox,
        scheds: [
          ...inbox.scheds,
          {
            id,
            subject: draft.subject,
            body: draft.body,
            to: draft.to,
            ticks: draft.ticks,
            day: change.day,
            time: change.time,
            cancelledAt: null,
          },
        ],
        draft: null,
        pane: { kind: 'convo', id },
      };
    }
    case 'resched':
      return {
        ...inbox,
        scheds: inbox.scheds.map((one) =>
          one.id === change.id ? { ...one, ...change.sched } : one,
        ),
      };
    case 'sendNow': {
      const sched = inbox.scheds.find((one) => one.id === change.id);

      if (sched == null) return inbox;

      return {
        ...inbox,
        outs: [...inbox.outs, going({ ...sched, thread: sched.id })],
        pane: { kind: 'convo', id: sched.id },
      };
    }
    default:
      return inbox;
  }
}

/** The inbox as it was left, so the sidebar's count and a return to Messages keep it. */
let kept: Inbox | null = null;

export function keepInbox(inbox: Inbox): void {
  kept = inbox;
}

export function keptInbox(): Inbox {
  return kept ?? seedOf(null);
}

export function resetInbox(): void {
  kept = null;
  shortcutsOn = true;
}

let shortcutsOn = true;

export function singleKeys(): boolean {
  return shortcutsOn;
}

export function setSingleKeys(on: boolean): void {
  shortcutsOn = on;
}

export const TELL = {
  count: 130,
  pills: [
    { channel: 'email', count: 128 },
    { channel: 'sms', count: 30 },
    { channel: 'whatsApp', count: 4 },
  ] as const,
  cannot: 2,
  credits: 30 + whatsAppCreditsFor(WHATSAPP.all.reaches),
  movedTo: '2026-11-05T17:30:00Z',
};
