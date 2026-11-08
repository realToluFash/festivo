import { writtenTime } from './clock.ts';
import type { SampleEvent } from './events.ts';
import { MESSAGES_WORD, MW } from './messagesWords.ts';
import type { DemoLink } from './settings.ts';

/** Messaging B · Conversations (page e36, board/messaging-b-spec.md): the sample and the inbox's rules; the words are in messagesWords.ts. */
export { MW };

type Words = typeof MW;
type PluralBase = {
  [K in keyof Words]: K extends `${infer Base}_one` ? Base : never;
}[keyof Words];

const NUMBER = new Intl.NumberFormat('en-US');
const PLURAL = new Intl.PluralRules('en-US');
const LIST = new Intl.ListFormat('en-US', { style: 'long', type: 'conjunction' });

export function filled(words: string, slots: Readonly<Record<string, string | number>>): string {
  return words.replaceAll(/\{\{(\w+)(?:, number)?\}\}/gu, (whole, slot: string) => {
    const value = slots[slot];

    if (value == null) return whole;

    return typeof value === 'number' ? NUMBER.format(value) : value;
  });
}

export function many(
  base: PluralBase,
  count: number,
  slots: Readonly<Record<string, string | number>> = {},
): string {
  const form = PLURAL.select(count) === 'one' ? 'one' : 'other';

  return filled(MW[`${base}_${form}`], { count, ...slots });
}

export function listed(words: readonly string[]): string {
  return LIST.format(words);
}

export const MESSAGE_STATES = [
  { key: 'first', name: 'Messages, first time' },
  { key: 'loading', name: 'Loading' },
  { key: 'inUse', name: 'Messages in use' },
  { key: 'conversation', name: 'A conversation' },
  { key: 'replyArrived', name: 'A reply arriving' },
  { key: 'answered', name: 'A reply answered' },
  { key: 'channelReply', name: 'A reply that came by a channel' },
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
  { key: 'checkAll', name: 'The check, All guests' },
  { key: 'checkNotReplied', name: 'The check, Not replied' },
  { key: 'checkChannels', name: 'The check, SMS off' },
  { key: 'noSubject', name: 'No subject' },
  { key: 'followUp', name: 'A follow-up' },
  { key: 'tellPlace', name: 'Tell guests, a new place' },
] as const;

export type MessagesState = (typeof MESSAGE_STATES)[number]['key'];

export function messagesStateOf(raw: string | null): MessagesState | null {
  return MESSAGE_STATES.find((one) => one.key === raw)?.key ?? null;
}

export const SAMPLE_EVENT = 'evt-wed-4';
export const MESSAGES_AT = `/demo/events/${SAMPLE_EVENT}/messages`;

export const MESSAGES_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Messages',
    states: MESSAGE_STATES.map((one) => ({
      to: `${MESSAGES_AT}?state=${one.key}`,
      name: one.name,
    })),
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
  GuestId | 'unknown' | 'parking' | 'invite' | `sched${string}` | `new${string}`;

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
  },
  lucia: {
    initials: 'LO',
    name: 'Lucía Ortega',
    contact: '+34 612 345 678',
    asked: 'Is there parking at The Landmark?',
    where: 'page',
    day: 'Today',
    at: '07:58',
    row: '07:58',
    toldBy: 'whatsApp',
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
};

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

export const PREVIEWED = {
  name: 'Kwame Mensah',
  language: 'English',
  has: ['email', 'sms'] as Channel[],
};

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

export type Condition = 'coming' | 'notReplied';
export type Audience = { kind: 'all' } | { kind: 'who'; conditions: readonly Condition[] };

export const CONDITIONS: readonly Condition[] = ['coming', 'notReplied'];
export const COMING: Audience = { kind: 'who', conditions: ['coming'] };
export const NOT_REPLIED: Audience = { kind: 'who', conditions: ['notReplied'] };

export function conditionWord(condition: Condition): string {
  return condition === 'coming' ? MW.isComing : MW.hasntReplied;
}

export function countOf(audience: Audience): number | null {
  if (audience.kind === 'all') return GUESTS_N;
  if (audience.conditions.length === 0) return null;
  if (audience.conditions.length > 1) return 0;

  return audience.conditions[0] === 'coming' ? 96 : 25;
}

export function audienceWords(audience: Audience): string {
  if (audience.kind === 'all') return MW.allGuests;

  return [MW.guestsWho, audience.conditions.map(conditionWord).join(', ')]
    .filter(Boolean)
    .join(' ');
}

