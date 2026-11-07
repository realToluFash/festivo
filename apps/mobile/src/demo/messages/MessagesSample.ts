import { type ChannelKey, W, say } from './MessagesWords.ts';

/** Events A's shared sample, with the guests and counts the Messaging B boards made up (spec §8); nothing here is spec. */
export const EVENT = 'Adaeze & Tunde’s wedding';
export const HOSTS = 'Adaeze Obi and Tunde Bakare';
export const ORG = 'Ire Events';
export const READER = 'Folake Adeyemi';
export const NOW = '09:41';
export const BALANCE = 1500;
export const SAMPLE_EVENT_ID = 'evt-wed-4';

export type Where = 'page' | ChannelKey;
export type GuestKey = 'ines' | 'lucia' | 'kwame' | 'unknown' | 'marta';
export type PersonKey = 'tomas' | 'amaka' | 'joaquin' | 'sophie';
export type ManyKey = 'parking' | 'invite' | 'sched';
export type ToGroup = 'all' | 'coming' | 'notReplied';
export type Token = 'Greeting' | 'Event' | 'Date' | 'Hosts';

export const TOKENS: readonly Token[] = ['Greeting', 'Event', 'Date', 'Hosts'];

export interface SampleGuest {
  initials: string;
  name: string;
  channel: ChannelKey;
  /** Their address and language, shown under the name with guests.manage. */
  head: string;
  asked: { text: string; where: Where; row: string; time: string };
}

export const GUESTS: Record<GuestKey, SampleGuest> = {
  ines: {
    initials: 'ID',
    name: 'Inês Duarte',
    channel: 'email',
    head: 'ines.duarte@sapo.pt · Portuguese',
    asked: {
      text: 'Can we bring our son? Our sitter cancelled for Thursday.',
      where: 'page',
      row: '08:12',
      time: '08:12',
    },
  },
  lucia: {
    initials: 'LO',
    name: 'Lucía Ortega',
    channel: 'wa',
    head: '+34 612 345 678 · Spanish',
    asked: {
      text: 'Is there parking at The Landmark?',
      where: 'page',
      row: '07:58',
      time: '07:58',
    },
  },
  kwame: {
    initials: 'KM',
    name: 'Kwame Mensah',
    channel: 'sms',
    head: '+44 7700 900412 · English',
    asked: { text: 'What is the dress code?', where: 'sms', row: 'Mon', time: '21:14' },
  },
  unknown: {
    initials: '?',
    name: 'm.laurent@orange.fr',
    channel: 'email',
    head: 'm.laurent@orange.fr',
    asked: {
      text: 'Sophie and I will both be there. Marc',
      where: 'email',
      row: 'Mon',
      time: 'Mon',
    },
  },
  marta: {
    initials: 'MS',
    name: 'Marta Silva',
    channel: 'email',
    head: 'marta.silva@gmail.com',
    asked: { text: 'Thank you, see you Thursday!', where: 'page', row: 'Sat', time: 'Sat' },
  },
};

export const ANSWERS: Partial<Record<GuestKey, string>> = {
  ines: 'Of course. We will set a place for your son at your table.',
  kwame: 'Formal: suits and long dresses are welcome.',
};

export const PARKING = 'Parking at The Landmark';
export const PARKING_BODY =
  '{Greeting}, parking is on Marylebone Road. The car park entrance is on Melcombe Place.';
export const SCHEDULED = 'On the day: where to find us';
export const SCHEDULED_BODY =
  '{Greeting}, we start at 18:00 at The Landmark, 222 Marylebone Road. The doors open at 17:30.';
export const SCHEDULED_AT = 'Thu, Nov 5, 09:00';
export const SUBJECT = 'Parking and the dress code';
export const BODY =
  '{Greeting}, a few things before Thursday. Parking is on Marylebone Road, and the dress code is formal. If anything changes for you, answer here.';

export const TO_WORD: Record<ToGroup, string> = {
  all: W.allGuests,
  coming: W.coming,
  notReplied: W.hasntReplied,
};

export const TO_ORDER: readonly ToGroup[] = ['all', 'coming', 'notReplied'];

/** Who each To reaches before sending. Coming is the boards'; All guests' and Hasn't replied's channel counts are made up for the demo. */
export const TO_FIGURES: Record<
  ToGroup,
  { count: number; email: number; sms: number; wa: number; cantTell: number }
> = {
  all: { count: 142, email: 134, sms: 33, wa: 4, cantTell: 6 },
  coming: { count: 96, email: 92, sms: 31, wa: 3, cantTell: 2 },
  notReplied: { count: 25, email: 25, sms: 8, wa: 1, cantTell: 0 },
};

export const CANT_TELL: readonly string[] = [
  `Tomás Ferreira · ${W.addressBouncing} · ${W.noPhone}`,
  `Joaquín Ruiz · ${W.noEmail} · ${W.noPhone}`,
];

