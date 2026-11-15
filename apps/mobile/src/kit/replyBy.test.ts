import type { Counts } from '@soirely/domain';
import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import {
  closedOn,
  guestRepliesOf,
  guestReplyBy,
  replyByAfterStart,
  replyByAsk,
  replyByAskWords,
  replyByPreview,
  replyByRow,
  replyBySaved,
  replyByWrong,
  repliesClosed,
  todayIn,
} from './replyBy.ts';

const i18n = createInstance();
void i18n.init({
  lng: 'en',
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
});
const t = i18n.t.bind(i18n);

const LONDON = 'Europe/London';
const EVENT = {
  timeZone: LONDON,
  replyBy: '2026-10-25',
  repliesCloseAt: '2026-10-25T23:59:59+00:00',
  repliesClosedOn: null,
};
const COUNTS = {
  havent: 25,
  haventGuests: 21,
  haventCompanions: 4,
} as Counts;

describe('Reply by closes at 23:59:59 on its day, in the event’s zone', () => {
  it('stays open to the last second across the clocks going back, and closes on it', () => {
    expect(repliesClosed(EVENT, new Date('2026-10-25T23:59:58Z'))).toBe(false);
    expect(repliesClosed(EVENT, new Date('2026-10-25T23:59:59Z'))).toBe(true);
  });

  it('is closed at once after Close replies now, and names the day of that save', () => {
    const saved = { ...EVENT, replyBy: '2026-11-05', repliesClosedOn: '2026-11-08' };
    expect(repliesClosed(saved, new Date('2026-11-08T10:00:00Z'))).toBe(true);
    expect(closedOn(saved, new Date('2026-11-08T10:00:00Z'))).toBe('2026-11-08');
  });

  it('names the Reply by day when replies closed at its end, and nothing while open', () => {
    expect(closedOn(EVENT, new Date('2026-10-27T10:00:00Z'))).toBe('2026-10-25');
    expect(closedOn(EVENT, new Date('2026-10-20T10:00:00Z'))).toBeNull();
  });

  it('reads today in the event’s zone, not the reader’s', () => {
    expect(todayIn(new Date('2026-11-03T23:30:00Z'), 'Africa/Lagos')).toBe('2026-11-04');
    expect(todayIn(new Date('2026-11-03T23:30:00Z'), LONDON)).toBe('2026-11-03');
  });
});

describe('the Reply by row', () => {
  it('reads the date over when replies close, then over Replies closed', () => {
    expect(replyByRow(EVENT, 'en-GB', new Date('2026-10-20T10:00:00Z'), t)).toEqual({
      title: 'Sun, 25 Oct 2026',
      line: 'Reply by · Replies close at 23:59, Europe/London time',
    });
    expect(replyByRow(EVENT, 'en-GB', new Date('2026-10-26T10:00:00Z'), t).line).toBe(
      'Reply by · Replies closed',
    );
  });

  it('with no date, says replies stay open until the start', () => {
    const none = { ...EVENT, replyBy: null, repliesCloseAt: null };
    expect(replyByRow(none, 'en-GB', new Date(), t)).toEqual({
      title: 'Replies stay open until the event starts',
      line: 'Reply by',
    });
  });
});

