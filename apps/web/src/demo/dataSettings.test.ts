import { describe, expect, it } from 'vitest';

import {
  DATA_PAGES,
  DATA_STATES,
  LONG_HOLD,
  PAST_EVENTS,
  PERIODS,
  REASON_MOST,
  SAMPLE_HOLD,
  TOO_LONG_REASON,
  cardOf,
  dataStart,
  dataViewerKey,
  eventsInRun,
  firstRunLine,
  heldBack,
  instantWords,
  isBlank,
  nextRunLine,
  questionOf,
  reasonFault,
  released,
  runAfter,
  turnedOff,
  withPeriod,
} from './dataSettings.ts';
import { VIEWERS } from './settings.ts';

const LOCALE = 'en-US';
const LAGOS = 'Africa/Lagos';
const NOTICE = '2026-10-17T14:20:00+01:00';
const page = (state: string, viewer = VIEWERS.folake) => dataStart(state, viewer, LOCALE).page;

describe('retention’s rules (sc-30194)', () => {
  it('offers exactly the AC’s periods', () => {
    expect(PERIODS).toEqual(['Off', '30 days', '90 days', '180 days', '365 days']);
  });

  it('puts a run 7 × 24 hours after its notice, to the minute', () => {
    expect(runAfter(NOTICE)).toBe('2026-10-24T13:20:00.000Z');
  });

  it('counts the events in a run by the period as it is picked', () => {
    const count = (period: '30 days' | '90 days' | '180 days' | '365 days') =>
      eventsInRun(PAST_EVENTS, period, runAfter(NOTICE), []).map((event) => event.id);

    expect(count('30 days')).toEqual(['adunni', 'lumen', 'harvest']);
    expect(count('90 days')).toEqual(['adunni', 'lumen']);
    expect(count('180 days')).toEqual(['adunni']);
    expect(count('365 days')).toEqual([]);
  });

  it('takes an event whose end plus the period is at the run’s instant, and not one a minute later', () => {
    const at = (endedAt: string) =>
      eventsInRun([{ id: 'one', name: 'One', endedAt }], '30 days', '2026-10-24T13:20:00Z', []);

    expect(at('2026-09-24T13:20:00Z')).toHaveLength(1);
    expect(at('2026-09-24T13:21:00Z')).toHaveLength(0);
  });

  it('leaves a held event out of the run', () => {
    const events = [...PAST_EVENTS, SAMPLE_HOLD.event];

    expect(eventsInRun(events, '90 days', runAfter(NOTICE), [SAMPLE_HOLD])).toHaveLength(2);
    expect(eventsInRun(events, '90 days', runAfter(NOTICE), [])).toHaveLength(3);
  });

  it('writes one instant in each reader’s own zone, or labelled UTC with none', () => {
    const run = runAfter(NOTICE);

    expect(instantWords(run, 'Africa/Lagos', LOCALE)).toBe('Saturday, Oct 24 at 14:20 WAT');
    expect(instantWords(run, 'Europe/London', LOCALE)).toBe('Saturday, Oct 24 at 14:20 BST');
    expect(instantWords(run, null, LOCALE)).toBe('Saturday, Oct 24 at 13:20 UTC');
    expect(instantWords('2026-10-31T13:20:00Z', 'Europe/London', LOCALE)).toBe(
      'Saturday, Oct 31 at 13:20 GMT',
    );
    expect(nextRunLine(run, 'Africa/Lagos', LOCALE)).toBe(
      'Next run · Saturday, Oct 24 at 14:20 WAT',
    );
  });

  it('asks in pm’s three wordings of 8 Nov, true as of the run', () => {
    const when = 'Saturday, Oct 24 at 14:20 WAT';

    expect(firstRunLine(2, '90 days', when)).toBe(
      '2 events will have ended at least 90 days before the first run, on Saturday, Oct 24 at 14:20 WAT, so their guests are in it.',
    );
    expect(firstRunLine(1, '180 days', when)).toBe(
      '1 event will have ended at least 180 days before the first run, on Saturday, Oct 24 at 14:20 WAT, so its guests are in it.',
    );
    expect(firstRunLine(0, '365 days', when)).toBe(
      'No event will have ended at least 365 days before the first run, on Saturday, Oct 24 at 14:20 WAT, so it erases nothing yet.',
    );
  });

  it('counts an event that crosses the period in the notice’s week, and says so as of the run', () => {
    const crossing = { id: 'crossing', name: 'Crossing', endedAt: '2026-07-20T12:00:00+01:00' };
    const off = { ...page('rt_off'), events: [crossing] };

    expect(questionOf(off, '90 days', LAGOS, LOCALE).line).toBe(
      '1 event will have ended at least 90 days before the first run, on Saturday, Oct 24 at 14:20 WAT, so its guests are in it.',
    );
  });

  it('says Owners and Admins are emailed now only when the first run has events to name', () => {
    const off = page('rt_off');

    expect(questionOf(off, '90 days', 'Africa/Lagos', LOCALE).emailed).toBe(
      'Owners and Admins are emailed now.',
    );
    expect(questionOf(off, '365 days', 'Africa/Lagos', LOCALE).emailed).toBe(
      'Owners and Admins are emailed 7 days before any run with events in it.',
    );
  });

  it('replaces the run already noticed when the period changes', () => {
    const on = page('rt_on');
    const asked = questionOf(on, '180 days', 'Africa/Lagos', LOCALE);

    expect(asked.replaces).toBe('It replaces the run on Saturday, Oct 24 at 14:20 WAT.');
    expect(asked.line).toContain('on Monday, Oct 26 at 10:12 WAT');
    expect(asked.verb).toBe('Change');
    expect(withPeriod(on, '180 days').runAt).toBe('2026-10-26T09:12:00.000Z');
    expect(withPeriod(on, '180 days').run.map((event) => event.id)).toEqual(['adunni']);
  });

  it('cancels the next run on Off and keeps what is held', () => {
    const off = turnedOff(page('rt_held'));

    expect(off).toMatchObject({ period: 'Off', runAt: null, run: [] });
    expect(off.held).toHaveLength(1);
    expect(cardOf(off, VIEWERS.folake, LAGOS, LOCALE).line).toBe(
      'Turned off. The next run is cancelled.',
    );
  });

  it('holds with the holder, the page’s clock and the trimmed reason, and takes the event out of the run', () => {
    const on = page('rt_on');
    const first = on.run[0];
    if (first == null) throw new Error('the sample’s run has events');
    const after = heldBack(on, first, '  A dispute  ', VIEWERS.julien.name);

    expect(after.run.map((event) => event.id)).toEqual(['lumen']);
    expect(after.held[0]).toMatchObject({ by: 'Julien Moreau', reason: 'A dispute' });
  });

  it('counts a reason of spaces as blank', () => {
    expect(isBlank('   ')).toBe(true);
    expect(isBlank(' x ')).toBe(false);
  });

  it('refuses a reason over 500 characters, counted after trimming, and holds one of 500 with spaces around', () => {
    expect(REASON_MOST).toBe(500);
    expect(reasonFault('x'.repeat(501))).toBe('long');
    expect(reasonFault(`   ${'x'.repeat(500)}   `)).toBeNull();
    expect(reasonFault('   ')).toBe('blank');
    expect(reasonFault('é'.repeat(500))).toBeNull();

    const on = page('rt_on');
    const first = on.run[0];
    if (first == null) throw new Error('the sample’s run has events');
    expect(heldBack(on, first, `  ${'x'.repeat(500)}  `, 'Folake').held[0]?.reason).toHaveLength(
      500,
    );
  });

  it('opens the too-long state with the whole reason typed and refused, and the long hold within the limit', () => {
    const start = dataStart('rt_hold_long', VIEWERS.folake, LOCALE);

    expect(start).toMatchObject({ pressed: true, reason: TOO_LONG_REASON });
    expect(reasonFault(TOO_LONG_REASON)).toBe('long');
    expect(reasonFault(LONG_HOLD.reason)).toBeNull();
    expect(page('rt_held_long').held).toEqual([LONG_HOLD]);
  });

  it('keeps a hold through Off, releases it while Off, and counts it in the first run once on again', () => {
    const off = page('rt_off_held');

    expect(off).toMatchObject({ period: 'Off', runAt: null, run: [], said: null });
    expect(off.held).toEqual([SAMPLE_HOLD]);
    expect(questionOf(off, '90 days', LAGOS, LOCALE).events.map((event) => event.id)).toEqual([
      'adunni',
      'lumen',
    ]);

    const after = page('rt_off_released');
    expect(after.held).toEqual([]);
    expect(after.said).toBe('Released. Tola & Seun’s wedding is no longer held back.');
    expect(questionOf(after, '90 days', LAGOS, LOCALE).events.map((event) => event.id)).toEqual([
      'tola',
      'adunni',
      'lumen',
    ]);
  });

  it('keeps the period and the holds, switched off, once it has left Enterprise', () => {
    const left = page('rt_downgraded');

    expect(left).toMatchObject({ plan: 'free', period: '90 days', runAt: null, run: [] });
    expect(left.held).toEqual([SAMPLE_HOLD]);
    for (const viewer of [VIEWERS.folake, VIEWERS.julien])
      expect(cardOf(left, viewer, LAGOS, LOCALE)).toEqual({
        says: 'Guests’ details are kept after an event',
        line: 'Switched off on Sunday, Oct 18, when Ire Events moved to the free plan. Its period and held events are kept as they were, and come back on with Enterprise.',
        step: 'contact',
      });
    expect(page('rt_locked')).toMatchObject({ leftEnterpriseAt: null, period: 'Off', held: [] });
  });

  it('does not put a released event in the run its notice did not name, but in the one after', () => {
    const held = page('rt_held');
    const after = released(held, SAMPLE_HOLD, 'Africa/Lagos', LOCALE);

    expect(after.held).toEqual([]);
    expect(after.run).toEqual(held.run);
    expect(after.said).toBe(
      'Released. Tola & Seun’s wedding is named in the next notice, on Saturday, Oct 24 at 14:20 WAT, and erased in the run on Saturday, Oct 31 at 14:20 WAT.',
    );
    expect(withPeriod(after, '90 days').run.map((event) => event.id)).toContain('tola');
  });

  it('says what each viewer can do on the card', () => {
    expect(cardOf(page('rt_off'), VIEWERS.folake, LAGOS, LOCALE).step).toBe('choose');
    expect(cardOf(page('rt_off'), VIEWERS.julien, LAGOS, LOCALE)).toMatchObject({
      line: 'Only an Owner can turn this on.',
      step: null,
    });
    expect(cardOf(page('rt_locked'), VIEWERS.julien, LAGOS, LOCALE)).toMatchObject({
      says: 'Available on Enterprise',
      step: 'contact',
    });
    expect(cardOf(page('rt_on'), VIEWERS.folake, LAGOS, LOCALE)).toMatchObject({
      says: 'Guests’ details are erased 90 days after an event ends',
      line: '2 events are in the next run.',
      step: null,
    });
    expect(cardOf(page('rt_on_empty'), VIEWERS.folake, LAGOS, LOCALE).line).toBe(
      'No event is in the next run.',
    );
  });

  it('opens a state it does not know as Off, and not_owner as the Admin', () => {
    expect(dataStart('nope', VIEWERS.folake, LOCALE).page.period).toBe('Off');
    expect(dataViewerKey(null, 'not_owner')).toBe('julien');
    expect(dataViewerKey('ana', 'rt_on')).toBe('ana');
  });

  it('links every state from the demo’s home', () => {
    const linked = DATA_PAGES.flatMap((one) => one.states.map((state) => state.to));

    for (const state of DATA_STATES)
      expect(linked.some((to) => to.includes(`state=${state}`))).toBe(true);
  });
});
