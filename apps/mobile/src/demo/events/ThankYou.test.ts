import { describe, expect, it } from 'vitest';

import { EVENT_STATES, clockOf } from './EventsModel.ts';
import { CLOCKS } from './EventsSample.ts';
import {
  CARD_STATES,
  END_STATES,
  THANK_YOU_280,
  THANK_YOU_LINE,
  THANK_YOU_MOST,
  THANK_YOU_OVER,
  cardOf,
  cardShown,
  cleanThankYou,
  closed,
  endFieldOf,
  opened,
  pressedSave,
  settled,
  thankYouCount,
  thankYouLength,
  thankYouOver,
  thankYouTooLong,
  typed,
} from './ThankYou.ts';

describe('the hosts’ thank-you (sc-6476)', () => {
  it('trims and turns every run of spaces and line breaks into one space', () => {
    expect(cleanThankYou('  Thank you\n\nall   so much \t ')).toBe('Thank you all so much');
    expect(cleanThankYou(' \n\t ')).toBe('');
  });

  it('counts code points after cleaning, so an emoji is one and the edges are nothing', () => {
    expect(thankYouLength('  Merci 🎉 \n')).toBe(7);
    expect([...THANK_YOU_280]).toHaveLength(THANK_YOU_MOST);
    expect(thankYouOver(THANK_YOU_280)).toBe(false);
    expect(thankYouOver(THANK_YOU_OVER)).toBe(true);
  });

  it('formats the count and the limit for the member’s language', () => {
    expect(thankYouCount(THANK_YOU_280, 'en-US')).toBe('280/280');
    expect(thankYouCount('x'.repeat(1234), 'de-DE')).toBe('1.234/280');
    expect(thankYouTooLong('en-US')).toBe('A thank-you can be at most 280 characters.');
  });

  it('opens Add with an empty field and Edit with the line', () => {
    expect(opened(cardOf(null))).toMatchObject({ open: true, draft: '' });
    expect(opened(cardOf('thankYouLine'))).toMatchObject({ open: true, draft: THANK_YOU_LINE });
  });

  it('sends nothing over the limit, and clears the refusal once back under it', () => {
    const over = pressedSave(typed(opened(cardOf(null)), THANK_YOU_OVER));

    expect(over).toMatchObject({ busy: false, tried: true });
    expect(typed(over, THANK_YOU_280).tried).toBe(false);
  });

  it('saves the cleaned line, and saved empty removes it', () => {
    const adding = pressedSave(typed(opened(cardOf(null)), '  Thank you\nall  '));

    expect(adding.busy).toBe(true);
    expect(settled(adding)).toEqual({
      card: expect.objectContaining({ line: 'Thank you all', open: false, busy: false }),
      said: 'saved',
    });

    const emptied = pressedSave(typed(opened(cardOf('thankYouLine')), '   '));

    expect(settled(emptied)).toEqual({
      card: expect.objectContaining({ line: '', open: false }),
      said: 'removed',
    });
    expect(settled(pressedSave(opened(cardOf(null)))).said).toBeNull();
  });

  it('keeps the text after a failure and lets Save go again', () => {
    const failed = cardOf('thankYouNotSaved');

    expect(failed).toMatchObject({ open: true, failed: true, line: THANK_YOU_LINE });
    expect(failed.draft).not.toBe(failed.line);
    expect(pressedSave(failed)).toMatchObject({ busy: true, failed: false });
  });

  it('gives a member who cannot end the event no field, and no card without a line', () => {
    const reader = cardOf('thankYouReadOnly');

    expect(opened(reader).open).toBe(false);
    expect(pressedSave(reader)).toBe(reader);
    expect(cardShown(reader)).toBe(true);
    expect(cardShown(cardOf('thankYouReadOnlyNone'))).toBe(false);
  });

  it('cannot close or save while saving', () => {
    const saving = cardOf('thankYouSaving');

    expect(closed(saving)).toBe(saving);
    expect(pressedSave(saving)).toBe(saving);
  });

  it('opens End now’s field empty, or as each state names it', () => {
    expect(endFieldOf('endNow')).toEqual({ draft: '', busy: false, failed: false, tried: false });
    expect(endFieldOf('endNowOver')).toMatchObject({ draft: THANK_YOU_OVER, tried: true });
    expect(endFieldOf('endNowEnding').busy).toBe(true);
    expect(endFieldOf('endNowNotEnded')).toMatchObject({ draft: THANK_YOU_LINE, failed: true });
  });

  it('opens every card state on the Finished clock and End now’s on the day', () => {
    for (const state of CARD_STATES) {
      expect(EVENT_STATES).toContain(state);
      expect(clockOf(state).toISOString()).toBe(new Date(CLOCKS.finished).toISOString());
    }
    for (const state of END_STATES) {
      expect(EVENT_STATES).toContain(state);
      expect(clockOf(state).toISOString()).toBe(new Date(CLOCKS.happening).toISOString());
    }
  });
});
