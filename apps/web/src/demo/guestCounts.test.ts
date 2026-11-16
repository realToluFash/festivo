import { describe, expect, it } from 'vitest';

import { CLOCKS, resetSample, sampleEvents } from './events.ts';
import {
  FIGURE_OPENS,
  GUEST_WORDS,
  SAMPLE_GUESTS,
  eventsOfTile,
  figureOf,
  guestCountsOf,
  rowGuests,
  withReply,
} from './guestCounts.ts';
import { COMING, GUESTS_N, NOT_REPLIED, countOf } from './messages.ts';
import { GROUPS } from './messagesTo.ts';

describe('the guest counts on Events (sc-23284)', () => {
  it('adds up the live, happening now and paused events', () => {
    resetSample();

    expect(guestCountsOf(sampleEvents(), SAMPLE_GUESTS, CLOCKS.rest)).toEqual({
      invited: 367,
      coming: 211,
      replied: 266,
      notReplied: 101,
    });
  });

  it('counts the wedding as Messaging does', () => {
    expect(SAMPLE_GUESTS['evt-wed-4']).toEqual({
      invited: GUESTS_N,
      coming: countOf(COMING, GROUPS),
      replied: GUESTS_N - (countOf(NOT_REPLIED, GROUPS) ?? 0),
    });
  });

  it('drops an event once it is finished', () => {
    resetSample();

    expect(guestCountsOf(sampleEvents(), SAMPLE_GUESTS, CLOCKS.finished).invited).toBe(225);
  });

  it('counts 0 when nobody is invited, never a blank', () => {
    resetSample();

    expect(guestCountsOf(sampleEvents(), {}, CLOCKS.rest)).toEqual({
      invited: 0,
      coming: 0,
      replied: 0,
      notReplied: 0,
    });
    expect(GUEST_WORDS.coming(0)).toBe('0 coming');
    expect(GUEST_WORDS.notReplied(0)).toBe('0 haven’t replied');
    expect(GUEST_WORDS.notReplied(1)).toBe('1 hasn’t replied');
  });

  it('formats the figures for the language, as 1,250 in English', () => {
    expect(figureOf(1250)).toBe('1,250');
    expect(GUEST_WORDS.coming(1250)).toBe('1,250 coming');
    expect(GUEST_WORDS.notReplied(1250)).toBe('1,250 haven’t replied');
  });
});

describe('each event’s guest line as links (sc-3786, pm 12 Nov)', () => {
  it('opens Guests with Coming, and with No reply for haven’t replied', () => {
    expect(FIGURE_OPENS).toEqual({ coming: 'coming', notReplied: 'noReply' });
  });

  it('adds each event’s line up to the tiles', () => {
    resetSample();
    const events = sampleEvents();
    const rows = events.map((event) => rowGuests(event, SAMPLE_GUESTS, CLOCKS.rest));
    const tiles = guestCountsOf(events, SAMPLE_GUESTS, CLOCKS.rest);

    expect(rows.reduce((sum, row) => sum + (row?.coming ?? 0), 0)).toBe(tiles.coming);
    expect(rows.reduce((sum, row) => sum + (row?.notReplied ?? 0), 0)).toBe(tiles.notReplied);
  });

  it('moves every figure that counts a reply, in place', () => {
    resetSample();
    const after = withReply(SAMPLE_GUESTS, 'evt-wed-4');
    const wedding = sampleEvents().find((event) => event.id === 'evt-wed-4');

    expect(wedding && rowGuests(wedding, after, CLOCKS.rest)).toEqual({
      coming: 97,
      notReplied: 24,
    });
    expect(guestCountsOf(sampleEvents(), after, CLOCKS.rest).notReplied).toBe(100);
  });

  it('narrows Events to the events each tile counts', () => {
    resetSample();
    const events = sampleEvents();
    const replied = eventsOfTile('replied', events, SAMPLE_GUESTS, CLOCKS.rest);

    expect(replied.length).toBeGreaterThan(0);
    expect(eventsOfTile('invited', events, {}, CLOCKS.rest)).toEqual([]);
  });

  it('names each link by its words and where it leads', () => {
    expect(GUEST_WORDS.notRepliedOpens('Ada & Tunde')).toBe(
      'opens the guests of Ada & Tunde with no reply',
    );
    expect(GUEST_WORDS.tileShown.replied(3, 4)).toBe(
      'Events with guests who haven’t replied · 3 of 4',
    );
  });
});
