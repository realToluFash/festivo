import type { TFunction } from 'i18next';

import {
  type AreaStart,
  type GuestsState,
  type PasteState,
  PASTE_STATES,
  type Role,
  dayWords,
  guestsOpening,
  isIn,
  joined,
  matchesGuest,
} from './GuestsModel.ts';
import { type SampleGuest, TODAY } from './GuestsSample.ts';
import { REPLY_WORD } from './GuestsWords.ts';

/** sc-54450's English: the AC's words, and Apple's own "Paste" on iOS. */
export const PW = {
  paste: 'Paste',
  pasteReply: 'Paste a reply',
  nothingToPaste: 'Nothing to paste. Copy their message in your chat, then try again.',
  whose: 'Whose reply is this?',
  theirMessage: 'Their message',
  showAll: 'Show all',
  everyoneReplied: 'Everyone you invited has replied. Find a guest to change their reply.',
  byMessage: 'By message',
  demoTitle: 'Demo only: your clipboard is not read',
  pasteSample: 'Paste the sample message',
  pasteLong: 'Paste a long message',
  pasteNothing: 'Paste nothing',
} as const;

/** GuestInvitationMethod's values, as GuestSerialiser sends them in `invitation.how`. */
export type InvitationHow =
  'whatsapp' | 'textMessage' | 'email' | 'inPerson' | 'other' | 'soirelyMessage' | 'reply';

export interface Invitation {
  at: string;
  how: InvitationHow;
}

const SAMPLE_HOW: Readonly<Record<string, InvitationHow>> = {
  whatsapp: 'whatsapp',
  'text message': 'textMessage',
  email: 'email',
  'in person': 'inPerson',
};

/** The sample's invitation as the API sends it: by hand, Soirely's message, or from their reply. */
export function invitationOf(g: SampleGuest): Invitation | null {
  if (g.kind === 'walkin' || g.kind === 'notyet') return null;
  if (g.invited != null)
    return {
      at: g.invited.day,
      how:
        g.invited.how == null
          ? 'soirelyMessage'
          : (SAMPLE_HOW[g.invited.how.toLowerCase()] ?? 'other'),
    };
  return g.when == null ? null : { at: g.when, how: 'reply' };
}

/** sc-3788's invitation line, in its own words from the catalogue, shown as written. */
export function invitationLine(invitation: Invitation, locale: string, t: TFunction): string {
  const date = dayWords(invitation.at.slice(0, 10), locale);
  switch (invitation.how) {
    case 'soirelyMessage':
      return t('guestList.invitedByMessage', { date });
    case 'reply':
      return t('guestList.invitedWhenReplied', { date });
    default:
      return t('guestList.invitedHow', { how: t(`guestList.howMid.${invitation.how}`), date });
  }
}

/** A copied message counts only when it has more than spaces in it. */
export function hasText(text: string | null | undefined): text is string {
  return text != null && text.trim() !== '';
}

export function repliesOpenOn(replyBy: string | null, today: string): boolean {
  return replyBy == null || today <= replyBy;
}

export interface PasteInputs {
  phase: AreaStart['phase'];
  empty: boolean;
  role: Role;
  replies: AreaStart['replies'];
  replyBy: string | null;
  today: string;
  invited: number;
}

/** The AC's rule: Guests loaded with someone on it, guests.manage, replies open (sc-3787's closed, and the Reply by day), and someone invited. */
export function pasteShown(p: PasteInputs): boolean {
  return (
    p.phase === 'ok' &&
    !p.empty &&
    p.role === 'owner' &&
    p.replies !== 'closed' &&
    repliesOpenOn(p.replyBy, p.today) &&
    p.invited > 0
  );
}

/** Whether a demo state opens with Paste a reply, from the same inputs the screen holds. */
export function pasteShownAt(state: GuestsState, event: string): boolean {
  const { start, role, replyBy, counts } = guestsOpening(state, event, 'en-US');
  return pasteShown({
    phase: start.phase,
    empty: start.empty,
    role,
    replies: start.replies,
    replyBy,
    today: TODAY,
    invited: counts.invited,
  });
}

