import { afterEach, describe, expect, it } from 'vitest';
import { nextUp } from '@soirely/domain';

import { DINER } from './EventsSample.ts';
import { cardStep, clockOf, datesOf, shownEvent } from './EventsModel.ts';
import { comingUpShows, liveOneDayClock, seedRunOfShow, stepless } from './LiveOneDay.ts';

function at(state: 'liveOneDay' | 'liveOneDaySpeeches' | 'liveOneDayOver', status = DINER.status) {
  seedRunOfShow(state);
  const now = liveOneDayClock(state);
  const shown = shownEvent({ ...DINER, status }, now);
  const ended = status === 'ended';

  return {
    now,
    shown,
    stepless: stepless(shown.phase, shown.milestones ?? [], now, ended),
    shows: comingUpShows(DINER, shown.phase, shown.milestones ?? [], now, ended, 'en-GB'),
  };
}

afterEach(() => seedRunOfShow(null));

describe('a one-day event happening now (sc-93858)', () => {
  it('has no end among its dates, as the server serves a one-day event', () => {
    seedRunOfShow('liveOneDay');

    expect(datesOf(DINER, liveOneDayClock('liveOneDay')).map((one) => one.at)).toEqual([
      DINER.startsAt,
    ]);
  });

  it('with nothing ahead, its card has no step and Coming up says when it ends', () => {
    const { shown, stepless: none, shows } = at('liveOneDay');

    expect(shown.phase).toBe('happening_now');
    expect(none).toBe(true);
    expect(shows).toEqual({ kind: 'ends', time: '23:30' });
  });

  it('with Speeches still ahead, the card leads with Run of show begins and Coming up lists both', () => {
    const { shown, now, stepless: none, shows } = at('liveOneDaySpeeches');

    expect(none).toBe(false);
    expect(cardStep(shown, now, 'en-GB')).toMatchObject({ kind: 'next' });
    expect(nextUp(shown.milestones ?? [], now, false)?.title).toBe('Run of show begins');
    expect(shows.kind === 'rows' && shows.rows.map((row) => row.milestone.title)).toEqual([
      'Run of show begins',
      'Speeches',
    ]);
  });

  it('after its end, every date has passed and Duplicate is the step', () => {
    const { shown, now, stepless: none, shows } = at('liveOneDayOver');

    expect(shown.phase).toBe('finished');
    expect(none).toBe(false);
    expect(cardStep(shown, now, 'en-GB')).toMatchObject({ action: 'duplicate' });
    expect(shows).toEqual({ kind: 'finished' });
  });

  it('once ended early with End now, it is over as at its end', () => {
    const { shown, stepless: none, shows } = at('liveOneDay', 'ended');

    expect(shown.phase).toBe('finished');
    expect(none).toBe(false);
    expect(shows).toEqual({ kind: 'finished' });
  });

  it('opens each state at its own clock', () => {
    expect(clockOf('liveOneDay').toISOString()).toBe('2026-11-03T20:40:00.000Z');
    expect(clockOf('liveOneDayOver').toISOString()).toBe('2026-11-03T23:45:00.000Z');
  });
});
