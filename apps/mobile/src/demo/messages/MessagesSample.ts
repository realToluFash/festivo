import { CHANNEL_WORD, type ChannelKey, W, say } from './MessagesWords.ts';
import { TOKEN_RUN, TOKEN_SPLIT, tokenText } from './TokenText.ts';

/** Events A's shared sample, with the guests and counts the Messaging B boards made up (spec §8); nothing here is spec. */
export const EVENT = 'Adaeze & Tunde’s wedding';
export const HOSTS = 'Adaeze Obi and Tunde Bakare';
export const ORG = 'Ire Events';
export const READER = 'Folake Adeyemi';
export const NOW = '09:41';
export const BALANCE = 1500;
export const SAMPLE_EVENT_ID = 'evt-wed-4';

/** The sample's days, as the event's wall dates in London; the screens format them in the reader's locale. */
export const DAYS = {
  invite: '2026-10-12',
  inviteSeen: '2026-10-13',
  marta: '2026-10-31',
  parking: '2026-11-02',
  today: '2026-11-03',
  sched: '2026-11-05',
  ends: '2026-11-07',
};

export type Where = 'page' | ChannelKey;
export type GuestKey = 'ines' | 'lucia' | 'kwame' | 'unknown' | 'marta';
export type PersonKey =
  | 'tomas'
  | 'yuki'
  | 'seun'
  | 'amaka'
  | 'priyanka'
  | 'sophie'
  | 'lars'
  | 'fatima'
  | 'diego'
  | 'joaquin'
  | 'mei'
  | 'kwame'
  | 'marta'
  | 'ines';
export type ManyKey = 'parking' | 'invite';
export type ToGroup = 'all' | 'coming' | 'notReplied';
export type Token = 'Greeting' | 'Event' | 'Date' | 'Hosts';

export const TOKENS: readonly Token[] = ['Greeting', 'Event', 'Date', 'Hosts'];

export interface SampleGuest {
  initials: string;
  name: string;
  channel: ChannelKey;
  /** Their address and language, shown under the name with guests.manage. */
  head: string;
  asked: { text: string; where: Where; day: string; time: string };
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
      day: DAYS.today,
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
      day: DAYS.today,
      time: '07:58',
    },
  },
  kwame: {
    initials: 'KM',
    name: 'Kwame Mensah',
    channel: 'sms',
    head: '+44 7700 900412 · English',
    asked: { text: 'What is the dress code?', where: 'sms', day: DAYS.parking, time: '21:14' },
  },
  unknown: {
    initials: '?',
    name: 'm.dubois@orange.fr',
    channel: 'email',
    head: 'm.dubois@orange.fr',
    asked: {
      text: 'Camille and I will both be there. Marc',
      where: 'email',
      day: DAYS.parking,
      time: '21:05',
    },
  },
  marta: {
    initials: 'MS',
    name: 'Marta Silva',
    channel: 'email',
    head: 'marta.silva@gmail.com',
    asked: { text: 'Thank you, see you Thursday!', where: 'page', day: DAYS.marta, time: '' },
  },
};

export const ANSWERS: Partial<Record<GuestKey, string>> = {
  ines: 'Of course. We will set a place for your son at your table.',
  kwame: 'Formal: suits and long dresses are welcome.',
};

export const PARKING = 'Parking at The Landmark';
export const PARKING_TIME = '18:20';
export const INVITE_TIME = '10:00';
export const PARKING_BODY = `${tokenText('Greeting')}, parking is on Marylebone Road. The car park entrance is on Melcombe Place.`;
export const SCHEDULED = 'On the day: where to find us';
export const SCHEDULED_BODY = `${tokenText('Greeting')}, we start at 18:00 at The Landmark, 222 Marylebone Road. The doors open at 17:30.`;
export const SCHEDULED_AT = 'Thu, Nov 5, 09:00';
export const SUBJECT = 'Parking and the dress code';
export const BODY = `${tokenText('Greeting')}, a few things before Thursday. Parking is on Marylebone Road, and the dress code is formal. If anything changes for you, answer here.`;

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
  all: { count: 142, email: 124, sms: 39, wa: 4, cantTell: 9 },
  coming: { count: 96, email: 92, sms: 31, wa: 3, cantTell: 2 },
  notReplied: { count: 25, email: 23, sms: 9, wa: 1, cantTell: 1 },
};

