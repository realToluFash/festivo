import { describe, expect, it } from 'vitest';

import {
  DATA_PAGES,
  DATA_STATES,
  PAST_EVENTS,
  PERIODS,
  SAMPLE_HOLD,
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
  released,
  runAfter,
  turnedOff,
  withPeriod,
} from './dataSettings.ts';
import { VIEWERS } from './settings.ts';

const LOCALE = 'en-US';
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

  it('asks in the AC’s three wordings', () => {
    const when = 'Saturday, Oct 24 at 14:20 WAT';

    expect(firstRunLine(2, '90 days', when)).toBe(
      '2 events ended more than 90 days ago, so their guests are in the first run, on Saturday, Oct 24 at 14:20 WAT.',
    );
    expect(firstRunLine(1, '180 days', when)).toBe(
      '1 event ended more than 180 days ago, so its guests are in the first run, on Saturday, Oct 24 at 14:20 WAT.',
    );
    expect(firstRunLine(0, '365 days', when)).toBe(
      'No event ended more than 365 days ago, so the first run, on Saturday, Oct 24 at 14:20 WAT, erases nothing yet.',
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
    expect(cardOf(off, VIEWERS.folake).line).toBe('Turned off. The next run is cancelled.');
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
    expect(cardOf(page('rt_off'), VIEWERS.folake).step).toBe('choose');
    expect(cardOf(page('rt_off'), VIEWERS.julien)).toMatchObject({
      line: 'Only an Owner can turn this on.',
      step: null,
    });
    expect(cardOf(page('rt_locked'), VIEWERS.julien)).toMatchObject({
      says: 'Available on Enterprise',
      step: 'contact',
    });
    expect(cardOf(page('rt_on'), VIEWERS.folake)).toMatchObject({
      says: 'Guests’ details are erased 90 days after an event ends',
      line: '2 events are in the next run.',
      step: null,
    });
    expect(cardOf(page('rt_on_empty'), VIEWERS.folake).line).toBe('No event is in the next run.');
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
