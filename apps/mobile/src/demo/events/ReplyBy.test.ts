import { describe, expect, it } from 'vitest';

import { editOf, eventStateOf } from './EventsModel.ts';
import { W, say } from './EventsWords.ts';
import { replyByOf } from '../guests/GuestsSample.ts';
import { type Counts, cardWords } from '../guests/GuestsModel.ts';
import {
  closesAt,
  datesAsk,
  datesSaveSays,
  noReplyOf,
  replyByAskCount,
  previewsReplyBy,
  replyByAfterStart,
  replyByAsk,
  replyByHint,
  replyByInTell,
  replyByMoves,
  replyByPreview,
  replyByRow,
  replyBySaved,
  replyByWrong,
  todayIn,
} from './ReplyBy.ts';

const LONDON = 'Europe/London';
const STARTS = '2026-11-05T18:00:00.000Z';

describe('Reply by closes at the end of its day, in the event’s zone', () => {
  it('is 23:59:59 local, on either side of the clocks going back', () => {
    expect(closesAt('2026-10-24', LONDON).toISOString()).toBe('2026-10-24T22:59:59.000Z');
    expect(closesAt('2026-10-25', LONDON).toISOString()).toBe('2026-10-25T23:59:59.000Z');
    expect(closesAt('2026-11-04', 'Africa/Lagos').toISOString()).toBe('2026-11-04T22:59:59.000Z');
  });

  it('reads today in the event’s zone, not the reader’s', () => {
    expect(todayIn(new Date('2026-11-03T23:30:00Z'), 'Africa/Lagos')).toBe('2026-11-04');
    expect(todayIn(new Date('2026-11-03T23:30:00Z'), LONDON)).toBe('2026-11-03');
  });
});

describe('the check before anything is sent', () => {
  it('refuses the start’s own day and after, and takes any day before it', () => {
    expect(replyByWrong('2026-11-05', STARTS, LONDON)).toBe(true);
    expect(replyByWrong('2026-11-09', STARTS, LONDON)).toBe(true);
    expect(replyByWrong('2026-11-04', STARTS, LONDON)).toBe(false);
    expect(replyByWrong(null, STARTS, LONDON)).toBe(false);
  });
});

describe('which Ask, if any', () => {
  const today = '2026-11-03';
  const wedding = { guests: 21, companions: 4 };
  const nobody = { guests: 0, companions: 0 };

  it('asks to close sooner for an earlier day still to come, today included', () => {
    expect(replyByAsk('2026-11-04', '2026-11-03', today, wedding)).toBe('sooner');
  });

  it('asks to close now for a day already past, with or without a date before', () => {
    expect(replyByAsk('2026-11-04', '2026-11-02', today, wedding)).toBe('now');
    expect(replyByAsk(null, '2026-11-01', today, wedding)).toBe('now');
    expect(replyByAsk(null, '2026-11-01', today, { guests: 0, companions: 2 })).toBe('now');
  });

  it('saves with no Ask for a later day, a first day to come, a removed date or nobody to close for', () => {
    expect(replyByAsk('2026-11-03', '2026-11-04', today, wedding)).toBeNull();
    expect(replyByAsk(null, '2026-11-04', today, wedding)).toBeNull();
    expect(replyByAsk('2026-11-04', null, today, wedding)).toBeNull();
    expect(replyByAsk('2026-11-04', '2026-11-02', today, nobody)).toBeNull();
  });
});

describe('the preview of the guest’s sentence', () => {
  it('shows for today or a day still to come, never for a past day or none', () => {
    expect(previewsReplyBy('2026-11-04', '2026-11-03')).toBe(true);
    expect(previewsReplyBy('2026-11-03', '2026-11-03')).toBe(true);
    expect(previewsReplyBy('2026-11-02', '2026-11-03')).toBe(false);
    expect(previewsReplyBy(null, '2026-11-03')).toBe(false);
  });
});

