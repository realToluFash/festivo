import { describe, expect, it } from 'vitest';

import { GUESTS_BOARDS } from './GuestsBoards.ts';
import {
  PASTE_STATES,
  areaStart,
  cardWords,
  countsAt,
  eventOf,
  guestsAt,
  roleOf,
} from './GuestsModel.ts';
import { GUESTS, REPLY_BY, TODAY, WEDDING } from './GuestsSample.ts';
import {
  LONG_QUOTE,
  QUOTE_LINES,
  hasText,
  invitationLine,
  invitationOf,
  pasteShown,
  pasteStart,
  repliesOpenOn,
  waitingCount,
  whoseRows,
} from './PasteReplyModel.ts';

const EN = 'en-US';

describe('Paste a reply on Guests (sc-54450)', () => {
  it('shows only with guests.manage, replies open and someone invited', () => {
    expect(pasteShown({ manage: true, repliesOpen: true, invited: 1 })).toBe(true);
    expect(pasteShown({ manage: false, repliesOpen: true, invited: 142 })).toBe(false);
    expect(pasteShown({ manage: true, repliesOpen: false, invited: 142 })).toBe(false);
    expect(pasteShown({ manage: true, repliesOpen: true, invited: 0 })).toBe(false);
  });

  it('hides on a Draft, where nobody is invited yet', () => {
    const counts = countsAt('draft', eventOf('draft'), guestsAt('draft'), 0);
    expect(counts.invited).toBe(0);
    expect(counts.list).toBeGreaterThan(0);
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

  it('says when replies closed on the card after the Reply by day', () => {
    const counts = countsAt('pasteClosed', WEDDING, GUESTS, 0);
    const card = cardWords('pasteClosed', 'owner', counts, false, EN, REPLY_BY);
    expect(card.line).toBe('Replies closed on Wed, Nov 4.');
    expect(pasteStart('pasteClosed').closed).toBe(true);
  });
});

describe('Whose reply is this? (sc-54450)', () => {
  it('lists the guests still waiting, newest invitation first and ties by name', () => {
    expect(whoseRows(GUESTS, '', EN).map((row) => row.key)).toEqual([
      'nadia',
      'tomas',
      'seun',
      'emeka',
      'joaquin',
    ]);
  });

  it('gives each row its reply and the invitation line', () => {
    const [emeka] = whoseRows(GUESTS, 'emeka', EN);
    expect(emeka?.line).toBe('No reply · invited on WhatsApp, Oct 9');
    const nadia = whoseRows(GUESTS, 'nadia', EN)[0];
    expect(nadia?.line).toBe('No reply · invited by Soirely’s message, Oct 12');
  });

  it('finds a guest who already replied, but never one not yet invited', () => {
    expect(whoseRows(GUESTS, 'okon', EN).map((row) => [row.key, row.kind])).toEqual([
      ['folasade', 'maybe'],
    ]);
    expect(whoseRows(GUESTS, 'bisi', EN)).toEqual([]);
    expect(whoseRows(GUESTS, '', EN).some((row) => row.kind === 'notyet')).toBe(false);
  });

  it('lists no companion as a row of its own', () => {
    expect(whoseRows(GUESTS, 'adanna', EN)).toEqual([]);
  });

  it('has nobody waiting once everyone invited has replied', () => {
    const all = guestsAt('whoseEveryone');
    expect(waitingCount(all)).toBe(0);
    expect(whoseRows(all, '', EN)).toEqual([]);
    expect(whoseRows(all, 'emeka', EN).map((row) => row.key)).toEqual(['emeka']);
  });

  it('words every way GuestInvitationMethod says they were invited', () => {
    const at = '2026-11-12T10:30:00+00:00';
    expect(invitationLine({ at, how: 'whatsapp' }, 'en-GB')).toBe('Invited on WhatsApp, 12 Nov');
    expect(invitationLine({ at, how: 'textMessage' }, EN)).toBe('Invited by text message, Nov 12');
    expect(invitationLine({ at, how: 'inPerson' }, EN)).toBe('Invited in person, Nov 12');
    expect(invitationLine({ at, how: 'reply' }, EN)).toBe('Invited when they replied, Nov 12');
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
