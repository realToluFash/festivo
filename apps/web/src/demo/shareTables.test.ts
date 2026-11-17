import { describe, expect, it } from 'vitest';

import { samplePlan, sampleTray, seatAt } from './seating.ts';
import {
  SHARE_STATES,
  SHARE_WORDS,
  isPassed,
  seatedComing,
  shareByRefusal,
  shareDay,
  unseatedComing,
} from './shareTables.ts';

const WEDDING = { startsAt: '2026-11-05T18:00:00Z', timeZone: 'Europe/London' };
const TODAY = '2026-11-03';

describe('Share by', () => {
  it('takes today and the day before the event', () => {
    expect(shareByRefusal('2026-11-03', WEDDING, TODAY)).toBeNull();
    expect(shareByRefusal('2026-11-04', WEDDING, TODAY)).toBeNull();
  });

  it('refuses nothing typed, the event’s day or later, and a day gone by, in that order', () => {
    expect(shareByRefusal('', WEDDING, TODAY)).toBe('empty');
    expect(shareByRefusal('2026-11-05', WEDDING, TODAY)).toBe('afterEvent');
    expect(shareByRefusal('2026-12-01', WEDDING, TODAY)).toBe('afterEvent');
    expect(shareByRefusal('2026-11-02', WEDDING, TODAY)).toBe('past');
  });

  it('reads the event’s day in its own time zone', () => {
    const lagosLate = { startsAt: '2026-11-04T23:30:00Z', timeZone: 'Africa/Lagos' };

    expect(shareByRefusal('2026-11-04', lagosLate, TODAY)).toBeNull();
  });

  it('is passed only while nothing is shared and the saved day is before today', () => {
    expect(isPassed({ by: '2026-11-02', shared: null }, TODAY)).toBe(true);
    expect(isPassed({ by: '2026-11-03', shared: null }, TODAY)).toBe(false);
    expect(isPassed({ by: '2026-11-02', shared: '2026-11-01' }, TODAY)).toBe(false);
    expect(isPassed({ by: null, shared: null }, TODAY)).toBe(false);
  });

  it('writes the day as the locale does', () => {
    expect(shareDay('2026-11-04')).toBe('Wednesday, Nov 4');
    expect(shareDay('2026-11-04', 'fr')).toBe('mercredi 4 nov.');
  });
});

describe('the counts in the ask', () => {
  it('counts taken chairs, and Coming parties still in the tray with their companions', () => {
    const plan = samplePlan();
    const taken = plan.items.flatMap((item) => item.chairs).filter((one) => one.state === 'taken');

    expect(seatedComing(plan, sampleTray())).toBe(taken.filter((one) => one.who != null).length);
    expect(unseatedComing(sampleTray())).toBe(12);
    expect(unseatedComing(sampleTray().filter((party) => party.reply !== 'coming'))).toBe(0);
  });

  it('leaves out a Not sure yet party seated from the tray, and counts a Coming one', () => {
    const plan = samplePlan();
    const before = seatedComing(plan, sampleTray());
    const hugo = sampleTray().find((party) => party.id === 'hugo');
    const marta = sampleTray().find((party) => party.id === 'marta');
    const empty = plan.items.findIndex((item) => item.id === 't10');

    expect(hugo?.reply).toBe('notSure');
    if (hugo == null || marta == null) return;

    const t10 = plan.items[empty];
    if (t10 == null) return;
    plan.items[empty] = seatAt(seatAt(t10, hugo, [0]), marta, [1]);

    expect(seatedComing(plan, sampleTray())).toBe(before + 1);
  });

  it('says one guest in the singular', () => {
    expect(SHARE_WORDS.unseated(1)).toBe('1 guest doesn’t have a seat yet.');
    expect(SHARE_WORDS.askShareLine(1)).toMatch(/^1 guest who is coming/u);
  });
});

it('has the board’s 14 states', () => {
  expect(Object.keys(SHARE_STATES)).toHaveLength(14);
});
