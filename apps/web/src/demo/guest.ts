import { LOCALES, formattingLocale, hostsLine } from '@soirely/domain';
import i18next from 'i18next';

import { writtenTime } from './clock.ts';
import { repliesOpen } from './replyClose.ts';
import { type SampleEvent, sampleEvent } from './events.ts';
import { BOARD_SAMPLES } from './guestLanguages.ts';
import {
  type GuestKitchen,
  closedKitchen,
  isGuestKitchenState,
  guestKitchenStarts,
} from './guestKitchen.ts';
import type { GuestNote } from './arrivalNote.ts';
import { guestNoteStarts, isGuestNoteState } from './guestNote.ts';
import { type ChangeLine, guestChangeStarts, isGuestChangeState } from './guestChange.ts';
import { NO_PLACES, type Party, guestPartyStarts, isGuestPartyState } from './guestCompanions.ts';
import {
  type Day,
  type WhereShown,
  guestDayStarts,
  isGuestDayState,
  leadsWithCode,
} from './guestDay.ts';
import type { DemoLink } from './settings.ts';
import { U } from './unsubscribe.ts';
import { type AskView, afterAnswer } from './guestAsk.ts';
import { type ReplyByChoice, askStarts, isAskState } from './guestAskStates.ts';

/** The guest's own page in A · The cover card (sc-31306), on the boards' sample: main's evt-wed-4 and one guest. */
export const EVENT: SampleEvent = sampleEvent('evt-wed-4') as SampleEvent;
export const GUEST = 'Maria Fernanda Albuquerque Santos';
export const COMPANIONS = 2;

export const TODAY = '2026-10-27';
export const EARLIER = '2026-10-20';
export const REPLY_BY = '2026-10-30';
/** The visit's clock: before the date to answer by, and after it (sc-3780's rule decides which is closed). */
export const OPEN_NOW = '2026-10-27T10:00:00Z';
export const AFTER_REPLY_BY = '2026-10-31T10:00:00Z';
/** sc-3787: the member who recorded a reply for the guest, the Guests demo's own on evt-wed-4. */
export const RECORDER = 'Folake Adeyemi';
/** The organisation of the wedding, the web demo's own (switcher.ts): WhatsApp's line names it (sc-3950). */
export const ORGANISATION = 'Ire Events';

/** The reader's zone is the browser's; the sample reads in London, and the zone state from São Paulo. */
export const READER_ZONE = 'Europe/London';
export const AWAY_ZONE = 'America/Sao_Paulo';

export const SEND_MS = 900;
/** A guest's message holds at most 1,000 characters, counted from 900 (pm, 7 Nov 2026). */
export const MESSAGE_MOST = 1000;
export const MESSAGE_COUNT_FROM = 900;
export const HOLD_MS = 8000;

export const THANK_YOU =
  'Thank you for dancing with us, for the songs and for every kind word. Our day was better because you were in it.';

export interface Message {
  id: string;
  at: string;
  words: string;
}

export const MESSAGES: readonly Message[] = [
  {
    id: 'm-1',
    at: '2026-10-31T10:05:00Z',
    words:
      'We’re so glad you’re coming! The ceremony starts at 18:00, so please be at The Landmark by 17:30.',
  },
  {
    id: 'm-2',
    at: '2026-11-02T21:14:00Z',
    words: 'Parking is on Marylebone Road, and the dress code is formal.',
  },
  {
    id: 'm-3',
    at: '2026-11-03T08:30:00Z',
    words: 'If you have any questions before Thursday, write to us here.',
  },
];

/** A note sent with an invitation or a change: an entry in Messages, by time (pm, 13 Nov, on ux's #44753). */
export interface HostNote extends Message {
  /** sc-4330: Soirely's prepared lines above a change's note, with the values this guest was sent; none on an invitation's. */
  lines: readonly ChangeLine[];
}

export const INVITATION_NOTE: HostNote = {
  id: 'n-invitation',
  at: '2026-10-20T09:00:00Z',
  lines: [],
  words:
    'We would love you there with us. Children are very welcome, and there is a quiet room by the cloakroom for little ones who need a rest.\n\nAdaeze & Tunde',
};

export const LONG_NOTE: HostNote = {
  id: 'n-long',
  at: '2026-10-20T09:00:00Z',
  lines: [],
  words: [
    'We are so happy to invite you, and we wanted to tell you a little about the day before it comes.',
    'The ceremony is in the Grand Hall on the ground floor, with step-free access from Marylebone Road. Doors open at 17:30, and we will start at 18:00 sharp, so please give yourselves time for the traffic on a Thursday evening. There is a cloakroom by the main doors, and the staff there will hold bags and coats all night.',
    'After the ceremony there are drinks in the Winter Garden while the hall is set for dinner. Dinner is at 20:00, and you will find your table on your own page here once we have shared the tables. If anything you eat needs care, tell the kitchen on this page, and we will make sure they know.',
    'The dress code is formal, and colour is welcome. Bring comfortable shoes for the dancing, which starts at 21:30 and goes on until 01:00. There will be taxis at the front from 23:00, and the nearest stations are Marylebone and Baker Street, both a few minutes away on foot.',
    'Children are very welcome. There is a quiet room by the cloakroom with books and a sofa for little ones who need a rest, and the kitchen will make them their own dinner.',
    'If you are travelling from far away, The Landmark has kept rooms for our guests until 1 November; write to us here and we will send you the details.',
    'We cannot wait to see you.\n\nAdaeze & Tunde',
  ].join('\n\n'),
};

export const MINE = 'Thank you! Is there a cloakroom at The Landmark?';
export const MINE_AT = '2026-11-03T09:41:00Z';

export const LONG_MESSAGE =
  'Thank you so much for the invitation, and congratulations to you both! We are travelling ' +
  'from Lisbon on Wednesday and land at Heathrow at about two in the afternoon, so we ' +
  'should reach The Landmark in good time. My mother is coming with us and uses a ' +
  'wheelchair, so I wanted to ask a few things before Thursday. Is there step-free access ' +
  'to the ceremony room, and is there a lift between the floors? Could my mother sit near ' +
  'the front, at the end of a row, to see you both and to leave easily if needed? Is there ' +
  'a quiet room for a short rest between the ceremony and the dinner? My mother also eats ' +
  'no gluten; I have added it to what the kitchen should know, but I wanted you to hear it ' +
  'from us too. My brother would love to bring a guitar for the party afterwards, if that ' +
  'would be welcome, and would only play if you would like it. We are so happy to be part ' +
  'of your day, and we cannot wait to celebrate with you both in London. Thank you again ' +
  'for all of that. With love from all three of us, and see you very soon at The Landmark, ' +
  'Maria.';

