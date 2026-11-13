import { CHANNEL_WORD, type ChannelKey, W, say } from './MessagesWords.ts';
import { TOKEN_SPLIT, tokenText } from './TokenText.ts';

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
export type GuestKey = 'ines' | 'lucia' | 'kwame' | 'unknown' | 'marta' | 'valentina';
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
  | 'ines'
  | 'lucia'
  | 'duboise'
  | 'rafael';
export type ManyKey = 'parking' | 'invite' | 'receipts' | 'change';
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
  valentina: {
    initials: 'VR',
    name: 'Valentina Restrepo',
    channel: 'wa',
    head: '+57 310 555 0142 · Spanish',
    asked: {
      text: 'Is there a shuttle from the hotel on Thursday?',
      where: 'wa',
      day: DAYS.parking,
      time: '23:52',
    },
  },
};

export const ANSWERS: Partial<Record<GuestKey, string>> = {
  ines: 'Of course. We will set a place for your son at your table.',
  kwame: 'Formal: suits and long dresses are welcome.',
  lucia: 'Yes: free parking under the hotel, entrance on Calle Mayor.',
  valentina: 'Yes. It leaves the hotel at 17:00 and again at 17:30.',
};

/** What Soirely's notice to each guest costs, by channel: sc-3928's table for their number's country, an SMS by the part (sc-3946). */
export const NOTICE_CREDITS: Partial<Record<GuestKey, Partial<Record<ChannelKey, number>>>> = {
  lucia: { wa: 4, sms: 14 },
  kwame: { sms: 9 },
  valentina: { wa: 2 },
};

/** The channels besides their own that could carry each guest's notice (sc-3976): Lucía has an address and agreed to texts. */
export const OTHER_CHANNELS: Partial<Record<GuestKey, readonly ChannelKey[]>> = {
  lucia: ['email', 'sms'],
};

/** The balance in `noticeWaits` and `noticeNotSent`: under the 4 credits Lucía's WhatsApp notice needs. */
export const LOW_BALANCE = 2;

