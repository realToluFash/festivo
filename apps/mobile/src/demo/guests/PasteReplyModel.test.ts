import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../../i18n/locales/en.json';
import { GUESTS_BOARDS } from './GuestsBoards.ts';
import {
  type GuestsState,
  PASTE_STATES,
  areaStart,
  eventOf,
  guestsAt,
  roleOf,
} from './GuestsModel.ts';
import { GUESTS, REPLY_BY, TODAY } from './GuestsSample.ts';
import {
  LONG_QUOTE,
  type PasteInputs,
  QUOTE_LINES,
  hasText,
  invitationLine,
  invitationOf,
  pasteShown,
  pasteShownAt,
  pasteStart,
  repliesOpenOn,
  waitingCount,
  whoseRows,
} from './PasteReplyModel.ts';

const EN = 'en-US';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const shownAt = (state: GuestsState) => pasteShownAt(state, eventOf(state));

describe('Paste a reply on Guests (sc-54450)', () => {
  const open: PasteInputs = {
    phase: 'ok',
    empty: false,
    role: 'owner',
    replies: null,
    replyBy: REPLY_BY,
    today: TODAY,
    invited: 1,
  };

  it('shows only with guests.manage, replies open and someone invited', () => {
    expect(pasteShown(open)).toBe(true);
    expect(pasteShown({ ...open, role: 'viewer' })).toBe(false);
    expect(pasteShown({ ...open, replies: 'closed' })).toBe(false);
    expect(pasteShown({ ...open, replies: 'reopened' })).toBe(true);
    expect(pasteShown({ ...open, today: '2026-11-05' })).toBe(false);
    expect(pasteShown({ ...open, invited: 0 })).toBe(false);
    expect(pasteShown({ ...open, empty: true })).toBe(false);
    expect(pasteShown({ ...open, phase: 'loading' })).toBe(false);
  });

  it('opens with it where the AC shows it, and without it everywhere else', () => {
    expect(shownAt('paste')).toBe(true);
    expect(shownAt('draft')).toBe(false);
    expect(shownAt('viewer')).toBe(false);
    expect(shownAt('repliesClosed')).toBe(false);
    expect(shownAt('pasteClosed')).toBe(false);
  });

  it('keeps replies open through the Reply by day and closes them after it', () => {
    expect(repliesOpenOn(REPLY_BY, TODAY)).toBe(true);
    expect(repliesOpenOn(REPLY_BY, REPLY_BY)).toBe(true);
    expect(repliesOpenOn(REPLY_BY, '2026-11-05')).toBe(false);
    expect(repliesOpenOn(null, '2027-01-01')).toBe(true);
  });

  it('counts a message of only spaces as nothing to paste', () => {
    expect(hasText(' \n\t ')).toBe(false);
    expect(hasText('')).toBe(false);
    expect(hasText(null)).toBe(false);
    expect(hasText('Yes')).toBe(true);
  });

  it('closes replies on pasteClosed as Replies closed does, with no flag of its own', () => {
    expect(areaStart('pasteClosed').replies).toBe('closed');
    expect(areaStart('repliesClosed').replies).toBe('closed');
  });
});

describe('Whose reply is this? (sc-54450)', () => {
  it('lists the guests still waiting, newest invitation first and ties by name', () => {
    expect(whoseRows(GUESTS, '', EN, t).map((row) => row.key)).toEqual([
      'nadia',
      'tomas',
      'seun',
      'emeka',
      'joaquin',
    ]);
  });

  it('gives each row its reply and the sc-3788 invitation line, as written', () => {
    const [emeka] = whoseRows(GUESTS, 'emeka', EN, t);
    expect(emeka?.line).toBe('No reply · Invited, WhatsApp, Oct 9');
    const nadia = whoseRows(GUESTS, 'nadia', EN, t)[0];
    expect(nadia?.line).toBe('No reply · Invited by Soirely’s message, Oct 12');
  });

  it('finds a guest who already replied, but never one not yet invited', () => {
    expect(whoseRows(GUESTS, 'okon', EN, t).map((row) => [row.key, row.kind])).toEqual([
      ['folasade', 'maybe'],
    ]);
    expect(whoseRows(GUESTS, 'bisi', EN, t)).toEqual([]);
    expect(whoseRows(GUESTS, '', EN, t).some((row) => row.kind === 'notyet')).toBe(false);
  });

  it('lists no companion as a row of its own', () => {
    expect(whoseRows(GUESTS, 'adanna', EN, t)).toEqual([]);
  });

  it('has nobody waiting once everyone invited has replied', () => {
    const all = guestsAt('whoseEveryone');
    expect(waitingCount(all)).toBe(0);
    expect(whoseRows(all, '', EN, t)).toEqual([]);
    expect(whoseRows(all, 'emeka', EN, t).map((row) => row.key)).toEqual(['emeka']);
  });

  it('words every way GuestInvitationMethod says they were invited, in the catalogue words', () => {
    const at = '2026-11-12T10:30:00+00:00';
    const line = (how: Parameters<typeof invitationLine>[0]['how'], locale = EN) =>
      invitationLine({ at, how }, locale, t);
    expect(line('whatsapp', 'en-GB')).toBe('Invited, WhatsApp, 12 Nov');
    expect(line('textMessage')).toBe('Invited, text message, Nov 12');
    expect(line('email')).toBe('Invited, email, Nov 12');
    expect(line('inPerson')).toBe('Invited, in person, Nov 12');
    expect(line('other')).toBe('Invited, another way, Nov 12');
    expect(line('soirelyMessage')).toBe('Invited by Soirely’s message, Nov 12');
    expect(line('reply')).toBe('Invited when they replied, Nov 12');
  });

  it('reads the invitation the sample guests carry', () => {
    const by = (key: string) => GUESTS.find((g) => g.key === key);
    expect(invitationOf(by('seun')!)?.how).toBe('textMessage');
    expect(invitationOf(by('joaquin')!)?.how).toBe('inPerson');
    expect(invitationOf(by('bisi')!)).toBeNull();
  });

  it('opens the long message clipped, and Show all opens it whole', () => {
    expect(LONG_QUOTE.split('\n').length).toBeGreaterThan(QUOTE_LINES);
    expect(pasteStart('whoseLong').flow?.all).toBe(false);
    expect(pasteStart('whoseAll').flow?.all).toBe(true);
  });
});

describe('the paste states', () => {
  it('opens each from the demo list, as an owner', () => {
    const hrefs = GUESTS_BOARDS.map((board) => board.href);
    for (const state of PASTE_STATES) {
      expect(hrefs).toContain(`/demo/guests?state=${state}`);
      expect(roleOf(state)).toBe('owner');
    }
  });

  it('opens Record a reply on Emeka, from the message, offline where it is refused', () => {
    expect(pasteStart('fromMessage').flow).toMatchObject({ step: 'record', guest: 'emeka' });
    expect(pasteStart('fromMessageOffline').flow?.start).toBe('offline');
    expect(areaStart('fromMessageOffline').offline).toBe(true);
    expect(areaStart('whoseOffline').offline).toBe(true);
  });

  it('counts the saved reply like any other', () => {
    const emeka = guestsAt('fromMessageSaved').find((g) => g.key === 'emeka');
    expect(emeka?.kind).toBe('coming');
    expect(emeka?.recorded).toEqual({ how: 'By message', day: TODAY });
    expect(pasteStart('fromMessageSaved').recorded).toBe(true);
  });
});