describe('the Reply by part', () => {
  it('refuses a day on or after the start’s', () => {
    expect(replyByWrong('2026-11-05', '2026-11-05')).toBe(true);
    expect(replyByWrong('2026-11-04', '2026-11-05')).toBe(false);
    expect(replyByWrong(null, '2026-11-05')).toBe(false);
  });

  it('asks before an earlier day or a past one, never with nobody left to reply', () => {
    expect(replyByAsk('2026-11-04', '2026-11-03', '2026-11-01', 25)).toBe('sooner');
    expect(replyByAsk('2026-11-04', '2026-10-30', '2026-11-01', 25)).toBe('now');
    expect(replyByAsk('2026-11-03', '2026-11-04', '2026-11-01', 25)).toBeNull();
    expect(replyByAsk(null, '2026-11-04', '2026-11-01', 25)).toBeNull();
    expect(replyByAsk('2026-11-04', '2026-10-30', '2026-11-01', 0)).toBeNull();
  });

  it('asks with Guests’ card’s own count sentence', () => {
    expect(replyByAskWords('sooner', '2026-11-03', COUNTS, 'en-GB', t)).toEqual({
      title: 'Close replies sooner, on Tue 3 Nov?',
      line: '25 haven’t replied (21 guests and 4 companions). After that day they can’t reply, unless you let them change their reply.',
      confirm: 'Close replies sooner',
    });
    expect(replyByAskWords('now', '2026-10-30', COUNTS, 'en-GB', t).title).toBe(
      'Close replies now?',
    );
  });

  it('previews the guests’ page only for a day still to come', () => {
    expect(replyByPreview('2026-11-04', '2026-11-01', 'en-GB', t)).toBe(
      'On the guests’ page: “Please answer by Wednesday 4 November. You can change your answer any time before then.”',
    );
    expect(replyByPreview('2026-10-30', '2026-11-01', 'en-GB', t)).toBeNull();
  });

  it('says one toast for the saved day, Replies are now closed for a past one, and open for none', () => {
    const now = new Date('2026-11-01T10:00:00Z');
    expect(replyBySaved('2026-11-04', LONDON, 'en-GB', now, t)).toBe(
      'Saved. Replies close on Wed 4 Nov at 23:59, Europe/London time.',
    );
    expect(replyBySaved('2026-10-30', LONDON, 'en-GB', now, t)).toBe(
      'Saved. Replies are now closed.',
    );
    expect(replyBySaved(null, LONDON, 'en-GB', now, t)).toBe(
      'Saved. Replies stay open until the event starts.',
    );
  });

  it('moves Reply by to the day before a start moved onto it, tomorrow or today', () => {
    expect(replyByAfterStart('2026-11-04', '2026-11-02')).toBe('2026-11-01');
    expect(replyByAfterStart('2026-11-04', '2026-11-04')).toBe('2026-11-03');
    expect(replyByAfterStart('2026-11-04', '2026-11-10')).toBeNull();
    expect(replyByAfterStart(null, '2026-11-02')).toBeNull();
  });
});

describe('a guest’s card after Reply by', () => {
  const closed = guestRepliesOf(EVENT, new Date('2026-10-27T10:00:00Z'));

  it('offers Let them change their reply to those who manage guests, and only the day to others', () => {
    const guest = { repliesReopened: null };
    expect(guestReplyBy(guest, 'coming', closed, true, LONDON, 'en-GB', t)).toMatchObject({
      card: 'Replies closed on Sun, 25 Oct 2026. Record a reply opens again if you let them change their reply.',
      reopens: true,
    });
    expect(guestReplyBy(guest, 'noReply', closed, false, LONDON, 'en-GB', t)).toMatchObject({
      card: 'Replies closed on Sun, 25 Oct 2026.',
      reopens: false,
    });
  });

  it('says who reopened them, and leaves a guest not yet invited alone', () => {
    const reopened = { repliesReopened: { by: 'Ada Obi', at: '2026-10-28T09:00:00Z' } };
    expect(guestReplyBy(reopened, 'noReply', closed, true, LONDON, 'en-GB', t)).toMatchObject({
      card: 'Reply reopened by Ada Obi, 28 Oct. They can answer until the event starts.',
      reopens: false,
    });
    expect(
      guestReplyBy({ repliesReopened: null }, 'notYetInvited', closed, true, LONDON, 'en-GB', t)
        .card,
    ).toBeNull();
  });

  it('reads a Not sure yet reply with the day it was asked to decide by', () => {
    const open = guestRepliesOf(EVENT, new Date('2026-10-20T10:00:00Z'));
    expect(
      guestReplyBy({ repliesReopened: null }, 'maybe', open, true, LONDON, 'en-GB', t),
    ).toEqual({
      card: null,
      reopens: false,
      reply: 'Not sure yet · asked to decide by Sun 25 Oct',
      asked: 'asked to decide by Sun 25 Oct',
    });
    expect(
      guestReplyBy({ repliesReopened: null }, 'coming', open, true, LONDON, 'en-GB', t).reply,
    ).toBeNull();
  });
});