export type Answer = 'coming' | 'notComing' | 'notSure';
export const ANSWERS: readonly Answer[] = ['coming', 'notComing', 'notSure'];
export type Phase = 'live' | 'paused' | 'calledOff' | 'over' | 'finished';
export type Lang = 'en' | 'es' | 'fr' | 'pt';
export type Page = 'event' | 'gone' | 'unreachable' | 'loading' | 'messages';

/** sc-3969's channels on Your messages, always in this order; WhatsApp's switch is the guest's agreement. */
export type Channel = 'email' | 'sms' | 'whatsApp';
export const CHANNELS: readonly Channel[] = ['email', 'sms', 'whatsApp'];
export interface Reach {
  email: boolean;
  sms: boolean;
  saved: Channel | null;
}

/** What a press on Your messages sends: the lead button's Email off, Undo's Email on, or one switch. */
export type Press = 'stop' | 'undo' | Channel;

/** sc-3969's page as an email's link or the guest's page opens it; `lead` is the button or the words in its place. */
export interface Yours {
  from: 'email' | 'page';
  opening: 'loading' | 'open' | 'broken';
  emailAddress: boolean;
  lead: 'button' | 'stopped' | 'undone' | null;
  busy: Press | null;
  retrying: boolean;
  failed: Press | null;
}

export type View =
  | { kind: 'answer'; busy: Answer | null; note: 'unsent' | 'notSentTap' | null }
  | { kind: 'check'; busy: boolean; failed: boolean; refused: boolean; from: 'answer' | 'changing' }
  | { kind: 'kitchen'; busy?: boolean }
  | { kind: 'recorded'; same: boolean }
  | { kind: 'changing'; busy: Answer | null }
  | { kind: 'closed' }
  | { kind: 'withYou'; from: 'answer' | 'changing' }
  | { kind: 'tellUs'; busy: boolean; result: 'failed' | 'limited' | 'thanks' | null; back: View };

/** An answer on the guest's record; `by` names the member who recorded it for them (sc-3787). */
export interface Recorded {
  answer: Answer;
  on: string;
  by?: string;
  whatsApp?: true;
}

/** sc-3950: a guest's WhatsApp agreement with this organisation, their own or the host's record; `stopped` ended it. */
export type WhatsAppConsent = 'none' | 'agreed' | 'hostRecorded' | 'stopped';

/** Who sees the box on Check and send: a mobile number on the record, and no agreement in force. */
export function offersWhatsApp(guest: { mobile: boolean; whatsApp: WhatsAppConsent }): boolean {
  return guest.mobile && (guest.whatsApp === 'none' || guest.whatsApp === 'stopped');
}

/** What Send my answer records with the answer: the agreement only from a box shown and ticked. */
export function agreesOnSend(guest: {
  mobile: boolean;
  whatsApp: WhatsAppConsent;
  ticked: boolean;
}): boolean {
  return offersWhatsApp(guest) && guest.ticked;
}

/** The answer Send my answer records, with what changed: the agreement, if ticked (sc-3950). */
export function sentAnswer(was: Visit, answer: Answer): Partial<Visit> {
  const agreed = agreesOnSend(was);
  const same = sameAnswer(was.recorded, answer) && !agreed;
  const recorded: Recorded = agreed ? { answer, on: TODAY, whatsApp: true } : { answer, on: TODAY };

  return {
    recorded: same ? was.recorded : recorded,
    view: { kind: 'recorded', same },
    ask: afterAnswer(
      was.ask,
      was.recorded?.by == null ? (was.recorded?.answer ?? null) : null,
      answer,
    ),
    ...(agreed ? { whatsApp: 'agreed' as const } : {}),
  };
}

/** The guest's own answer, sent again unchanged; one a host recorded is never the same as theirs. */
export function sameAnswer(recorded: Recorded | null, answer: Answer): boolean {
  return recorded != null && recorded.by == null && recorded.answer === answer;
}

export interface Mine {
  words: string;
  at: string;
  sent: boolean;
}

export interface Visit {
  page: Page;
  phase: Phase;
  started: boolean;
  replyBy: string | null;
  now: string;
  recorded: Recorded | null;
  companionsComing: number;
  view: View;
  photo: boolean;
  lang: Lang;
  menuOpen: boolean;
  readerZone: string;
  messages: number;
  notes: readonly HostNote[];
  mine: readonly Mine[];
  draft: string;
  draftFailed: boolean;
  draftTried: boolean;
  /** sc-3978: the box to write to the hosts, gone once stopped or switched off, refused on a page already open. */
  box: 'open' | 'none' | 'refused';
  arrival: boolean;
  /** sc-3790: the switch said once in the new language, and a choice the guest's record did not take. */
  said: number;
  unsaved: boolean;
  want: string | null;
  wantId: number;
  /** sc-3778's step, once Yes has led to it; null for sc-1439's Check and send on its own. */
  kitchen: GuestKitchen | null;
  mobile: boolean;
  whatsApp: WhatsAppConsent;
  ticked: boolean;
  reach: Reach;
  yours: Yours;
  note: GuestNote;
  party: Party;
  /** sc-1363: when to ask a Not sure yet guest again; null with any other answer. */
  ask: AskView | null;
  /** sc-3780: the host let this guest change their reply, so Reply by does not bound the ask. */
  reopened: boolean;
  day: Day;
  where: WhereShown;
  dayOrder: boolean;
}

export const OPEN: View = { kind: 'answer', busy: null, note: null };
const RECORDED: View = { kind: 'recorded', same: false };
const CLOSED: View = { kind: 'closed' };

export const FROM_PAGE: Yours = {
  from: 'page',
  opening: 'open',
  emailAddress: true,
  lead: null,
  busy: null,
  retrying: false,
  failed: null,
};

const BASE: Visit = {
  page: 'event',
  phase: 'live',
  started: false,
  replyBy: REPLY_BY,
  now: OPEN_NOW,
  recorded: null,
  companionsComing: COMPANIONS,
  view: OPEN,
  photo: false,
  lang: 'en',
  menuOpen: false,
  readerZone: READER_ZONE,
  messages: 0,
  notes: [],
  mine: [],
  draft: '',
  draftFailed: false,
  draftTried: false,
  box: 'open',
  arrival: false,
  said: 0,
  unsaved: false,
  want: null,
  wantId: 0,
  kitchen: null,
  mobile: false,
  whatsApp: 'none',
  ticked: false,
  reach: { email: true, sms: true, saved: null },
  yours: FROM_PAGE,
  note: 'host',
  party: NO_PLACES,
  ask: null,
  reopened: false,
  day: 'before',
  where: 'full',
  dayOrder: false,
};

const COMING = { answer: 'coming', on: TODAY } as const;
const MESSAGED: Partial<Visit> = { recorded: COMING, view: RECORDED, messages: 3 };
const SENT_MINE: Mine = { words: MINE, at: MINE_AT, sent: true };