describe('a start moved onto Reply by (pm, 8 Nov)', () => {
  it('moves Reply by to the day before a start on or before it, and leaves it for a later start', () => {
    expect(replyByAfterStart('2026-11-04', '2026-11-04')).toBe('2026-11-03');
    expect(replyByAfterStart('2026-11-04', '2026-11-02')).toBe('2026-11-01');
    expect(replyByAfterStart('2026-11-04', '2026-11-01')).toBe('2026-10-31');
    expect(replyByAfterStart('2026-11-04', '2026-11-05')).toBeNull();
    expect(replyByAfterStart('2026-11-04', '2026-11-12')).toBeNull();
    expect(replyByAfterStart(null, '2026-11-01')).toBeNull();
  });

  it('says so under the start, then toasts the Reply by part’s own line (l10n, #33572)', () => {
    const today = new Date('2026-11-03T09:41:00Z');

    expect(replyByMoves('2026-11-04', '2026-11-03', 'en-US')).toBe(
      'Replies close on Wed, Nov 4, which isn’t before the new start. Saving moves Reply by to Tue, Nov 3.',
    );
    expect(replyBySaved('2026-11-03', LONDON, 'en-US', today)).toBe(
      'Saved. Replies close on Tue, Nov 3 at 23:59, Europe/London time.',
    );
    expect(replyBySaved('2026-11-02', LONDON, 'en-US', today)).toBe(
      'Saved. Replies are now closed.',
    );
  });

  it('closes the moved day at 23:59:59 in the event’s zone', () => {
    const moved = replyByAfterStart('2026-11-04', '2026-11-04');
    expect(moved && closesAt(moved, LONDON).toISOString()).toBe('2026-11-03T23:59:59.000Z');
  });
});

describe('the Ask counts with the Guests card’s own sentence', () => {
  const counts = (havent: number, noreply: number): Counts => ({
    list: 0,
    notyet: 0,
    invited: 0,
    coming: 0,
    maybe: 0,
    noreply,
    held: 0,
    notcoming: 0,
    havent,
    walkin: 0,
  });

  it.each([
    [25, 21, 4, '25 haven’t replied (21 guests and 4 of their companions).'],
    [1, 1, 0, '1 hasn’t replied.'],
    [21, 21, 0, '21 haven’t replied.'],
    [2, 1, 1, '2 haven’t replied (1 guest and 1 of their companions).'],
  ])('gives %i/%i/%i as the card does', (all, guests, companions, words) => {
    const card = cardWords(null, 'owner', counts(all, guests), false, 'en-US', null);

    expect(card.line).toBe(words);
    expect(replyByAskCount({ guests, companions })).toBe(card.line);
  });
});

describe('Close replies now, from either place, has one toast (l10n, #33572)', () => {
  const now = new Date('2026-11-03T09:41:00Z');

  it('toasts the same key after the part’s Close replies now and after a Dates save into the past', () => {
    const fromPart = replyBySaved('2026-11-02', LONDON, 'en-US', now);
    const moved = replyByAfterStart('2026-11-04', '2026-11-03');
    const fromDates = moved == null ? null : replyBySaved(moved, LONDON, 'en-US', now);

    expect(moved).toBe('2026-11-02');
    expect(fromPart).toBe(W.savedClosedNow);
    expect(fromDates).toBe(W.savedClosedNow);
    expect(W.savedClosedNow).toBe('Saved. Replies are now closed.');
  });

  it('never says “Replies now close”', () => {
    const words = [
      replyBySaved('2026-11-03', LONDON, 'en-US', now),
      replyBySaved('2026-11-02', LONDON, 'en-US', now),
      replyByInTell('2026-11-03', LONDON, 'en-US', now),
      replyByInTell('2026-11-02', LONDON, 'en-US', now),
    ];

    for (const one of words) expect(one).not.toMatch(/now close /u);
  });
});

describe('Dates closing replies sooner (pm, 8 Nov, #33553)', () => {
  const now = new Date('2026-11-03T09:41:00Z');

  it('asks with the part’s own rule while anyone hasn’t replied, and not with nobody left', () => {
    expect(datesAsk('2026-11-04', '2026-11-03', now, LONDON, 'evt-wed-4')).toBe('sooner');
    expect(datesAsk('2026-11-04', '2026-11-02', now, LONDON, 'evt-wed-4')).toBe('now');
    expect(datesAsk('2026-11-04', null, now, LONDON, 'evt-wed-4')).toBeNull();
    expect(datesAsk(null, null, now, LONDON, 'evt-draft-4')).toBeNull();
    expect(datesAsk('2026-11-04', '2026-11-03', now, LONDON, 'evt-draft-4')).toBeNull();
  });

  it('asks in the web’s words, with Keep editing as the way back', () => {
    expect(say.closeSoonerTitle('Tue, Nov 3')).toBe('Close replies sooner, on Tue, Nov 3?');
    expect(W.closeNowTitle).toBe('Close replies now?');
    expect(W.keepEditing).toBe('Keep editing');
    expect(W.closeSooner).toBe('Close replies sooner');
    expect(W.closeNow).toBe('Close replies now');
  });

  it('answers the save with Tell guests when it opens, the move inside it, else with the toast (ux, 8 Nov)', () => {
    expect(datesSaveSays('2026-11-03', true)).toEqual({ toast: null, inTell: true });
    expect(datesSaveSays(null, true)).toEqual({ toast: null, inTell: false });
    expect(datesSaveSays('2026-11-03', false)).toEqual({ toast: 'moved', inTell: false });
    expect(datesSaveSays(null, false)).toEqual({ toast: 'saved', inTell: false });
    expect(replyByInTell('2026-11-03', LONDON, 'en-US', now)).toBe(
      'Replies close on Tue, Nov 3 at 23:59, Europe/London time.',
    );
    expect(replyByInTell('2026-11-02', LONDON, 'en-US', now)).toBe('Replies are now closed.');
  });
});