export const CANT_TELL: Record<ToGroup, readonly string[]> = {
  all: [
    `Tomás Ferreira · ${W.addressBouncing} · ${W.noPhone}`,
    `Sophie Laurent · ${W.unsubscribed} · ${W.textedStop}`,
  ],
  coming: [
    `Tomás Ferreira · ${W.addressBouncing} · ${W.noPhone}`,
    `Joaquín Ruiz · ${W.noEmail} · ${W.noPhone}`,
  ],
  notReplied: [`Mei Lin Chen · ${W.noEmail} · ${W.noPhone}`],
};

/** Guests told only by SMS: with SMS off they can't be told (the boards count Coming's two). */
export const SMS_ONLY: Record<ToGroup, readonly string[]> = {
  all: [`Amaka Eze · ${W.noEmail} · ${W.smsOff}`, `Priyanka Nair · ${W.noEmail} · ${W.smsOff}`],
  coming: [`Amaka Eze · ${W.noEmail} · ${W.smsOff}`, `Priyanka Nair · ${W.noEmail} · ${W.smsOff}`],
  notReplied: [],
};

export type MarkKey =
  'delivered' | 'sent' | 'sending' | 'bounced' | 'notsent' | 'unconfirmed' | 'optout' | 'none';

export interface ReachPart {
  mark: MarkKey;
  word: string;
  count: number;
}

export const REACH: readonly ReachPart[] = [
  { mark: 'delivered', word: W.reachedWord, count: 131 },
  { mark: 'bounced', word: W.bounced3, count: 3 },
  { mark: 'unconfirmed', word: W.notConfirmed2, count: 2 },
  { mark: 'optout', word: W.optedOut, count: 4 },
  { mark: 'none', word: W.noEmailOrPhone, count: 2 },
];

export const PARKING_REACH = {
  reached: 131,
  of: 142,
  seen: 87,
  notReached: 11,
};

export interface ReachLine {
  mark: MarkKey;
  word: string;
  reason?: string;
}

export interface NotReached {
  key: PersonKey;
  bounced?: string;
  initials: string;
  name: string;
  lines: readonly ReachLine[];
  fixes: readonly string[];
  updated?: string;
}

const PAGE_LINE: ReachLine = { mark: 'none', word: W.theirPage, reason: W.notSeenYet };

const bounced = (reason: string): readonly ReachLine[] => [
  { mark: 'bounced', word: say.where(CHANNEL_WORD.email, W.bounced), reason },
  { mark: 'none', word: CHANNEL_WORD.sms, reason: W.noPhone },
  PAGE_LINE,
];
const UNCONFIRMED: readonly ReachLine[] = [
  { mark: 'unconfirmed', word: say.where(CHANNEL_WORD.sms, W.sent), reason: W.notConfirmed },
  { mark: 'none', word: CHANNEL_WORD.email, reason: W.noEmail },
  PAGE_LINE,
];
const NEITHER: readonly ReachLine[] = [
  { mark: 'none', word: W.noEmail },
  { mark: 'none', word: W.noPhone },
  PAGE_LINE,
];
const EMAIL_OUT: ReachLine = {
  mark: 'optout',
  word: say.where(CHANNEL_WORD.email, W.notSent),
  reason: W.unsubscribed,
};
const SMS_OUT: ReachLine = {
  mark: 'optout',
  word: say.where(CHANNEL_WORD.sms, W.notSent),
  reason: W.textedStop,
};

export interface ReachGroup {
  word: string;
  people: readonly NotReached[];
}

