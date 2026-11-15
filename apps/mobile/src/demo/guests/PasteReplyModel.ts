import {
  type GuestsState,
  type PasteState,
  PASTE_STATES,
  dayWords,
  isIn,
  joined,
  matchesGuest,
} from './GuestsModel.ts';
import type { SampleGuest } from './GuestsSample.ts';
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

const INVITED_ON: Record<InvitationHow, (date: string) => string> = {
  whatsapp: (date) => `Invited on WhatsApp, ${date}`,
  textMessage: (date) => `Invited by text message, ${date}`,
  email: (date) => `Invited by email, ${date}`,
  inPerson: (date) => `Invited in person, ${date}`,
  other: (date) => `Invited another way, ${date}`,
  soirelyMessage: (date) => `Invited by Soirely’s message, ${date}`,
  reply: (date) => `Invited when they replied, ${date}`,
};

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

export function invitationLine(invitation: Invitation, locale: string): string {
  return INVITED_ON[invitation.how](dayWords(invitation.at.slice(0, 10), locale));
}

/** A copied message counts only when it has more than spaces in it. */
export function hasText(text: string | null | undefined): text is string {
  return text != null && text.trim() !== '';
}

/** The AC's rule: guests.manage, replies still open, and at least one guest invited. */
export function pasteShown({
  manage,
  repliesOpen,
  invited,
}: {
  manage: boolean;
  repliesOpen: boolean;
  invited: number;
}): boolean {
  return manage && repliesOpen && invited > 0;
}

export function repliesOpenOn(replyBy: string | null, today: string): boolean {
  return replyBy == null || today <= replyBy;
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

function rowOf(g: SampleGuest, invitation: Invitation, locale: string): WhoseRow {
  const line = invitationLine(invitation, locale);
  return {
    key: g.key,
    name: g.name,
    kind: g.kind,
    line: joined([REPLY_WORD[g.kind], line.charAt(0).toLowerCase() + line.slice(1)]),
  };
}

/** Whose reply is this?: with nothing typed, the guests still waiting; typed, anyone invited it matches. Newest invitation first, ties A to Z. */
export function whoseRows(
  guests: readonly SampleGuest[],
  typed: string,
  locale: string,
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
    .map(({ g, invitation }) => rowOf(g, invitation, locale));
}

export function waitingCount(guests: readonly SampleGuest[]): number {
  return guests.filter((g) => g.kind === 'noreply' && invitationOf(g) != null).length;
}

export const QUOTE_LINES = 6;

/** The demo's two copied messages; the long one names a companion and an allergy, and Soirely reads neither. */
export const SAMPLE_QUOTE = 'Yes, we’ll be there, the two of us. Thank you for having us!';
export const LONG_QUOTE = [
  'Hello Folake! So sorry for the slow reply, it has been a mad few weeks at the hospital.',
  'Yes, we will be there, the two of us. Adanna is coming with me, she says she would not miss it for anything.',
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
  closed: boolean;
}

const LIST: PasteStart = { flow: null, nothing: false, recorded: false, closed: false };

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
    pasteClosed: { ...LIST, closed: true },
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
