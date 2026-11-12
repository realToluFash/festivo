import { describe, expect, it } from 'vitest';

import { TO_FIGURES } from '../messages/MessagesSample.ts';
import { CLOCKS, EVENTS } from './EventsSample.ts';
import {
  FIGURE_OPENS,
  GUEST_WORDS,
  SAMPLE_GUESTS,
  eventsOfTile,
  figureOf,
  guestCountsOf,
  rowGuests,
  withReply,
} from './GuestCounts.ts';

describe('the guest counts on Events (sc-23284)', () => {
  it('adds up the live, happening now and paused events, as the web demo does', () => {
    expect(guestCountsOf(EVENTS, SAMPLE_GUESTS, new Date(CLOCKS.reader))).toEqual({
      invited: 367,
      coming: 211,
      replied: 266,
      notReplied: 101,
    });
  });

  it('counts the wedding as Messaging does', () => {
    expect(SAMPLE_GUESTS['evt-wed-4']).toEqual({
      invited: TO_FIGURES.all.count,
      coming: TO_FIGURES.coming.count,
      replied: TO_FIGURES.all.count - TO_FIGURES.notReplied.count,
    });
  });

  it('adds each event’s row up to the tiles, on every clock', () => {
    for (const clock of Object.values(CLOCKS)) {
      const now = new Date(clock);
      const rows = EVENTS.map((event) => rowGuests(event, SAMPLE_GUESTS, now)).filter(
        (row) => row != null,
      );
      const tiles = guestCountsOf(EVENTS, SAMPLE_GUESTS, now);
      expect(rows.reduce((sum, row) => sum + row.coming, 0)).toBe(tiles.coming);
      expect(rows.reduce((sum, row) => sum + row.notReplied, 0)).toBe(tiles.notReplied);
    }
  });

  it('drops an event once it is finished', () => {
    expect(guestCountsOf(EVENTS, SAMPLE_GUESTS, new Date(CLOCKS.finished)).invited).toBe(225);
  });

  it('counts 0 when nobody is invited, never a blank', () => {
    expect(guestCountsOf(EVENTS, {}, new Date(CLOCKS.reader))).toEqual({
      invited: 0,
      coming: 0,
      replied: 0,
      notReplied: 0,
    });
    expect(GUEST_WORDS.coming(0)).toBe('0 coming');
    expect(GUEST_WORDS.notReplied(1)).toBe('1 hasn’t replied');
  });

  it('formats the figures for the language, as 1,250 in English', () => {
    expect(figureOf(1250, 'en-US')).toBe('1,250');
    expect(GUEST_WORDS.coming(1250, 'en-GB')).toBe('1,250 coming');
    expect(GUEST_WORDS.notReplied(1250)).toBe('1,250 haven’t replied');
  });
});

describe('each event’s guest line as links (sc-3786, pm 12 Nov)', () => {
  const now = new Date(CLOCKS.reader);

  it('opens Guests with Coming, and with No reply for haven’t replied', () => {
    expect(FIGURE_OPENS).toEqual({ coming: 'coming', notReplied: 'noreply' });
  });

  it('moves every figure that counts a reply, in place', () => {
    const after = withReply(SAMPLE_GUESTS, 'evt-wed-4');
    expect(
      rowGuests(
        EVENTS.find((e) => e.id === 'evt-wed-4')!,
        after,
        now,
      ),
    ).toEqual({
      coming: 97,
      notReplied: 24,
    });
    const tiles = guestCountsOf(EVENTS, after, now);
    expect(tiles.coming).toBe(212);
    expect(tiles.notReplied).toBe(100);
  });

  it('leaves an event where everyone replied alone', () => {
    const all = { x: { invited: 2, coming: 1, replied: 2 } };
    expect(withReply(all, 'x')).toBe(all);
  });

  it('narrows Events to the events each tile counts', () => {
    const replied = eventsOfTile('replied', EVENTS, SAMPLE_GUESTS, now).map((e) => e.id);
    const invited = eventsOfTile('invited', EVENTS, SAMPLE_GUESTS, now).map((e) => e.id);
    expect(replied.length).toBeGreaterThan(0);
    expect(invited).toEqual(expect.arrayContaining(replied));
    expect(eventsOfTile('invited', EVENTS, {}, now)).toEqual([]);
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