describe('the sample and the words', () => {
  it('gives only the wedding a date, and counts its 21 guests and 4 companions as the card does', () => {
    expect(replyByOf('evt-wed-4')).toBe('2026-11-04');
    expect(replyByOf('evt-draft-4')).toBeNull();
    expect(noReplyOf('evt-wed-4')).toEqual({ guests: 21, companions: 4 });
    expect(noReplyOf('evt-draft-4')).toEqual({ guests: 0, companions: 0 });
  });

  it('asks a question, then counts as the card does (l10n, #33419)', () => {
    expect(say.closeSoonerTitle('Tue, Nov 3')).toBe('Close replies sooner, on Tue, Nov 3?');
    expect(W.closeNowTitle).toBe('Close replies now?');
    expect(replyByAskCount(noReplyOf('evt-wed-4'))).toBe(
      '25 haven’t replied (21 guests and 4 of their companions).',
    );
    expect(W.closeSoonerLine).toBe(
      'After that day they can’t reply, unless you let them change their reply.',
    );
    expect(W.closeNowLine).toBe(
      'From now on they can’t reply, unless you let them change their reply.',
    );
  });

  it('writes the row, the hint, the preview and the saved line at 24 hours', () => {
    expect(replyByRow('2026-11-04', LONDON, 'en-US', new Date('2026-11-04T23:59:58Z'))).toEqual({
      title: 'Wed, Nov 4, 2026',
      line: 'Reply by · Replies close at 23:59, Europe/London time.',
    });
    expect(replyByRow('2026-11-04', LONDON, 'en-US', new Date('2026-11-04T23:59:59Z'))).toEqual({
      title: 'Wed, Nov 4, 2026',
      line: 'Reply by · Replies closed.',
    });
    expect(replyByRow(null, LONDON, 'en-US', new Date('2026-11-04T12:00:00Z'))).toEqual({
      title: 'Replies stay open until the event starts.',
      line: 'Reply by',
    });
    expect(replyByHint(LONDON, 'en-US')).toBe(
      'Replies close at the end of this day, 23:59 Europe/London time. Leave it empty and replies stay open until the event starts.',
    );
    expect(replyByPreview('2026-11-04', 'en-US')).toBe(
      'On the guests’ page: “Please answer by Wednesday, November 4. You can change your answer any time before then.”',
    );
    const today = new Date('2026-11-03T09:41:00Z');

    expect(replyBySaved('2026-11-03', LONDON, 'en-US', today)).toBe(
      'Saved. Replies close on Tue, Nov 3 at 23:59, Europe/London time.',
    );
    expect(replyBySaved(null, LONDON, 'en-US', today)).toBe(
      'Saved. Replies stay open until the event starts.',
    );
    expect(replyBySaved('2026-11-02', LONDON, 'en-US', today)).toBe(
      'Saved. Replies are now closed.',
    );
  });

  it('opens the part for its five states and leaves the two saved ones on the page', () => {
    for (const state of ['replyBy', 'replyByEmpty', 'replyByError', 'replyBySooner', 'replyByNow'])
      expect(editOf(eventStateOf(state))).toBe('replyBy');
    expect(editOf(eventStateOf('replyBySaved'))).toBeNull();
    expect(editOf(eventStateOf('replyByRemoved'))).toBeNull();
    expect(editOf(eventStateOf('datesReplyBy'))).toBe('dates');
    expect(editOf(eventStateOf('datesReplyByAsk'))).toBe('dates');
    expect(editOf(eventStateOf('datesReplyBySaved'))).toBeNull();
  });
});