export interface WhoseRow {
  key: string;
  name: string;
  kind: SampleGuest['kind'];
  line: string;
}

function newestFirst(locale: string) {
  return (a: { g: SampleGuest; at: string }, b: { g: SampleGuest; at: string }) =>
    a.at === b.at ? a.g.name.localeCompare(b.g.name, locale) : a.at < b.at ? 1 : -1;
}

function rowOf(g: SampleGuest, invitation: Invitation, locale: string, t: TFunction): WhoseRow {
  return {
    key: g.key,
    name: g.name,
    kind: g.kind,
    line: joined([REPLY_WORD[g.kind], invitationLine(invitation, locale, t)]),
  };
}

/** Whose reply is this?: with nothing typed, the guests still waiting; typed, anyone invited it matches. Newest invitation first, ties A to Z. */
export function whoseRows(
  guests: readonly SampleGuest[],
  typed: string,
  locale: string,
  t: TFunction,
): WhoseRow[] {
  const looking = typed.trim() !== '';
  return guests
    .flatMap((g) => {
      const invitation = invitationOf(g);
      if (invitation == null) return [];
      if (!looking && g.kind !== 'noreply') return [];
      if (looking && !matchesGuest(g.name, g, typed)) return [];
      return [{ g, at: invitation.at, invitation }];
    })
    .sort(newestFirst(locale))
    .map(({ g, invitation }) => rowOf(g, invitation, locale, t));
}

export function waitingCount(guests: readonly SampleGuest[]): number {
  return guests.filter((g) => g.kind === 'noreply' && invitationOf(g) != null).length;
}

export const QUOTE_LINES = 6;

/** The demo's two copied messages; the long one names a companion and an allergy, and Soirely reads neither. */
export const SAMPLE_QUOTE = 'Yes, we’ll be there, the two of us. Thank you for having us!';
export const LONG_QUOTE = [
  'Hello Folake! So sorry for the slow reply, it has been a mad few weeks at the hospital.',
  'Yes, we will be there, the two of us. Adanna is coming with me and would not miss it for anything.',
  'One thing: Adanna has a nut allergy, a bad one, so please could the kitchen know? Peanuts and tree nuts both.',
  'We land on the Friday and are staying near the venue, so the 18:00 start is fine for us.',
  'Do we need to bring anything, or wear anything in particular? Adanna wants to know about colours.',
  'Thank you again for having us. Can’t wait to see everyone.',
  'Emeka',
].join('\n\n');

export type PasteStep = 'whose' | 'record';

export interface PasteFlow {
  step: PasteStep;
  quote: string;
  all: boolean;
  typed: string;
  guest: string | null;
  start: 'open' | 'blank' | 'offline' | null;
}

export interface PasteStart {
  flow: PasteFlow | null;
  nothing: boolean;
  recorded: boolean;
}

const LIST: PasteStart = { flow: null, nothing: false, recorded: false };

function whose(rest: Partial<PasteFlow> = {}): PasteStart {
  return {
    ...LIST,
    flow: {
      step: 'whose',
      quote: SAMPLE_QUOTE,
      all: false,
      typed: '',
      guest: null,
      start: null,
      ...rest,
    },
  };
}

function fromMessage(start: PasteFlow['start']): PasteStart {
  return whose({ step: 'record', guest: 'emeka', start });
}

export function pasteStart(state: GuestsState | null): PasteStart {
  if (!isIn(PASTE_STATES, state)) return LIST;
  const states: Record<PasteState, PasteStart> = {
    paste: LIST,
    pasteNothing: { ...LIST, nothing: true },
    pasteClosed: LIST,
    whose: whose(),
    whoseLong: whose({ quote: LONG_QUOTE }),
    whoseAll: whose({ quote: LONG_QUOTE, all: true }),
    whoseSearch: whose({ typed: 'okon' }),
    whoseNone: whose({ typed: 'bisi' }),
    whoseEveryone: whose(),
    whoseOffline: whose(),
    fromMessage: fromMessage('open'),
    fromMessageBlank: fromMessage('blank'),
    fromMessageOffline: fromMessage('offline'),
    fromMessageSaved: { ...LIST, recorded: true },
  };
  return states[state];
}