function yourMessages(yours: Partial<Yours>, rest: Partial<Visit> = {}): Partial<Visit> {
  return { page: 'messages', mobile: true, yours: { ...FROM_PAGE, ...yours }, ...rest };
}

const EMAIL_LINK: Partial<Yours> = { from: 'email', lead: 'button' };
const STOPPED: Partial<Yours> = { from: 'email', lead: 'stopped' };
const EMAIL_OFF: Partial<Visit> = { reach: { email: false, sms: true, saved: null } };

function check(extra: Partial<Extract<View, { kind: 'check' }>> = {}): View {
  return { kind: 'check', busy: false, failed: false, refused: false, from: 'answer', ...extra };
}

function tellUs(result: 'failed' | 'limited' | 'thanks' | null = null): View {
  return { kind: 'tellUs', busy: false, result, back: OPEN };
}

const STATES = {
  open: { name: 'Not answered yet, with a date to answer by', starts: {} },
  openNoDate: { name: 'Not answered yet, no date to answer by', starts: { replyBy: null } },
  check: {
    name: 'Yes, I’ll be there, then Check and send',
    starts: { view: check(), want: 'checkHead' },
  },
  checkWhatsApp: {
    name: 'Check and send, with a mobile number: the WhatsApp box',
    starts: { view: check(), mobile: true, want: 'checkHead' },
  },
  checkWhatsAppTicked: {
    name: 'Check and send, the WhatsApp box ticked',
    starts: { view: check(), mobile: true, ticked: true, want: 'checkHead' },
  },
  sending: {
    name: 'Sending Send my answer',
    starts: { view: check({ busy: true }), want: 'send' },
  },
  notSent: {
    name: 'A send that failed, on Check and send',
    starts: { view: check({ failed: true }), want: 'send' },
  },
  sendingTap: {
    name: 'Sending a one-tap answer',
    starts: { view: { kind: 'answer', busy: 'notComing', note: null }, want: 'row-notComing' },
  },
  notSentTap: {
    name: 'A one-tap answer that failed',
    starts: { view: { kind: 'answer', busy: null, note: 'notSentTap' }, want: 'row-notComing' },
  },
  coming: {
    name: 'Answered Coming',
    starts: { recorded: COMING, view: RECORDED, want: 'greeting' },
  },
  comingWhatsApp: {
    name: 'Sent with WhatsApp ticked: Coming as drawn, the agreement recorded',
    starts: {
      recorded: { ...COMING, whatsApp: true },
      view: RECORDED,
      mobile: true,
      whatsApp: 'agreed',
      want: 'greeting',
    },
  },
  comingAlone: {
    name: 'Answered Coming, no companion coming',
    starts: { recorded: COMING, view: RECORDED, companionsComing: 0, want: 'greeting' },
  },
  notComing: {
    name: 'Answered Not coming, in one tap',
    starts: { recorded: { answer: 'notComing', on: TODAY }, view: RECORDED, want: 'greeting' },
  },
  notSure: {
    name: 'Answered Not sure yet, with companions',
    starts: { recorded: { answer: 'notSure', on: TODAY }, view: RECORDED, want: 'greeting' },
  },
  hostRecorded: {
    name: 'Down as coming, recorded by a host',
    starts: {
      recorded: { answer: 'coming', on: EARLIER, by: RECORDER },
      view: RECORDED,
      want: 'greeting',
    },
  },
  hostRecordedMaybe: {
    name: 'Down as not sure yet, recorded by a host',
    starts: {
      recorded: { answer: 'notSure', on: EARLIER, by: RECORDER },
      view: RECORDED,
      want: 'greeting',
    },
  },
  changing: {
    name: 'Changing the answer',
    starts: {
      recorded: { answer: 'coming', on: EARLIER },
      view: { kind: 'changing', busy: null },
      want: 'newHead',
    },
  },
  sameAnswer: {
    name: 'The same answer sent again',
    starts: {
      recorded: { answer: 'coming', on: EARLIER },
      view: { kind: 'recorded', same: true },
      want: 'greeting',
    },
  },
  unsentReturn: {
    name: 'Back after leaving part-way',
    starts: { view: { kind: 'answer', busy: null, note: 'unsent' } },
  },
  replyByClosed: {
    name: 'After the date to answer by, Coming',
    starts: { now: AFTER_REPLY_BY, recorded: COMING, view: CLOSED },
  },
  replyByClosedNotSure: {
    name: 'After the date to answer by, Not sure yet',
    starts: { now: AFTER_REPLY_BY, recorded: { answer: 'notSure', on: TODAY }, view: CLOSED },
  },
  replyByClosedNotComing: {
    name: 'After the date to answer by, Not coming',
    starts: { now: AFTER_REPLY_BY, recorded: { answer: 'notComing', on: TODAY }, view: CLOSED },
  },
  replyByClosedNever: {
    name: 'After the date to answer by, never answered',
    starts: { now: AFTER_REPLY_BY, view: CLOSED },
  },
  replyByClosedRecorded: {
    name: 'After the date to answer by, recorded by a host',
    starts: {
      now: AFTER_REPLY_BY,
      recorded: { answer: 'coming', on: EARLIER, by: RECORDER },
      view: CLOSED,
    },
  },
  replyByClosedKitchen: {
    name: 'After the date: the kitchen step on its own',
    starts: {
      now: AFTER_REPLY_BY,
      recorded: COMING,
      view: { kind: 'kitchen' },
      kitchen: closedKitchen(COMPANIONS, EARLIER),
      want: 'kitchenHead',
    },
  },
  replyByClosedNotSaved: {
    name: 'After the date: the kitchen needs not saved',
    starts: {
      now: AFTER_REPLY_BY,
      recorded: COMING,
      view: { kind: 'kitchen' },
      kitchen: closedKitchen(COMPANIONS, EARLIER, { failed: true }),
      want: 'kitchenRetry',
    },
  },
  replyByClosedSaved: {
    name: 'After the date: the kitchen needs saved',
    starts: {
      now: AFTER_REPLY_BY,
      recorded: COMING,
      view: CLOSED,
      kitchen: closedKitchen(COMPANIONS, EARLIER, { saved: true }),
      want: 'kitchen',
    },
  },
  closedRefused: {
    name: 'Answers closed while sending (409)',
    starts: { now: AFTER_REPLY_BY, view: check({ refused: true }) },
  },
  closed: {
    name: 'Closed at the start, Coming',
    starts: { started: true, recorded: COMING, view: CLOSED },
  },
  closedNever: {
    name: 'Closed at the start, never answered',
    starts: { started: true, view: CLOSED },
  },
  paused: {
    name: 'Paused before the start, answered',
    starts: { phase: 'paused', recorded: COMING, view: CLOSED },
  },
  pausedNever: {
    name: 'Paused before the start, never answered',
    starts: { phase: 'paused', view: CLOSED },
  },
  pausedAfterStart: {
    name: 'Paused after the start',
    starts: { phase: 'paused', started: true, recorded: COMING, view: CLOSED },
  },
  zone: { name: 'A guest in another time zone', starts: { readerZone: AWAY_ZONE } },
  calledOff: {
    name: 'Called off',
    starts: { phase: 'calledOff', recorded: COMING, view: CLOSED },
  },
  overNever: {
    name: 'Over, never answered',
    starts: { phase: 'over', started: true, view: CLOSED },
  },
  over: {
    name: 'Over, with no thank-you',
    starts: { phase: 'over', started: true, recorded: COMING, view: CLOSED },
  },
  finished: {
    name: 'Over, with the hosts’ thank-you',
    starts: { phase: 'finished', started: true, recorded: COMING, view: CLOSED },
  },
  gone: { name: 'A link that does not work, or an event that is gone', starts: { page: 'gone' } },
  unreachable: { name: 'Cannot reach Soirely', starts: { page: 'unreachable', want: 'h1' } },
  loading: { name: 'Loading', starts: { page: 'loading' } },
  french: {
    name: 'In French, the language menu open',
    starts: { lang: 'fr', menuOpen: true },
  },
  en: { name: 'In English, as today', starts: {} },
  menuOpen: { name: 'The language menu open', starts: { menuOpen: true } },
  switched: {
    name: 'Switched to French, the switch said',
    starts: { lang: 'fr', said: 1, want: 'lang' },
  },
  fr: { name: 'In French', starts: { lang: 'fr' } },
  pt: { name: 'In Portuguese', starts: { lang: 'pt' } },
  es: { name: 'In Spanish', starts: { lang: 'es' } },
  notSaved: {
    name: 'Switched to French, the choice not saved',
    starts: { lang: 'fr', said: 1, unsaved: true },
  },
  photo: { name: 'An organiser’s cover photo', starts: { photo: true } },
  tellUs: {
    name: 'Not {full name}? Tell us',
    starts: { view: tellUs(), want: 'tellHead' },
  },
  tellUsFailed: {
    name: 'Tell them, failed',
    starts: { view: tellUs('failed'), want: 'tellThem' },
  },
  tellUsLimited: {
    name: 'Tell them, too many tries (429)',
    starts: { view: tellUs('limited'), want: 'tellThem' },
  },
  tellUsThanks: { name: 'Told the hosts', starts: { view: tellUs('thanks'), want: 'thanks' } },
  message: {
    name: 'A message from the hosts',
    starts: { ...MESSAGED, messages: 1 },
  },
  messages: { name: 'Several messages from the hosts', starts: MESSAGED },
  messageArrival: {
    name: 'Opened from the fixed notice',
    starts: { ...MESSAGED, arrival: true },
  },
  replyWriting: {
    name: 'Writing back, the keyboard up',
    starts: { ...MESSAGED, draft: MINE, want: 'box' },
  },
  replySending: {
    name: 'Sending a message',
    starts: { ...MESSAGED, mine: [{ words: MINE, at: MINE_AT, sent: false }] },
  },
  replySent: { name: 'A message sent', starts: { ...MESSAGED, mine: [SENT_MINE] } },
  messageLong: {
    name: 'A long message, the count showing',
    starts: { ...MESSAGED, draft: LONG_MESSAGE.slice(0, 950), want: 'box' },
  },
  messageTooLong: {
    name: 'A message over 1,000 characters',
    starts: { ...MESSAGED, draft: LONG_MESSAGE, draftTried: true, want: 'box' },
  },
  noteInvitation: {
    name: 'The invitation’s note, opening Messages before an answer',
    starts: { notes: [INVITATION_NOTE] },
  },
  noteAmongMessages: {
    name: 'The invitation’s note among the hosts’ messages',
    starts: { ...MESSAGED, notes: [INVITATION_NOTE] },
  },
  noteLong: {
    name: 'A long note',
    starts: { notes: [LONG_NOTE] },
  },
  calledOffMessages: {
    name: 'Called off, with the hosts’ messages',
    starts: { phase: 'calledOff', recorded: COMING, view: CLOSED, messages: 3 },
  },
  finishedMessages: {
    name: 'Over, with the thank-you and the hosts’ messages',
    starts: { phase: 'finished', started: true, recorded: COMING, view: CLOSED, messages: 3 },
  },
  replyFailed: {
    name: 'A message that failed',
    starts: { ...MESSAGED, draft: MINE, draftFailed: true, want: 'sendMessage' },
  },
  noBox: {
    name: 'No box: stopped, or guests can’t write',
    starts: { ...MESSAGED, box: 'none' },
  },
  noBoxOpen: {
    name: 'A page already open: the send fails',
    starts: { ...MESSAGED, box: 'refused', draft: MINE, draftFailed: true, want: 'sendMessage' },
  },
  messagesWhatsAppOff: {
    name: 'Your messages: WhatsApp off, never agreed',
    starts: { page: 'messages', mobile: true },
  },
  messagesWhatsAppTurnedOn: {
    name: 'Your messages: WhatsApp just turned on, saved',
    starts: {
      page: 'messages',
      mobile: true,
      whatsApp: 'agreed',
      reach: { email: true, sms: true, saved: 'whatsApp' },
      want: 'switch-whatsApp',
    },
  },
  messagesWhatsAppOn: {
    name: 'Your messages: WhatsApp on, agreed earlier',
    starts: { page: 'messages', mobile: true, whatsApp: 'agreed' },
  },
  messagesWhatsAppTurnedOff: {
    name: 'Your messages: WhatsApp turned off again, saved',
    starts: {
      page: 'messages',
      mobile: true,
      whatsApp: 'stopped',
      reach: { email: true, sms: true, saved: 'whatsApp' },
      want: 'switch-whatsApp',
    },
  },
  messagesNoMobile: {
    name: 'Your messages: no mobile number on record',
    starts: { page: 'messages' },
  },
  messagesTextsOff: {
    name: 'Your messages: Text messages turned off, saved',
    starts: yourMessages(
      {},
      { reach: { email: true, sms: false, saved: 'sms' }, want: 'switch-sms' },
    ),
  },
  messagesSwitchSaving: {
    name: 'Your messages: saving, on a switch',
    starts: yourMessages({ busy: 'sms' }, { want: 'switch-sms' }),
  },
  messagesSwitchFailed: {
    name: 'Your messages: a switch that did not save',
    starts: yourMessages({ failed: 'sms' }, { want: 'switch-sms' }),
  },
  messagesTwoOff: {
    name: 'Your messages: two channels off',
    starts: yourMessages(
      {},
      { reach: { email: false, sms: false, saved: null }, whatsApp: 'agreed' },
    ),
  },
  messagesNoEmail: {
    name: 'Your messages: no email address on record',
    starts: yourMessages({ emailAddress: false }),
  },
  messagesNothing: {
    name: 'Your messages: nothing on record',
    starts: yourMessages({ emailAddress: false }, { mobile: false }),
  },
  messagesFromEmail: {
    name: 'Your messages from an email’s link, before the tap',
    starts: yourMessages(EMAIL_LINK),
  },
  messagesStopSaving: {
    name: 'Your messages: saving, the button',
    starts: yourMessages({ ...EMAIL_LINK, busy: 'stop' }, { want: 'stop' }),
  },
  messagesStopFailed: {
    name: 'Your messages: a save that failed, the button',
    starts: yourMessages({ ...EMAIL_LINK, failed: 'stop' }, { want: 'stop' }),
  },
  messagesStopped: {
    name: 'Your messages: emails turned off',
    starts: yourMessages(STOPPED, { ...EMAIL_OFF, want: 'yoursLead' }),
  },
  messagesUndoSaving: {
    name: 'Your messages: saving, Undo',
    starts: yourMessages({ ...STOPPED, busy: 'undo' }, { ...EMAIL_OFF, want: 'undo' }),
  },
  messagesUndoFailed: {
    name: 'Your messages: Undo that failed',
    starts: yourMessages({ ...STOPPED, failed: 'undo' }, { ...EMAIL_OFF, want: 'undo' }),
  },
  messagesUndone: {
    name: 'Your messages: Undo done',
    starts: yourMessages({ from: 'email', lead: 'undone' }, { want: 'yoursLead' }),
  },
  messagesEmailOff: {
    name: 'Your messages from an email’s link, already off',
    starts: yourMessages({ from: 'email' }, EMAIL_OFF),
  },
  messagesLoading: {
    name: 'Your messages: loading, as an email’s link opens it',
    starts: yourMessages({ ...EMAIL_LINK, opening: 'loading' }),
  },
  messagesLinkBroken: {
    name: 'Your messages: this link does not work',
    starts: yourMessages({ from: 'email', opening: 'broken' }),
  },
} satisfies Record<string, { name: string; starts: Partial<Visit> }>;

