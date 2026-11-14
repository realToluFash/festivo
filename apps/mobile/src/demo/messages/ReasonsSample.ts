import {
  DAYS,
  EMAIL_OUT,
  type MarkKey,
  type Mobile,
  NEITHER,
  type NotReached,
  PAGE_LINE,
  PARKING_REACH,
  type PersonKey,
  type ReachGroup,
  type ReachLine,
} from './MessagesSample.ts';
import { CHANNEL_WORD, W, say } from './MessagesWords.ts';
import { NW } from './NoticeWords.ts';
import { type ReachSample, TEXTED_LINE } from './TrySms.ts';

/** Parking told by Email only (Messaging-B-Phone-More-2, 4): every reason sc-3942 words, and who has a mobile on record. Made up, as the rest of the sample. */
export const REASONS_REACH = { reached: 133, of: 142, seen: 87 };

const emailLines = (mark: MarkKey, word: string, reason: string): readonly ReachLine[] => [
  { mark, word: say.where(CHANNEL_WORD.email, word), reason },
  PAGE_LINE,
];

const LAGOS: Mobile = { perPart: 62, theirTime: '10:41' };

export const REASON_GROUPS: readonly ReachGroup[] = [
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
        lines: emailLines('bounced', W.bounced, W.doesntExist),
        fixes: [W.fixEmail, W.toldInPerson],
      },
      {
        key: 'olumide',
        initials: 'OB',
        name: 'Olumide Bello',
        tellable: true,
        bounced: 'olumide.bello@outlook.com',
        lines: emailLines('bounced', W.bounced, W.inboxFull),
        fixes: [W.fixEmail, W.toldInPerson],
        mobile: LAGOS,
      },
    ],
  },
  {
    key: 'failed',
    mark: 'bounced',
    word: W.failedReceipt,
    people: [
      {
        key: 'chidi',
        initials: 'CO',
        name: 'Chidi Okeke',
        tellable: true,
        bounced: 'chidi.okeke@gmail.com',
        lines: emailLines('bounced', W.failedReceipt, W.couldNotSendEmail),
        fixes: [W.fixEmail, W.toldInPerson],
        mobile: LAGOS,
      },
      {
        key: 'rafael',
        initials: 'RC',
        name: 'Rafael Costa',
        bounced: 'rafael.costa@uol.com.br',
        lines: emailLines('bounced', W.failedReceipt, W.cannotEmailAddress),
        fixes: [W.fixEmail, W.toldInPerson],
        mobile: { perPart: 10, theirTime: '06:41' },
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
        lines: [EMAIL_OUT, PAGE_LINE],
        fixes: [W.toldInPerson],
        mobile: { perPart: 8, theirTime: '10:41' },
      },
    ],
  },
  {
    key: 'skipped',
    mark: 'notsent',
    word: W.skipped,
    people: [
      {
        key: 'yuki',
        initials: 'YT',
        name: 'Yuki Tanaka',
        bounced: 'yuki.tanaka@icloud.com',
        lines: emailLines('notsent', W.notSent, W.addressBouncing),
        fixes: [W.fixEmail, W.toldInPerson],
        mobile: { perPart: 9, theirTime: '09:41' },
      },
      {
        key: 'diego',
        initials: 'DH',
        name: 'Diego Herrera',
        lines: emailLines('notsent', W.notSent, NW.reportedSpam),
        fixes: [W.toldInPerson],
        mobile: { perPart: 8, theirTime: '10:41', stopped: true },
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

const PARKING_DAY = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
}).format(new Date(`${DAYS.parking}T12:00:00Z`));

/** Three of the 133 reached; Reported as spam came after delivery, so Kemi Bankole counts as reached. */
export const REASONS_REACHED: readonly NotReached[] = [
  {
    key: 'kemi',
    initials: 'KB',
    name: 'Kemi Bankole',
    lines: emailLines('delivered', NW.reportedAsSpam, say.dayTime(PARKING_DAY, '18:42')),
    fixes: [],
  },
  {
    key: 'ines',
    initials: 'ID',
    name: 'Inês Duarte',
    lines: [
      { mark: 'delivered', word: say.where(CHANNEL_WORD.email, W.delivered), reason: '18:21' },
      { mark: 'delivered', word: W.theirPage, reason: say.seenAt('19:02') },
    ],
    fixes: [],
  },
  {
    key: 'kwame',
    initials: 'KM',
    name: 'Kwame Mensah',
    lines: emailLines('delivered', W.delivered, '18:21'),
    fixes: [],
  },
];

/** `reachedQuiet`: sent at 09:41 London, it is 04:41 in Bogotá, so Valentina Restrepo's text waits for her morning. */
export const NIGHT_TEXT: NotReached = {
  key: 'valentina',
  initials: 'VR',
  name: 'Valentina Restrepo',
  lines: [
    TEXTED_LINE.waiting,
    { mark: 'none', word: CHANNEL_WORD.email, reason: W.noEmail },
    PAGE_LINE,
  ],
  fixes: [W.toldInPerson],
};

export function reasonPerson(key: PersonKey): NotReached | null {
  return REASON_GROUPS.flatMap((group) => group.people).find((one) => one.key === key) ?? null;
}

/** Parking's figures in the list and its conversation, as the open sample has them. */
export function parkingReachOf(sample: ReachSample | undefined): {
  reached: number;
  of: number;
  seen: number;
  notReached: number;
} {
  return sample === 'reasons'
    ? { ...REASONS_REACH, notReached: REASONS_REACH.of - REASONS_REACH.reached }
    : PARKING_REACH;
}