/** All eleven not reached, grouped as sc-3966 counts them (Messaging-B-Phone-3). */
export const PARKING_GROUPS: readonly ReachGroup[] = [
  {
    word: W.bounced3,
    people: [
      {
        key: 'tomas',
        initials: 'TF',
        name: 'Tomás Ferreira',
        bounced: 'tomas.ferreira@gmial.com',
        lines: bounced(W.doesntExist),
        fixes: [W.fixEmail, W.addPhone],
      },
      {
        key: 'yuki',
        initials: 'YT',
        name: 'Yuki Tanaka',
        bounced: 'yuki.tanaka@docomo.ne.jp',
        lines: bounced(W.inboxFull),
        fixes: [W.fixEmail, W.addPhone],
      },
      {
        key: 'seun',
        initials: 'OA',
        name: 'Oluwaseun Adebayo',
        bounced: 'seun.adebayo@yahoo.com',
        lines: bounced(W.serviceRefused),
        fixes: [W.fixEmail, W.addPhone],
      },
    ],
  },
  {
    word: W.notConfirmed2,
    people: [
      {
        key: 'amaka',
        initials: 'AE',
        name: 'Amaka Eze',
        lines: UNCONFIRMED,
        fixes: [W.toldInPerson],
      },
      {
        key: 'priyanka',
        initials: 'PN',
        name: 'Priyanka Nair',
        lines: UNCONFIRMED,
        fixes: [W.toldInPerson],
      },
    ],
  },
  {
    word: W.optedOut,
    people: [
      {
        key: 'sophie',
        initials: 'SL',
        name: 'Sophie Laurent',
        lines: [EMAIL_OUT, SMS_OUT, PAGE_LINE],
        fixes: [W.toldInPerson],
      },
      {
        key: 'lars',
        initials: 'LJ',
        name: 'Lars Johansson',
        lines: [EMAIL_OUT, { mark: 'none', word: CHANNEL_WORD.sms, reason: W.noPhone }, PAGE_LINE],
        fixes: [W.addPhone, W.toldInPerson],
      },
      {
        key: 'fatima',
        initials: 'FE',
        name: 'Fatima Zahra El Idrissi',
        lines: [SMS_OUT, { mark: 'none', word: CHANNEL_WORD.email, reason: W.noEmail }, PAGE_LINE],
        fixes: [W.addEmail, W.toldInPerson],
      },
      {
        key: 'diego',
        initials: 'DH',
        name: 'Diego Herrera',
        lines: [EMAIL_OUT, SMS_OUT, PAGE_LINE],
        fixes: [W.toldInPerson],
      },
    ],
  },
  {
    word: W.noEmailOrPhone,
    people: [
      {
        key: 'joaquin',
        initials: 'JR',
        name: 'Joaquín Ruiz',
        lines: NEITHER,
        fixes: [W.addEmail, W.addPhone, W.toldInPerson],
      },
      {
        key: 'mei',
        initials: 'MC',
        name: 'Mei Lin Chen',
        lines: NEITHER,
        fixes: [W.addEmail, W.addPhone, W.toldInPerson],
      },
    ],
  },
];

export const NOT_REACHED: readonly NotReached[] = PARKING_GROUPS.flatMap((group) => group.people);

const NOT_INVITED: readonly ReachLine[] = [
  { mark: 'none', word: W.noEmail },
  { mark: 'none', word: W.noPhone },
  { mark: 'none', word: W.theirInvitation, reason: W.notYetInvited },
];

export const INVITE_GROUPS: readonly ReachGroup[] = [
  {
    word: W.noEmailOrPhone,
    people: [
      {
        key: 'joaquin',
        initials: 'JR',
        name: 'Joaquín Ruiz',
        lines: NOT_INVITED,
        fixes: [W.addEmail, W.addPhone, W.copyLink],
      },
      {
        key: 'mei',
        initials: 'MC',
        name: 'Mei Lin Chen',
        lines: NOT_INVITED,
        fixes: [W.addEmail, W.addPhone, W.copyLink],
      },
    ],
  },
];