export function chipWords(audience: Audience): string {
  const count = countOf(audience);

  return count == null || count === 0
    ? audienceWords(audience)
    : `${audienceWords(audience)} · ${NUMBER.format(count)}`;
}

export function toLine(audience: Audience): string {
  return audience.kind === 'all'
    ? MW.toAll
    : filled(MW.toAudience, { audience: audienceWords(audience) });
}

export function refusalOf(audience: Audience): string | null {
  if (audience.kind === 'who' && audience.conditions.length === 0) return MW.noCondition;

  return countOf(audience) === 0 ? MW.nobodyLine : null;
}

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
  const base =
    audience.kind === 'all'
      ? { counts: { email: 124, sms: 39, whatsApp: 4 }, cantTell: 9, names: [TOMAS, SOPHIE] }
      : audience.conditions[0] === 'notReplied' && audience.conditions.length === 1
        ? { counts: { email: 23, sms: 9, whatsApp: 1 }, cantTell: 1, names: [MEI] }
        : { counts: { email: 92, sms: 31, whatsApp: 3 }, cantTell: 2, names: [TOMAS, JOAQUIN] };
  const notReplied = audience.kind === 'who' && audience.conditions[0] === 'notReplied';
  const smsOff = !ticks.sms && ticks.email && !notReplied ? SMS_ONLY.length : 0;

  if (smsOff === 0) return { ...base, smsOff: 0 };

  return { ...base, cantTell: base.cantTell + smsOff, names: SMS_ONLY, smsOff };
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
}

/** The check before it goes (sc-3942, sc-3963): who is told and how, who cannot be, and the credits. */
export function checkOf(audience: Audience, ticks: Ticks): Check {
  const count = countOf(audience) ?? 0;
  const { counts, cantTell, names, smsOff } = figuresOf(audience, ticks);
  const on = CHANNELS.filter((channel) => ticks[channel]);
  const credits = (ticks.sms ? counts.sms : 0) + (ticks.whatsApp ? counts.whatsApp : 0);
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
  'delivered' | 'sent' | 'sending' | 'bounced' | 'notsent' | 'unconfirmed' | 'optout' | 'none';
export type Kind =
  'inProgress' | 'bounced' | 'notSent' | 'notConfirmed' | 'optedOut' | 'none' | 'cant';
export type Fix = 'fixEmail' | 'addEmail' | 'addPhone' | 'toldInPerson' | 'copyLink';

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
  updated?: string;
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
  person(
    'tomas',
    'Tomás Ferreira',
    'bounced',
    [bounced(`${MW.doesntExist} (5.1.1)`), NO_PHONE],
    ['fixEmail', 'addPhone'],
  ),
  person(
    'yuki',
    'Yuki Tanaka',
    'bounced',
    [bounced(`${MW.inboxFull} (4.2.2)`), NO_PHONE],
    ['fixEmail', 'addPhone'],
  ),
  person(
    'seun',
    'Oluwaseun Adebayo',
    'bounced',
    [bounced(`${MW.refusedIt} (5.7.1)`), NO_PHONE],
    ['fixEmail', 'addPhone'],
  ),
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
      [],
    ),
    person(
      'marta',
      'Marta Silva',
      'inProgress',
      [{ mark: 'sent', word: `${MW.email} · ${MW.sent}`, why: NOW }],
      [],
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
    person(
      'tomas',
      'Tomás Ferreira',
      'notSent',
      [{ mark: 'notsent', word: `${MW.email} · ${MW.notSent}`, why: MW.addressBouncing }, NO_PHONE],
      ['fixEmail', 'addPhone'],
    ),
    person('joaquin', 'Joaquín Ruiz', 'none', NOTHING, ['addEmail', 'addPhone', 'toldInPerson']),
  ],
};

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
}

export interface Answer {
  text: string;
  at: string;
  stage: 'sending' | 'told' | 'seen';
  seen?: string;
}

