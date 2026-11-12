import { describe, expect, it } from 'vitest';

import { QUESTION, afterAnswer, offer, picked, saveFirst, saveSettled } from './guestAsk.ts';

const START = '2026-11-05';
const TODAY = '2026-10-06';

describe('which dates the ask offers (sc-1363)', () => {
  it('offers the three dates and Don’t ask me again with no Reply by', () => {
    expect(offer({ today: TODAY, start: START, replyBy: null })).toEqual([
      'week',
      'twoWeeks',
      'weekBefore',
      'never',
    ]);
  });

  it('keeps to Reply by, and puts three days before answers close in place of a week before', () => {
    expect(offer({ today: TODAY, start: START, replyBy: '2026-10-18' })).toEqual([
      'week',
      'beforeClose',
      'never',
    ]);
  });

  it('offers nothing when Reply by leaves no date from tomorrow on', () => {
    expect(offer({ today: TODAY, start: START, replyBy: '2026-10-09' })).toEqual([]);
  });

  it('offers nothing closer than three days before the start', () => {
    expect(offer({ today: '2026-10-30', start: START, replyBy: null })).toEqual([]);
    expect(offer({ today: '2026-10-21', start: START, replyBy: null })).toEqual([
      'week',
      'weekBefore',
      'never',
    ]);
  });
});

describe('saving the choice', () => {
  const clock = { today: TODAY, start: START, replyBy: null };

  it('asks for a choice before saving, and clears the error once one is made', () => {
    const empty = saveFirst(QUESTION);

    expect(empty).toMatchObject({ kind: 'question', error: 'empty', saving: false });
    expect(picked(empty, 'week')).toMatchObject({ pick: 'week', error: null });
  });

  it('saves the day chosen, or that we won’t ask', () => {
    const saving = saveFirst(picked(QUESTION, 'twoWeeks'));

    expect(saving).toMatchObject({ saving: true });
    expect(saveSettled(saving, clock)).toEqual({ kind: 'saved', day: '2026-10-20', live: true });
    expect(saveSettled(saveFirst(picked(QUESTION, 'never')), clock)).toEqual({
      kind: 'wont',
      live: true,
    });
  });
});

describe('another answer', () => {
  const saved = { kind: 'saved', day: '2026-10-20', live: false } as const;

  it('cancels the ask', () => {
    expect(afterAnswer(saved, 'notSure', 'coming')).toBeNull();
  });

  it('keeps it on Not sure yet again, and asks again after another answer', () => {
    expect(afterAnswer(saved, 'notSure', 'notSure')).toBe(saved);
    expect(afterAnswer(null, 'coming', 'notSure')).toBe(QUESTION);
  });
});