export type GuestStateName = keyof typeof STATES;

export function isGuestState(value: string | null): value is GuestStateName {
  return value != null && Object.hasOwn(STATES, value);
}

function startsOf(
  value: string | null,
  ask: { replyBy?: ReplyByChoice; days?: number },
): Partial<Visit> {
  if (isAskState(value)) return askStarts(value, ask.replyBy, ask.days);
  if (isGuestKitchenState(value))
    return guestKitchenStarts(value, { earlier: EARLIER, companions: COMPANIONS });
  if (isGuestNoteState(value)) return guestNoteStarts(value);
  if (isGuestChangeState(value)) return guestChangeStarts(value);
  if (isGuestPartyState(value)) return guestPartyStarts(value);
  if (isGuestDayState(value)) return guestDayStarts(value);

  return STATES[isGuestState(value) ? value : 'open'].starts as Partial<Visit>;
}

export function startOf(
  value: string | null,
  ask: { replyBy?: ReplyByChoice; days?: number } = {},
): Visit {
  const visit: Visit = { ...BASE, ...startsOf(value, ask) };

  return { ...visit, dayOrder: leadsWithCode(visit) };
}

export function stateName(state: GuestStateName): string {
  return STATES[state].name;
}

function link(state: GuestStateName): DemoLink {
  const fragment = state === 'messageArrival' ? `#${MESSAGES.at(-1)?.id ?? ''}` : '';

  return { to: `/demo/guest?state=${state}${fragment}`, name: STATES[state].name };
}

