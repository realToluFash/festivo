import { describe, expect, it } from 'vitest';

import { startOf } from './guest.ts';
import {
  GUEST_ASK_PAGES,
  GUEST_ASK_STATES,
  START_DAY,
  askedAgain,
  landed,
  offer,
  plusDays,
} from './guestAsk.ts';
import { replyLine, sampleGuests } from './guests.ts';

const before = (days: number) => plusDays(START_DAY, -days);

describe('which dates the question offers (sc-1363)', () => {
  it.each([
    [30, ['week', 'twoWeeks', 'weekBefore', 'never']],
    [12, ['week', 'weekBefore', 'never']],
    [8, ['weekBefore', 'never']],
    [7, []],
    [5, []],
  ])('%i days before the start, with no Reply by', (days, keys) => {
    expect(offer(before(days), null)).toEqual(keys);
  });

  it('is bounded by the Reply by, whose third option is three days before answers close', () => {
    expect(offer(before(30), before(18))).toEqual(['week', 'beforeClose', 'never']);
    expect(offer(before(30), before(27))).toEqual([]);
  });
});

describe('what a Save lands on', () => {
  it('saves the chosen date, or Don’t ask me again', () => {
    expect(landed(startOf('maybe_saving')).change.ask).toMatchObject({
      view: 'saved',
      on: before(23),
      live: true,
    });
  });

  it('says a Save that did not reach us, then saves on the next', () => {
    const first = landed({
      ...startOf('maybe_recorded'),
      ask: { ...startOf('maybe_recorded').ask!, pick: 'week', outcome: 'net' },
    });

    expect(first.change.ask).toMatchObject({ error: 'net', outcome: 'ok', view: 'question' });
  });

  it('offers the choices again a day later (422), none chosen', () => {
    const { change, want } = landed(startOf('maybe_dates_moved'));

    expect(change.ask).toMatchObject({ moved: true, pick: null, today: before(11) });
    expect(want).toBe('againSave');
  });

  it('says it is too close once nothing is left (422)', () => {
    expect(landed(startOf('maybe_too_close_now')).change.ask?.view).toBe('closeNow');
    expect(landed(startOf('maybe_too_close_now_reply_by')).change.ask?.view).toBe('closeNow');
  });

  it('shows the answer from another device (409), with no question', () => {
    const { change, want } = landed(startOf('maybe_reply_changed'));

    expect(change.recorded?.answer).toBe('coming');
    expect(change.ask?.view).toBe('none');
    expect(want).toBe('answered');
  });

  it('asks again after a different answer', () => {
    expect(askedAgain(startOf('maybe_ask_saved').ask!)).toMatchObject({
      view: 'question',
      pick: null,
    });
  });

  it('is linked once per state', () => {
    expect(GUEST_ASK_PAGES.flatMap((page) => page.states).map((one) => one.to)).toEqual(
      Object.keys(GUEST_ASK_STATES).map((state) => `/demo/guest?state=${state}`),
    );
  });
});

describe('the host’s line', () => {
  const list = sampleGuests('evt-wed-4');
  const named = (id: string) => list.find((one) => one.id === id)!;

  it('reads the ask as the one tail, never Maybe', () => {
    expect(replyLine(named('mariana-lopes'), '2026-11-04')).toBe(
      'Not sure yet · asked again Oct 26',
    );
    expect(replyLine(named('mathieu-girard'), '2026-11-04')).toBe(
      'Not sure yet · won’t be asked again',
    );
    expect(replyLine(named('nnamdi-uzor'), '2026-11-04')).toBe(
      'Not sure yet · asked to decide by Nov 4',
    );
    expect(replyLine(named('olivia-bennett'), '2026-11-04')).toBe(
      'Not sure yet · asked to decide by Nov 4',
    );
    expect(
      replyLine(
        { ...named('olivia-bennett'), ask: { kind: 'toSend', on: '2026-11-01' } },
        '2026-11-04',
      ),
    ).toBe('Not sure yet · will be asked again Nov 1');
  });
});
