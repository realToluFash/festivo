import { afterEach, describe, expect, it } from 'vitest';
import { eventPhase, nextUp } from '@soirely/domain';

import { DINER, clockOf, sampleEvent } from './events.ts';
import { timelineOf } from './kitchen.ts';
import {
  DINER_ID,
  type LiveOneDayState,
  comingUpShows,
  liveOneDayClock,
  seedRunOfShow,
  stepless,
} from './liveOneDay.ts';

function at(state: LiveOneDayState, status = DINER.status) {
  seedRunOfShow(state);
  const now = liveOneDayClock(state);
  const event = { ...DINER, status };
  const phase = eventPhase(event, now);
  const dates = timelineOf(event, now);
  const ended = status === 'ended';

  return {
    phase,
    dates,
    stepless: stepless(phase, dates, now, ended),
    shows: comingUpShows(event, phase, dates, now, ended, 'en-GB'),
  };
}

afterEach(() => seedRunOfShow(null));

describe('a one-day event happening now (sc-93858)', () => {
  it('is a sample the event page opens', () => {
    expect(sampleEvent(DINER_ID)).toBe(DINER);
  });

  it('has no end among its dates, as the server serves a one-day event', () => {
    expect(at('liveOneDay').dates.map((one) => one.at)).toEqual([DINER.startsAt]);
  });

  it('with nothing ahead, its card has no step and Coming up says when it ends', () => {
    const { phase, stepless: none, shows } = at('liveOneDay');

    expect(phase).toBe('happening_now');
    expect(none).toBe(true);
    expect(shows).toEqual({ kind: 'ends', time: '23:30' });
  });

  it('with Speeches still ahead, the card leads with Run of show begins and Coming up lists both', () => {
    const { dates, stepless: none, shows } = at('liveOneDaySpeeches');

    expect(none).toBe(false);
    expect(nextUp(dates, liveOneDayClock('liveOneDaySpeeches'), false)?.title).toBe(
      'Run of show begins',
    );
    expect(shows.kind === 'rows' && shows.rows.map((row) => row.milestone.title)).toEqual([
      'Run of show begins',
      'Speeches',
    ]);
  });

  it('after its end, or ended early with End now, every date has passed', () => {
    for (const { phase, stepless: none, shows } of [
      at('liveOneDayOver'),
      at('liveOneDay', 'ended'),
    ]) {
      expect(phase).toBe('finished');
      expect(none).toBe(false);
      expect(shows).toEqual({ kind: 'finished' });
    }
  });

  it('opens each state at its own clock', () => {
    expect(clockOf('liveOneDaySpeeches').toISOString()).toBe('2026-11-03T21:15:00.000Z');
  });
});