export type MarkKey =
  'delivered' | 'sent' | 'sending' | 'bounced' | 'notsent' | 'unconfirmed' | 'optout' | 'none';

export interface ReachPart {
  mark: MarkKey;
  word: string;
  count: number;
}

export const REACH: readonly ReachPart[] = [
  { mark: 'delivered', word: 'Reached', count: 131 },
  { mark: 'bounced', word: 'Bounced', count: 3 },
  { mark: 'unconfirmed', word: 'Not confirmed', count: 2 },
  { mark: 'optout', word: 'Opted out', count: 4 },
  { mark: 'none', word: 'No email or phone', count: 2 },
];

export const PARKING_REACH = {
  reached: 131,
  of: 142,
  seen: 87,
  line: '3 bounced · 2 not confirmed · 4 opted out · 2 no email or phone',
  notReached: 11,
};

export interface ReachLine {
  mark: MarkKey;
  word: string;
  reason?: string;
}

export interface NotReached {
  key: PersonKey;
  initials: string;
  name: string;
  lines: readonly ReachLine[];
  fixes: readonly string[];
}

const PAGE_LINE: ReachLine = { mark: 'none', word: W.theirPage, reason: W.notSeenYet };

export const NOT_REACHED: readonly NotReached[] = [
  {
    key: 'tomas',
    initials: 'TF',
    name: 'Tomás Ferreira',
    lines: [
      { mark: 'bounced', word: 'Email · Bounced', reason: W.doesntExist },
      { mark: 'none', word: 'SMS', reason: W.noPhone },
      PAGE_LINE,
    ],
    fixes: [W.fixEmail, W.addPhone],
  },
  {
    key: 'amaka',
    initials: 'AE',
    name: 'Amaka Eze',
    lines: [{ mark: 'unconfirmed', word: 'SMS · Sent', reason: W.notConfirmed }, PAGE_LINE],
    fixes: [W.toldInPerson],
  },
  {
    key: 'joaquin',
    initials: 'JR',
    name: 'Joaquín Ruiz',
    lines: [{ mark: 'none', word: W.noEmail }, { mark: 'none', word: W.noPhone }, PAGE_LINE],
    fixes: [W.addEmail, W.addPhone, W.toldInPerson],
  },
  {
    key: 'sophie',
    initials: 'SL',
    name: 'Sophie Laurent',
    lines: [
      { mark: 'optout', word: 'Email · Not sent', reason: W.unsubscribed },
      { mark: 'optout', word: 'SMS · Not sent', reason: W.textedStop },
      PAGE_LINE,
    ],
    fixes: [W.toldInPerson],
  },
];

export const BOUNCED_ADDRESS = 'tomas.ferreira@gmial.com';
export const FIXED_ADDRESS = 'tomas.ferreira@gmail.com';

export const RESEND = {
  count: 3,
  unconfirmed: 2,
  stillCant: 8,
  names: [
    `Joaquín Ruiz · ${W.noEmail} · ${W.noPhone}`,
    `Sophie Laurent · ${W.unsubscribed} · ${W.textedStop}`,
  ],
  credits: 2,
};

export const TELL = {
  count: 130,
  email: 128,
  sms: 30,
  wa: 4,
  cannot: 2,
  credits: 34,
  now: '17:30',
  was: '18:00',
  startsAt: '2026-11-05T17:30:00Z',
};

export const INVITATION = {
  reached: 140,
  of: 142,
  seen: 121,
  lines: [
    say.dear('Kwame Mensah'),
    say.invitedTo(EVENT, 'Thursday, Nov 5'),
    say.replyBy('Friday, Oct 30'),
    W.invitationReplies,
  ],
};

export const PREVIEW = {
  name: 'Kwame Mensah',
  language: 'English',
  cover: 'Thu, Nov 5 · 6:00 PM · The Landmark',
  link: '[their own link]',
};

export const BELL = {
  push: `${say.newReplies(4)} · ${EVENT}`,
  change: 'Ana Souza changed the event',
};

export function formatCount(count: number): string {
  return count.toLocaleString('en-US');
}

/** A message's words with each `{Token}` named, so a bubble can draw the token as a chip. */
export function piecesOf(text: string): { token: boolean; text: string }[] {
  return text
    .split(/(\{[A-Za-z]+\})/u)
    .filter((piece) => piece !== '')
    .map((piece) => {
      const token = /^\{([A-Za-z]+)\}$/u.exec(piece)?.[1];

      return token == null ? { token: false, text: piece } : { token: true, text: token };
    });
}

const FILLED: Record<Token, (name: string) => string> = {
  Greeting: (name) => name,
  Event: () => EVENT,
  Date: () => 'Thursday, Nov 5',
  Hosts: () => HOSTS,
};

/** As one guest's page shows it: each token filled in for them. */
export function filledFor(text: string, name: string): string {
  return text.replace(/\{(Greeting|Event|Date|Hosts)\}/gu, (_, token: Token) =>
    FILLED[token](name),
  );
}

export const TO_ALL = 'To all guests';