/** `noticeNotSent`: Lucía's earlier question, and the answer whose WhatsApp notice was held 48 hours for credits. */
export const HELD_TOO_LONG = {
  day: '2026-11-01',
  asked: 'Is there a vegetarian menu?',
  askedAt: '08:02',
  answer: 'Yes. Tell us on your page and the kitchen will plan for it.',
  answeredAt: '08:30',
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

/** The wedding moved back to September, so it finished more than 30 days before the reader's Nov 3. */
export const LONG_FINISHED = {
  startsAt: '2026-09-19T14:00:00Z',
  endsAt: '2026-09-20T01:00:00Z',
  concludedAt: '2026-09-20T01:00:00Z',
} as const;

/** Over the Subject's 150: 168 characters, pasted from the hosts' own notes. */
export const LONG_SUBJECT =
  'Parking, the dress code, the shuttle from Baker Street, the order of the day on Thursday and Saturday, and what to do if your train is late or the venue is hard to find';

const PROGRAMME_LINE =
  'Thursday at 18:00 the ceremony begins at The Landmark; the doors open at 17:30, and the shuttle leaves Baker Street every fifteen minutes from 17:00.';

/** Over the Message's 10,000: the programme pasted in, 72 times over. */
export const LONG_BODY = [BODY, ...Array.from({ length: 72 }, () => PROGRAMME_LINE)].join('\n\n');

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
  tellable?: boolean;
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

export type GroupKey =
  'inProgress' | 'bounced' | 'notConfirmed' | 'optedOut' | 'none' | 'cant' | 'reached';

export interface ReachGroup {
  key: GroupKey;
  mark: MarkKey;
  word: string;
  people: readonly NotReached[];
}

/** All eleven not reached, grouped as sc-3966 counts them (Messaging-B-Phone-3). */
export const PARKING_GROUPS: readonly ReachGroup[] = [
  {
    key: 'bounced',
    mark: 'bounced',
    word: W.bounced3,
    people: [
      {
        key: 'tomas',
        initials: 'TF',
        name: 'Tomás Ferreira',
        bounced: 'tomas.ferreira@gmial.com',
        lines: bounced(W.doesntExist),
        fixes: [W.fixEmail, W.addPhone, W.toldInPerson],
      },
      {
        key: 'yuki',
        initials: 'YT',
        name: 'Yuki Tanaka',
        tellable: true,
        bounced: 'yuki.tanaka@docomo.ne.jp',
        lines: bounced(W.inboxFull),
        fixes: [W.fixEmail, W.addPhone, W.toldInPerson],
      },
      {
        key: 'seun',
        initials: 'OA',
        name: 'Oluwaseun Adebayo',
        bounced: 'seun.adebayo@yahoo.com',
        lines: bounced(W.serviceRefused),
        fixes: [W.fixEmail, W.addPhone, W.toldInPerson],
      },
    ],
  },
  {
    key: 'notConfirmed',
    mark: 'unconfirmed',
    word: W.notConfirmed2,
    people: [
      {
        key: 'amaka',
        initials: 'AE',
        name: 'Amaka Eze',
        tellable: true,
        lines: UNCONFIRMED,
        fixes: [W.toldInPerson],
      },
      {
        key: 'priyanka',
        initials: 'PN',
        name: 'Priyanka Nair',
        tellable: true,
        lines: UNCONFIRMED,
        fixes: [W.toldInPerson],
      },
    ],
  },
  {
    key: 'optedOut',
    mark: 'optout',
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
    key: 'none',
    mark: 'none',
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

/** Two of the 131 reached, drawn under Filter: Reached; the rest are counted. */
export const PARKING_REACHED: readonly NotReached[] = [
  {
    key: 'ines',
    initials: 'ID',
    name: 'Inês Duarte',
    lines: [
      { mark: 'delivered', word: say.where(CHANNEL_WORD.email, W.delivered), reason: '09:12' },
      { mark: 'delivered', word: W.theirPage, reason: say.seenAt('09:20') },
    ],
    fixes: [],
  },
  {
    key: 'kwame',
    initials: 'KM',
    name: 'Kwame Mensah',
    lines: [
      { mark: 'delivered', word: say.where(CHANNEL_WORD.sms, W.delivered), reason: '09:13' },
      PAGE_LINE,
    ],
    fixes: [],
  },
];

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

/** The sample guests who agreed to WhatsApp, by their number. */
export const WHATSAPP_NUMBERS: Partial<Record<PersonKey, string>> = {
  lucia: '+34 612 345 678',
  kwame: '+44 7700 900412',
  duboise: '+234 802 555 0199',
  rafael: '+55 21 99555 0142',
};

/** WhatsApp's credits for these guests: each one's number at its country's rate, summed. */
export function whatsAppCreditsFor(keys: readonly PersonKey[]): number {
  return keys.reduce((sum, key) => sum + whatsAppCredits(WHATSAPP_NUMBERS[key] ?? ''), 0);
}

/** WhatsApp per To (sc-3950): the guests it reaches, and why the rest can't be. */
export const WHATSAPP: Record<
  ToGroup,
  { reaches: readonly PersonKey[]; noMobile: number; stopped: number; notAgreed: number }
> = {
  all: {
    reaches: ['lucia', 'kwame', 'duboise', 'rafael'],
    noMobile: 102,
    stopped: 2,
    notAgreed: 34,
  },
  coming: { reaches: ['lucia', 'kwame', 'rafael'], noMobile: 65, stopped: 1, notAgreed: 27 },
  notReplied: { reaches: ['duboise'], noMobile: 16, stopped: 0, notAgreed: 8 },
};

/** Parking told by email and WhatsApp, for WhatsApp's receipts. */
export const RECEIPTS = { reached: 124, of: 142, seen: 87, cant: 18, emailAt: '18:21' };

const WA = CHANNEL_WORD.wa;
/** Boards v515: nothing held, so WhatsApp went with the email, 18:20 to 18:24. */
const RECEIPT: Partial<Record<PersonKey, ReachLine>> = {
  lucia: { mark: 'sent', word: say.where(WA, W.sent), reason: '18:20' },
  duboise: { mark: 'delivered', word: say.where(WA, W.delivered), reason: '18:21' },
  kwame: { mark: 'delivered', word: say.where(WA, W.read), reason: '18:24' },
  rafael: { mark: 'bounced', word: say.where(WA, W.failedReceipt) },
};
const RECEIPTS_FOR: readonly (readonly [PersonKey, string, string])[] = [
  ['lucia', 'LO', 'Lucía Ortega'],
  ['duboise', 'DA', 'Duboise Akande'],
  ['kwame', 'KM', 'Kwame Mensah'],
  ['rafael', 'RC', 'Rafael Costa'],
];

/** The four told by WhatsApp: their email delivered, and WhatsApp's receipt. */
export function receiptPeople(): readonly NotReached[] {
  return RECEIPTS_FOR.map(([key, initials, name]) => ({
    key,
    initials,
    name,
    lines: [
      {
        mark: 'delivered',
        word: say.where(CHANNEL_WORD.email, W.delivered),
        reason: RECEIPTS.emailAt,
      },
      RECEIPT[key] ?? { mark: 'sent', word: say.where(WA, W.sent) },
    ],
    fixes: [],
  }));
}

/** Two of the 18 not reached on any channel, each with WhatsApp's reason. */
export const RECEIPTS_CANT: readonly NotReached[] = [
  {
    key: 'amaka',
    initials: 'AE',
    name: 'Amaka Eze',
    lines: [
      { mark: 'none', word: W.noEmail },
      { mark: 'notsent', word: say.where(WA, W.notSent), reason: W.hasNotAgreedWhatsApp },
    ],
    fixes: [],
  },
  {
    key: 'sophie',
    initials: 'SL',
    name: 'Sophie Laurent',
    lines: [
      EMAIL_OUT,
      { mark: 'optout', word: say.where(WA, W.notSent), reason: W.stoppedWhatsApp },
    ],
    fixes: [],
  },
];

/** What Add an email address and Add a phone number save in the states that start after one. */
export const ADDED = { email: 'joaquin.ruiz@gmail.com', phone: '+46 70 123 45 67' };

const NOT_INVITED: readonly ReachLine[] = [
  { mark: 'none', word: W.noEmail },
  { mark: 'none', word: W.noPhone },
  { mark: 'none', word: W.theirInvitation, reason: W.notYetInvited },
];

/** Two of the invitation's 140 reached, drawn under Filter: Reached; the rest are counted. */
export const INVITE_REACHED: readonly NotReached[] = [
  {
    key: 'ines',
    initials: 'ID',
    name: 'Inês Duarte',
    lines: [
      { mark: 'delivered', word: say.where(CHANNEL_WORD.email, W.delivered), reason: '10:02' },
      { mark: 'delivered', word: W.theirInvitation, reason: say.seenAt('10:15') },
    ],
    fixes: [],
  },
  {
    key: 'kwame',
    initials: 'KM',
    name: 'Kwame Mensah',
    lines: [
      { mark: 'delivered', word: say.where(CHANNEL_WORD.sms, W.delivered), reason: '10:03' },
      { mark: 'none', word: W.theirInvitation, reason: W.notSeenYet },
    ],
    fixes: [],
  },
];

export const INVITE_GROUPS: readonly ReachGroup[] = [
  {
    key: 'none',
    mark: 'none',
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
    key: 'inProgress',
    mark: 'sending',
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
        fixes: [W.toldInPerson],
      },
      {
        key: 'marta',
        initials: 'MS',
        name: 'Marta Silva',
        lines: [
          { mark: 'sent', word: say.where(CHANNEL_WORD.email, W.sent), reason: '09:41' },
          PAGE_LINE,
        ],
        fixes: [W.toldInPerson],
      },
    ],
  },
  {
    key: 'reached',
    mark: 'delivered',
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
    key: 'cant',
    mark: 'none',
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
        fixes: [W.fixEmail, W.addPhone, W.toldInPerson],
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
  credits: 30 + whatsAppCreditsFor(WHATSAPP.all.reaches),
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