export type ReachedOf = 'parking' | 'invite' | 'new';

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
  arrived: ConvoId | null;
  matched: string | null;
  pane: Pane;
  draft: Draft | null;
  cancelled: boolean;
  outs: readonly Out[];
  scheds: readonly Sched[];
  unreached: readonly Unreached[];
  tomas: 'fixed' | 'sent' | null;
  resend: Ticks | null;
  untold: readonly Told[];
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
    arrived: null,
    matched: null,
    pane: { kind: 'idle' },
    draft: null,
    cancelled: false,
    outs: [],
    scheds: [SCHEDULED],
    unreached: PARKING_UNREACHED,
    tomas: null,
    resend: null,
    untold: [],
  };
  const open = (id: ConvoId) => ({ kind: 'convo', id }) as const;
  const parkingReached = { kind: 'reached', of: 'parking', thread: 'parking' } as const;

  switch (state) {
    case 'first':
      return { ...base, present: [] };
    case 'loading':
      return { ...base, loading: true };
    case 'conversation':
    case 'bell':
      return { ...base, pane: open('ines') };
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
    case 'fixed':
      return { ...base, pane: parkingReached, tomas: 'fixed' };
    case 'sentAgain':
      return { ...base, pane: parkingReached, tomas: 'sent' };
    case 'resend':
      return { ...base, pane: open('parking'), resend: TICKS };
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
      return { ...base, pane: open('sched') };
    case 'scheduledCancelled':
      return {
        ...base,
        pane: open('sched'),
        scheds: [{ ...SCHEDULED, cancelledAt: '09:46' }],
      };
    default:
      return base;
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
  arrived: boolean;
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
    when: arrived ? MW.now : answer != null ? answer.at : guest.row,
    lead: { kind: 'guest', initials: guest.initials, unread: !done },
    tag: null,
    arrived,
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
    arrived: false,
  };
}

export function outReach(out: Out): {
  count: number;
  reached: number;
  soFar: number;
  seen: number;
} {
  const count = countOf(out.to) ?? 0;

  return {
    count,
    reached: count - figuresOf(out.to, out.ticks).cantTell,
    soFar: out.soFar ?? Math.round(count * 0.4),
    seen: out.seen,
  };
}

export function outLine(out: Out): string {
  const reach = outReach(out);

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
  return { id, title, line, when, lead: { kind: 'many' }, tag, arrived: false };
}

function schedRow(sched: Sched): Row {
  if (sched.cancelledAt != null)
    return manyRow(
      sched.id,
      outTitle(sched),
      filled(MW.cancelledBy, { name: READER, time: sched.cancelledAt }).split('.')[0] ?? '',
      sched.cancelledAt,
      { kind: 'ended', word: MW.cancelledTag },
    );

  return manyRow(
    sched.id,
    outTitle(sched),
    `${toLine(sched.to)} · ${dayWords(sched.day)}, ${sched.time}`,
    '',
    { kind: 'notyet', word: MW.scheduled },
  );
}

export function rowOf(inbox: Inbox, id: ConvoId): Row {
  if (isGuest(id)) return guestRow(inbox, id);
  if (id === 'unknown') return unknownRow(inbox);

  const outs = outsIn(inbox, id);
  const last = outs.at(-1);
  const sched = inbox.scheds.find((one) => one.id === id);

  if (sched != null && last == null) return schedRow(sched);
  if (id === 'parking')
    return manyRow(
      id,
      PARKING.subject,
      last != null && busy(last)
        ? outLine(last)
        : `${MW.toAll} · ${many('didntGetIt', inbox.unreached.length)}`,
      last == null ? PARKING.row : last.at,
      inbox.unreached.length === 0
        ? null
        : { kind: 'waiting', word: filled(MW.notReached, { count: inbox.unreached.length }) },
    );
  if (id === 'invite')
    return manyRow(
      id,
      MW.invitation,
      last != null && busy(last)
        ? outLine(last)
        : `${MW.toAll} · ${filled(MW.reached, { count: INVITE_REACH.reached, total: INVITE_REACH.of })}`,
      last == null ? INVITE.row : last.at,
      null,
    );

  return threadRow(inbox, id);
}