export const GUEST_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Answering',
    states: (
      [
        'open',
        'openNoDate',
        'check',
        'checkWhatsApp',
        'checkWhatsAppTicked',
        'sending',
        'notSent',
        'sendingTap',
        'notSentTap',
        'coming',
        'comingWhatsApp',
        'comingAlone',
        'notComing',
        'notSure',
        'hostRecorded',
        'hostRecordedMaybe',
        'changing',
      ] as const
    ).map(link),
  },
  {
    name: 'Coming back, and answers closing',
    states: (
      [
        'sameAnswer',
        'unsentReturn',
        'replyByClosed',
        'replyByClosedNotSure',
        'replyByClosedNotComing',
        'replyByClosedNever',
        'replyByClosedRecorded',
        'replyByClosedKitchen',
        'replyByClosedNotSaved',
        'replyByClosedSaved',
        'closedRefused',
        'closed',
        'closedNever',
        'paused',
        'pausedNever',
        'pausedAfterStart',
        'zone',
      ] as const
    ).map(link),
  },
  {
    name: 'Over, gone, and the rest',
    states: (
      [
        'calledOff',
        'over',
        'overNever',
        'finished',
        'gone',
        'unreachable',
        'loading',
        'french',
        'photo',
        'tellUs',
        'tellUsFailed',
        'tellUsLimited',
        'tellUsThanks',
      ] as const
    ).map(link),
  },
  {
    name: 'In the guest’s own language (sc-3790)',
    states: (['en', 'menuOpen', 'switched', 'fr', 'pt', 'es', 'notSaved'] as const).map(link),
  },
  {
    name: 'The hosts’ messages and the guest’s own',
    states: (
      [
        'message',
        'messages',
        'messageArrival',
        'replyWriting',
        'messageLong',
        'messageTooLong',
        'replySending',
        'replySent',
        'replyFailed',
        'calledOffMessages',
        'finishedMessages',
        'noBox',
        'noBoxOpen',
      ] as const
    ).map(link),
  },
  {
    name: 'The hosts’ notes, entries in Messages (sc-3971)',
    states: (['noteInvitation', 'noteAmongMessages', 'noteLong'] as const).map(link),
  },
  {
    name: 'Your messages, opened from the guest’s page (sc-3969, sc-3950)',
    states: (
      [
        'messagesWhatsAppOff',
        'messagesWhatsAppTurnedOn',
        'messagesWhatsAppOn',
        'messagesWhatsAppTurnedOff',
        'messagesNoMobile',
        'messagesTextsOff',
        'messagesSwitchSaving',
        'messagesSwitchFailed',
        'messagesTwoOff',
        'messagesNoEmail',
        'messagesNothing',
      ] as const
    ).map(link),
  },
  {
    name: 'Your messages, from an email’s link (sc-3969)',
    states: (
      [
        'messagesFromEmail',
        'messagesStopSaving',
        'messagesStopFailed',
        'messagesStopped',
        'messagesUndoSaving',
        'messagesUndoFailed',
        'messagesUndone',
        'messagesEmailOff',
        'messagesLoading',
        'messagesLinkBroken',
      ] as const
    ).map(link),
  },
];