export const SENDING_GROUPS: readonly ReachGroup[] = [
  {
    word: W.inProgress,
    people: [
      {
        key: 'kwame',
        initials: 'KM',
        name: 'Kwame Mensah',
        lines: [
          { mark: 'sending', word: CHANNEL_WORD.email, reason: W.sending },
          { mark: 'sent', word: say.where(CHANNEL_WORD.sms, W.sent), reason: '09:41' },
          PAGE_LINE,
        ],
        fixes: [],
      },
      {
        key: 'marta',
        initials: 'MS',
        name: 'Marta Silva',
        lines: [
          { mark: 'sent', word: say.where(CHANNEL_WORD.email, W.sent), reason: '09:41' },
          PAGE_LINE,
        ],
        fixes: [],
      },
    ],
  },
  {
    word: W.reachedWord,
    people: [
      {
        key: 'ines',
        initials: 'ID',
        name: 'Inês Duarte',
        lines: [
          { mark: 'delivered', word: say.where(CHANNEL_WORD.email, W.delivered), reason: '09:41' },
          { mark: 'delivered', word: W.theirPage, reason: say.seenAt('09:42') },
        ],
        fixes: [],
      },
    ],
  },
  {
    word: W.cantBeTold,
    people: [
      {
        key: 'tomas',
        initials: 'TF',
        name: 'Tomás Ferreira',
        bounced: 'tomas.ferreira@gmial.com',
        lines: [
          {
            mark: 'notsent',
            word: say.where(CHANNEL_WORD.email, W.notSent),
            reason: W.addressBouncing,
          },
          { mark: 'none', word: CHANNEL_WORD.sms, reason: W.noPhone },
          PAGE_LINE,
        ],
        fixes: [W.fixEmail, W.addPhone],
      },
      {
        key: 'joaquin',
        initials: 'JR',
        name: 'Joaquín Ruiz',
        lines: NEITHER,
        fixes: [W.addEmail, W.addPhone, W.toldInPerson],
      },
    ],
  },
];

export const SENDING_REACH = {
  reached: 38,
  of: 96,
  inProgress: 56,
  cantTell: 2,
  seen: 3,
  more: 54,
};
export const SENT_AGAIN_AT = '09:44';

export const MATCHES: readonly { name: string; line: string }[] = [
  { name: 'Camille Dubois', line: 'camille.dubois@orange.fr' },
  { name: 'Claude Dubois', line: W.noEmail },
  { name: 'Duboise Akande', line: '+234 802 555 0199' },
];

export const SCHEDULE_AT = { date: DAYS.sched, time: '09:00' };
export const EVENT_ENDS = { at: '2026-11-07T15:00:00Z', date: DAYS.ends, time: '15:00' };
export const READER_NOW = '2026-11-03T09:41:00Z';
export const CANCELLED_AT = '09:46';
export const FOLLOW_UP = 'Also: the car park closes at 23:30, so plan your way home.';

export const FIXED_ADDRESS = 'tomas.ferreira@gmail.com';
export const PLACE = {
  name: 'Rosewood London',
  address: '252 High Holborn, London WC1V 7EN',
  place: 'Rosewood London, London',
};

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

/** A message's words with each inserted token named, so a bubble can draw it as a chip; typed braces stay words. */
export function piecesOf(text: string): { token: boolean; text: string }[] {
  return text
    .split(TOKEN_SPLIT)
    .filter((piece) => piece !== '')
    .map((piece) =>
      TOKEN_SPLIT.test(piece)
        ? { token: true, text: piece.slice(1, -1) }
        : { token: false, text: piece },
    );
}

const FILLED: Record<Token, (name: string) => string> = {
  Greeting: (name) => name,
  Event: () => EVENT,
  Date: () => 'Thursday, Nov 5',
  Hosts: () => HOSTS,
};

/** As one guest's page shows it: each token filled in for them. */
export function filledFor(text: string, name: string): string {
  return text.replace(TOKEN_RUN, (_, token: Token) => FILLED[token](name));
}