function threadRow(inbox: Inbox, id: ConvoId): Row {
  const outs = outsIn(inbox, id);
  const first = outs[0];
  const last = outs.at(-1);

  if (first == null || last == null) {
    const to = inbox.draft?.to ?? { kind: 'all' };

    return manyRow(id, MW.newMessage, `${toLine(to)} · ${MW.notSentYet}`, NOW, null);
  }

  const title = outTitle(first);
  const missed = figuresOf(last.to, last.ticks).cantTell;

  if (last.stage === 'sent' && litOf(inbox) !== id && missed > 0)
    return manyRow(id, title, `${toLine(last.to)} · ${many('didntGetIt', missed)}`, last.at, {
      kind: 'waiting',
      word: filled(MW.notReached, { count: missed }),
    });

  const line = outs.length > 1 && busy(last) ? `${MW.followUp} · ${outLine(last)}` : outLine(last);

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

export function sectionsOf(inbox: Inbox): Sections {
  const here = (id: ConvoId) => inbox.present.includes(id);
  const lit = litOf(inbox);
  const top: Row[] = [];
  const needs: Row[] = [];
  const done: Row[] = [];

  for (const id of threadsOf(inbox)) {
    const last = outsIn(inbox, id).at(-1);
    const row = rowOf(inbox, id);

    if (id === lit || last == null || last.stage === 'countdown' || last.stage === 'sending')
      top.push(row);
    else if (row.tag != null) needs.push(row);
    else done.push(row);
  }

  const waiting: ConvoId[] = ['ines', 'lucia', 'kwame', 'unknown'];
  const arrived = inbox.arrived;

  if (arrived != null && here(arrived) && !inbox.done.includes(arrived))
    needs.push(rowOf(inbox, arrived));
  for (const id of waiting)
    if (id !== arrived && here(id) && !inbox.done.includes(id)) needs.push(rowOf(inbox, id));
  if (here('parking') && inbox.unreached.length > 0) needs.push(rowOf(inbox, 'parking'));

  const scheds = inbox.scheds.filter(
    (one) => (one.id !== 'sched' || here('sched')) && outsIn(inbox, one.id).length === 0,
  );

  done.push(...scheds.filter((one) => one.cancelledAt != null).map(schedRow));
  done.push(...inbox.done.filter(here).map((id) => rowOf(inbox, id)));
  if (here('parking') && inbox.unreached.length === 0) done.push(rowOf(inbox, 'parking'));
  if (here('invite')) done.push(rowOf(inbox, 'invite'));

  return {
    top,
    needs,
    scheduled: scheds.filter((one) => one.cancelledAt == null).map(schedRow),
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
  | { kind: 'answer'; id: GuestId | 'unknown'; text: string }
  | { kind: 'told'; id: GuestId | 'unknown' }
  | { kind: 'compose'; draft: Draft }
  | { kind: 'draft'; draft: Partial<Draft> }
  | { kind: 'go' }
  | { kind: 'tick' }
  | { kind: 'cancel' }
  | { kind: 'stage'; from: Stage; to: Stage }
  | { kind: 'reached'; of: ReachedOf; thread: ConvoId }
  | { kind: 'toldInPerson'; id: string }
  | { kind: 'tomas'; tomas: Inbox['tomas'] }
  | { kind: 'resend'; resend: Ticks | null }
  | { kind: 'untold'; untold: readonly Told[] }
  | { kind: 'match'; name: string }
  | { kind: 'schedule'; day: string; time: string }
  | { kind: 'resched'; id: ConvoId; sched: Partial<Sched> }
  | { kind: 'sendNow'; id: ConvoId };

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
    case 'open':
      return {
        ...inbox,
        pane: { kind: 'convo', id: change.id },
        cancelled: false,
        resend: change.id === 'parking' ? inbox.resend : null,
      };
    case 'idle':
      return { ...inbox, pane: { kind: 'idle' }, draft: null, cancelled: false };
    case 'arrive':
      return {
        ...inbox,
        present: inbox.present.includes(change.id) ? inbox.present : [...inbox.present, change.id],
        done: inbox.done.filter((id) => id !== change.id),
        arrived: change.id,
      };
    case 'settle':
      return { ...inbox, arrived: null };
    case 'done':
      return {
        ...inbox,
        done: [change.id, ...inbox.done.filter((id) => id !== change.id)],
        doneAt: { ...inbox.doneAt, [change.id]: change.at },
        arrived: inbox.arrived === change.id ? null : inbox.arrived,
      };
    case 'waiting':
      return { ...inbox, done: inbox.done.filter((id) => id !== change.id) };
    case 'answer':
      return {
        ...inbox,
        answers: {
          ...inbox.answers,
          [change.id]: [
            ...(inbox.answers[change.id] ?? []),
            { text: change.text, at: NOW, stage: 'sending' },
          ],
        },
      };
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
    case 'toldInPerson':
      return { ...inbox, unreached: inbox.unreached.filter((one) => one.id !== change.id) };
    case 'tomas':
      return { ...inbox, tomas: change.tomas };
    case 'resend':
      return { ...inbox, resend: change.resend };
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
  credits: 34,
  movedTo: '2026-11-05T17:30:00Z',
};