/** The foot's "no account" line only while the guest can still answer (ux, 13 Nov, from qa2's #44255). */
export function shows(visit: Visit): {
  details: boolean;
  foot: boolean;
  hosts: boolean;
  noAccount: boolean;
} {
  const alone = ['check', 'tellUs', 'kitchen', 'withYou'].includes(visit.view.kind);

  return {
    details: !alone,
    foot: !alone,
    hosts: visit.phase !== 'calledOff',
    noAccount: visit.phase === 'live' && visit.view.kind !== 'closed',
  };
}

/** After the date to answer by: the 23:59:59 instant in the event's zone, the rule Guests uses too (sc-3780). */
export function answersClosedByDate(visit: Visit): boolean {
  return visit.replyBy != null && !repliesOpen(new Date(visit.now), visit.replyBy, EVENT.timeZone);
}

/** The door code and Add to calendar: for Coming, while there is still something to attend (pm, 7 Nov). */
export function forTheDay(visit: Visit): boolean {
  const { view, recorded, phase } = visit;

  return (
    recorded?.answer === 'coming' &&
    phase === 'live' &&
    (view.kind === 'recorded' || view.kind === 'closed')
  );
}

export interface HostEntry {
  message: Message;
  note: HostNote | null;
}

/** The hosts' messages and their notes, newest last; a window of none is none. */
export function hostEntries(visit: Visit): readonly HostEntry[] {
  const messages = visit.messages === 0 ? [] : MESSAGES.slice(-visit.messages);

  return [
    ...messages.map((message) => ({ message, note: null })),
    ...visit.notes.map((note) => ({ message: note, note })),
  ].sort((a, b) => Date.parse(a.message.at) - Date.parse(b.message.at));
}

export function showsMessages(visit: Visit): boolean {
  return (
    (visit.messages > 0 || visit.notes.length > 0) &&
    (visit.view.kind === 'answer' || visit.view.kind === 'recorded' || visit.view.kind === 'closed')
  );
}

export type Layout = 'small' | 'phone' | 'upright' | 'side' | 'desk';

/** The widths the boards measure at: 320 under 22.5rem, 402 to 40rem, 834 to 64rem, 1194 to 80rem, 1280 from it. */
export function layoutOf(matches: {
  small: boolean;
  phone: boolean;
  wide: boolean;
  desk: boolean;
}): Layout {
  if (matches.desk) return 'desk';
  if (matches.wide) return 'side';
  if (matches.small) return 'small';

  return matches.phone ? 'phone' : 'upright';
}

export const LAYOUT_MEDIA = {
  small: '(width < 22.5rem)',
  phone: '(width <= 40rem)',
  wide: '(width >= 64rem)',
  desk: '(width >= 80rem)',
} as const;

export function twoColumns(layout: Layout): boolean {
  return layout === 'side' || layout === 'desk';
}

const TAGS: Record<Lang, string> = { en: 'en-US', es: 'es-ES', fr: 'fr-FR', pt: 'pt-PT' };

export function tagOf(lang: Lang): string {
  return TAGS[lang];
}

/** Money and dates in the reader's locale (CLDR): the shown language, refined by the browser's region when it speaks that language. */
export function readerTag(
  lang: Lang,
  device: string | undefined = globalThis.navigator?.language,
): string {
  const tag = formattingLocale(lang, device);

  return tag === lang ? TAGS[lang] : tag;
}

function format(at: string | Date, lang: Lang, zone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(TAGS[lang], { timeZone: zone, ...options }).format(
    typeof at === 'string' ? new Date(at) : at,
  );
}

export function dayOf(day: string, lang: Lang): string {
  return format(`${day}T12:00:00Z`, lang, 'UTC', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function eventDay(lang: Lang): string {
  return format(EVENT.startsAt, lang, EVENT.timeZone, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function eventTime(lang: Lang): string {
  return writtenTime(EVENT.startsAt, TAGS[lang], EVENT.timeZone);
}

export function shortDay(at: string, lang: Lang, zone: string): string {
  return format(at, lang, zone, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function timeIn(at: string, lang: Lang, zone: string): string {
  return writtenTime(at, TAGS[lang], zone);
}

export function sentWhen(at: string, lang: Lang, zone: string): string {
  return `${shortDay(at, lang, zone)} · ${timeIn(at, lang, zone)}`;
}

export function hostsOf(lang: Lang): string {
  return hostsLine(EVENT.hosts, TAGS[lang]);
}

export const LANGUAGES: readonly { code: Lang; name: string }[] = LOCALES.map((one) => ({
  code: one.code as Lang,
  name: one.nativeName,
}));

/** The board's English, held in the demo until the product's screen puts it in the four catalogues (SHARED.md, Step three). */
const BOARD_ENGLISH = {
  yourAnswer: 'Your answer',
  replyBy: 'Please answer by {{date}}. You can change your answer any time before then.',
  yes: 'Yes, I’ll be there',
  no: 'Sorry, I can’t',
  maybe: 'I’m not sure yet',
  coming: 'Coming',
  notComing: 'Not coming',
  notSure: 'Not sure yet',
  answeredComing: 'You answered Coming on {{date}}.',
  answeredNotComing: 'You answered Not coming on {{date}}.',
  answeredNotSure: 'You answered Not sure yet on {{date}}.',
  answerIsComing: 'Your answer is Coming.',
  answerIsNotComing: 'Your answer is Not coming.',
  answerIsNotSure: 'Your answer is Not sure yet.',
  recordedFor:
    '{{name}} recorded this answer for you on {{date}}. If it isn’t right, change it here.',
  recordedOn: '{{name}} recorded this answer for you on {{date}}.',
  greetComing: 'See you there, {{name}}.',
  greetNotComing: 'We’ll miss you, {{name}}.',
  greetNotSure: 'Thanks for letting us know, {{name}}.',
  companionsOnHold: 'Your companions are on hold until you decide.',
  companionsNotComing: 'Your companions won’t be coming either.',
  change: 'Change my answer',
  newAnswer: 'Your new answer',
  answerNow: 'Your answer now',
  keep: 'Keep my answer',
  back: 'Back',
  check: 'Check and send',
  answerLine: 'Your answer: {{answer}}',
  changeShort: 'Change',
  send: 'Send my answer',
  nothingSent: 'Nothing is sent until you select Send my answer.',
  notSent: 'Your answer was not sent. Everything you chose is still here. Try again.',
  notSentTap: 'Your answer was not sent. Check your connection and choose it again.',
  same: 'You’re already down as {{answer}}. Nothing has changed.',
  unsent: 'You haven’t sent your answer yet.',
  closedBy: 'Answers closed on {{date}}. Contact your host if something has changed.',
  closedByNotSure: 'Answers closed on {{date}}. Contact your host if you can still come.',
  kitchen: 'Update what the kitchen should know',
  refused: 'Answers closed before this was sent. Everything you chose is still here.',
  closed: 'Answers have closed. Contact your host if something has changed.',
  didNotAnswer: 'You didn’t answer.',
  pausedNotice:
    'This event is paused. Answers are closed. Nothing you sent has been lost, and this page will update if the event resumes.',
  pausedReason: 'Answers are closed while the event is paused. Anything you sent is kept.',
  calledOff: 'Called off',
  calledOffNotice:
    'This event has been called off. It will not go ahead. There is nothing you need to do.',
  finishedNotice: 'This event has taken place. This page stays here as a keepsake.',
  noAccount: 'You do not need an account to answer.',
  goneBody:
    'It may have expired, been replaced by a newer one, or been mistyped. If you think it should work, ask whoever invited you.',
  closing: 'This invitation is for you and your family. Other guests cannot see your answer.',
  tell: 'Not {{name}}? Tell us',
  tellQuestion: 'Tell {{hosts}} this link reached the wrong person?',
  tellLine:
    'They will see a note on {{name}}’s invitation and can send a new link. This does not answer the invitation or change anything on it.',
  tellThem: 'Tell them',
  goBack: 'Go back',
  tellFailed: 'Not sent. Check your connection and try again.',
  tellLimited: 'Too many tries from this link. Try again later.',
  tellThanksOne:
    'Thank you. {{hosts}} has been told and will look into it. You can close this page.',
  tellThanksOther:
    'Thank you. {{hosts}} have been told and will look into it. You can close this page.',
  doorTitle: 'Show this at the door',
  doorLine: 'It lets you and your companions in. A screenshot works too.',
  doorLineAlone: 'A screenshot works too.',
  doorCode: 'Your code for the door. It holds no name.',
  calendarTitle: 'Add to calendar',
  calendarLine: 'Your calendar updates by itself if the date, time or place changes.',
  calendarApple: 'Apple / Outlook',
  calendarGoogle: 'Google Calendar',
  messages: 'Messages',
  noteFrom: 'A note from {{hosts}}',
  changeStartTime: 'The start time is now {{new}} (was {{old}}).',
  changeVenue: 'The venue is now {{new}} (was {{old}}).',
  changeCalledOff: '{{event}} has been called off. It won’t go ahead.',
  writeTo: 'Write to {{hosts}}',
  sendMessage: 'Send',
  sent: 'Sent',
  messageFailed: 'Your message wasn’t sent. Your words are still here. Try again.',
  messageCount: '{{count}} of {{most}} characters',
  messageTooLong: 'Shorten your message to {{most}} characters or fewer.',
  whatsAppBox: 'Send me updates on WhatsApp',
  whatsAppHint:
    'Soirely sends them on behalf of {{organisation}}. Reply STOP at any time to end them.',
  yourMessages: 'Your messages',
  yourMessagesIntro:
    'Choose how {{organisation}} can reach you. This changes nothing for anyone else who uses Soirely.',
  channelEmail: 'Email',
  channelSms: 'Text messages',
  channelWhatsApp: 'WhatsApp',
  switchOn: 'On',
  switchOff: 'Off',
  noPhone: '{{organisation}} has no phone number for you.',
  whatsAppUpdates:
    'Soirely sends updates on WhatsApp on behalf of {{organisation}}. Reply STOP at any time to end them.',
  emailOn: 'Emails from {{organisation}} are on again.',
  emailOff: 'Emails from {{organisation}} are off.',
  smsOn: 'Texts from {{organisation}} are on again.',
  smsOff: 'Texts from {{organisation}} are off.',
  whatsAppOn: 'WhatsApp messages from {{organisation}} are on.',
  whatsAppOff: 'WhatsApp messages from {{organisation}} are off.',
  yourMessagesFoot:
    'Only you can turn these back on. {{organisation}} can see which you have turned off, and when.',
  noEmail: '{{organisation}} has no email address for you.',
  stopEmails: 'Stop emails from {{organisation}}',
  stopped: 'You won’t get emails from {{organisation}} any more.',
  undo: 'Undo',
  saving: U.saving,
  saveFailed: U.failed,
  linkBroken: U.unknownTitle,
  linkBrokenBody:
    'Nothing has changed. Open the link again from the most recent email you were sent.',
  wayIn: 'Choose how {{organisation}} can reach you',
  switched: 'This page is now in English.',
  notSaved:
    'Your language was not saved. This page stays in English on this device, but it may open in another language on other devices.',
} as const;

export type BoardKey = keyof typeof BOARD_ENGLISH;

export const LEGAL: Record<Lang, { terms: string; privacy: string }> = {
  en: { terms: 'Terms', privacy: 'Privacy' },
  es: { terms: '[Términos]', privacy: '[Privacidad]' },
  fr: { terms: '[Conditions]', privacy: '[Confidentialité]' },
  pt: { terms: '[Termos]', privacy: '[Privacidade]' },
};

type Slots = Record<string, string | number>;

export function wordsFor(lang: Lang) {
  const t = i18next.getFixedT(lang);
  const numbers = new Intl.NumberFormat(TAGS[lang]);
  const board = (key: BoardKey, slots: Slots = {}): string =>
    ((lang === 'en' ? undefined : BOARD_SAMPLES[lang][key]) ?? BOARD_ENGLISH[key]).replaceAll(
      /\{\{(\w+)\}\}/gu,
      (whole, slot: string) => {
        const value = slots[slot];

        return value == null ? whole : typeof value === 'number' ? numbers.format(value) : value;
      },
    );
  const hosts = hostsOf(lang);
  const one = new Intl.PluralRules('en').select(EVENT.hosts.length) === 'one';
  const answerWord = (answer: Answer): string => board(answer);
  const english = lang === 'en';

  return {
    hosts,
    invited: t('guest.invitationTitle'),
    gone: t('guest.invalidTitle'),
    goneBody: english ? board('goneBody') : t('guest.invalidBody'),
    noAccount: english ? board('noAccount') : t('guest.noAccountNeeded'),
    hostedBy: t('eventHosts.heading'),
    openInMaps: t('eventPage.openInMaps'),
    unreachable: t('session.unreachableTitle'),
    unreachableBody: t('session.unreachableBodySignedOut'),
    retry: t('error.retry'),
    retrying: t('session.retrying'),
    loading: t('pending.loading'),
    copyright: t('auth.copyright', { year: 2026 }),
    languageLabel: t('language.label'),
    languageCurrent: (language: string) => t('language.current', { language }),
    timeInZone: (time: string, timeZone: string) => t('calendar.timeInZone', { time, timeZone }),
    sending: t('recovery.sending'),
    paused: t('events.paused'),
    finished: t('events.finished'),
    calledOff: board('calledOff'),
    pausedNotice: board('pausedNotice'),
    pausedReason: board('pausedReason'),
    calledOffNotice: board('calledOffNotice'),
    finishedNotice: board('finishedNotice'),
    yourAnswer: board('yourAnswer'),
    replyBy: (date: string) => board('replyBy', { date }),
    choice: (answer: Answer): string =>
      board(({ coming: 'yes', notComing: 'no', notSure: 'maybe' } as const)[answer]),
    answerWord,
    answered: (answer: Answer, date: string) =>
      board(
        (
          {
            coming: 'answeredComing',
            notComing: 'answeredNotComing',
            notSure: 'answeredNotSure',
          } as const
        )[answer],
        { date },
      ),
    answerIs: (answer: Answer): string =>
      board(
        (
          {
            coming: 'answerIsComing',
            notComing: 'answerIsNotComing',
            notSure: 'answerIsNotSure',
          } as const
        )[answer],
      ),
    recordedFor: (name: string, date: string) => board('recordedFor', { name, date }),
    recordedOn: (name: string, date: string) => board('recordedOn', { name, date }),
    greeting: (answer: Answer): string =>
      board(
        (
          {
            coming: 'greetComing',
            notComing: 'greetNotComing',
            notSure: 'greetNotSure',
          } as const
        )[answer],
        { name: GUEST },
      ),
    companions: board('companionsOnHold'),
    companionsNotComing: board('companionsNotComing'),
    change: board('change'),
    newAnswer: board('newAnswer'),
    answerNow: board('answerNow'),
    keep: board('keep'),
    back: board('back'),
    check: board('check'),
    answerLine: (answer: Answer) => board('answerLine', { answer: answerWord(answer) }),
    changeShort: board('changeShort'),
    send: board('send'),
    nothingSent: board('nothingSent'),
    notSent: board('notSent'),
    notSentTap: board('notSentTap'),
    same: (answer: Answer) => board('same', { answer: answerWord(answer) }),
    unsent: board('unsent'),
    closedBy: (date: string) => board('closedBy', { date }),
    closedByNotSure: (date: string) => board('closedByNotSure', { date }),
    kitchen: board('kitchen'),
    refused: board('refused'),
    closed: board('closed'),
    didNotAnswer: board('didNotAnswer'),
    closing: board('closing'),
    tell: board('tell', { name: GUEST }),
    tellQuestion: board('tellQuestion', { hosts }),
    tellLine: board('tellLine', { name: GUEST }),
    tellThem: board('tellThem'),
    goBack: board('goBack'),
    tellFailed: board('tellFailed'),
    tellLimited: board('tellLimited'),
    tellThanks: board(one ? 'tellThanksOne' : 'tellThanksOther', { hosts }),
    doorTitle: board('doorTitle'),
    doorLine: (companionsComing: number) =>
      board(companionsComing > 0 ? 'doorLine' : 'doorLineAlone'),
    doorCode: board('doorCode'),
    calendarTitle: board('calendarTitle'),
    calendarLine: board('calendarLine'),
    calendarApple: board('calendarApple'),
    calendarGoogle: board('calendarGoogle'),
    messages: board('messages'),
    noteFrom: board('noteFrom', { hosts }),
    changeLine: (line: ChangeLine, slots: Slots): string =>
      board(
        (
          {
            startTime: 'changeStartTime',
            venue: 'changeVenue',
            calledOff: 'changeCalledOff',
          } as const
        )[line],
        slots,
      ),
    writeTo: board('writeTo', { hosts }),
    sendMessage: board('sendMessage'),
    messageCount: (count: number) => board('messageCount', { count, most: MESSAGE_MOST }),
    messageTooLong: board('messageTooLong', { most: MESSAGE_MOST }),
    sent: board('sent'),
    messageFailed: board('messageFailed'),
    whatsAppBox: board('whatsAppBox'),
    whatsAppHint: board('whatsAppHint', { organisation: ORGANISATION }),
    yourMessages: board('yourMessages'),
    yourMessagesIntro: board('yourMessagesIntro', { organisation: ORGANISATION }),
    channel: (channel: Channel): string =>
      board(
        ({ email: 'channelEmail', sms: 'channelSms', whatsApp: 'channelWhatsApp' } as const)[
          channel
        ],
      ),
    switchWord: (on: boolean): string => board(on ? 'switchOn' : 'switchOff'),
    noPhone: board('noPhone', { organisation: ORGANISATION }),
    whatsAppUpdates: board('whatsAppUpdates', { organisation: ORGANISATION }),
    savedLine: (channel: Channel, on: boolean): string =>
      board(`${channel}${on ? 'On' : 'Off'}`, { organisation: ORGANISATION }),
    yourMessagesFoot: board('yourMessagesFoot', { organisation: ORGANISATION }),
    noEmail: board('noEmail', { organisation: ORGANISATION }),
    stopEmails: board('stopEmails', { organisation: ORGANISATION }),
    lead: (lead: 'stopped' | 'undone'): string =>
      lead === 'stopped'
        ? board('stopped', { organisation: ORGANISATION })
        : board('emailOn', { organisation: ORGANISATION }),
    undo: board('undo'),
    saving: board('saving'),
    saveFailed: board('saveFailed'),
    linkBroken: board('linkBroken'),
    linkBrokenBody: board('linkBrokenBody'),
    wayIn: board('wayIn', { organisation: ORGANISATION }),
    switched: board('switched'),
    notSaved: board('notSaved'),
  };
}

export type Words = ReturnType<typeof wordsFor>;

function mulberry(seed: number): () => number {
  let a = seed;

  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function codePath(size = 25, seed = 1301): string {
  const next = mulberry(seed);
  const grid = Array.from({ length: size }, () => Array.from({ length: size }, () => next() < 0.5));
  const finder = (top: number, left: number) => {
    for (let r = -1; r < 8; r += 1) {
      for (let c = -1; c < 8; c += 1) {
        const row = grid[top + r];
        if (row == null || left + c < 0 || left + c >= size) continue;
        const edge = r === 0 || r === 6 || c === 0 || c === 6;
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        row[left + c] = r >= 0 && r <= 6 && c >= 0 && c <= 6 && (edge || core);
      }
    }
  };

  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  return grid
    .flatMap((row, r) => row.map((on, c) => (on ? `M${c + 2} ${r + 2}h1v1h-1z` : '')))
    .join('');
}

export function characters(words: string): number {
  return Array.from(words).length;
}
