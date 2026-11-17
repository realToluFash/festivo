import { type PlanSubscriber } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import {
  NOBODY_ELSE,
  type PresenceState,
  QUIET_MS,
  beat,
  changed,
  colleaguesOf,
  listed,
  quieted,
  ringsOf,
} from './seatingPresence.ts';

const ME = 'u_me';
const say = (key: 'joinedPlan' | 'leftPlan', name: string) => `${key} ${name}`;
const tab = (subscriber: string, userId: string, name: string): PlanSubscriber => ({
  subscriber,
  userId,
  name,
  editor: true,
  active: true,
});
const KEMI = tab('k1', 'u_kemi', 'Kemi Adeyemi');
const PRIYA = tab('p1', 'u_priya', 'Priya Shah');
const SELF = tab('m1', ME, 'Ngozi Eze');

function withKemiChoosing(at: number): PresenceState {
  const here = listed(NOBODY_ELSE, [SELF, KEMI], at);

  return {
    ...here,
    chosen: [{ userId: 'u_kemi', chosen: { kind: 'table', id: 't1', chair: null } }],
  };
}

describe('a connection that dies without a word (sc-4719, #62200)', () => {
  it('keeps a colleague heard within the quiet time, and lets them go after it, well inside 30 seconds', () => {
    const state = withKemiChoosing(0);

    expect(quieted(state, QUIET_MS, ME, say)).toBe(state);
    const gone = quieted(state, QUIET_MS + 1, ME, say);

    expect(QUIET_MS).toBeLessThanOrEqual(15_000);
    expect(colleaguesOf(gone, ME)).toEqual([]);
    expect(ringsOf(gone, ME)).toEqual({});
    expect(gone.spoken).toBe('leftPlan Kemi Adeyemi');
  });

  it('names everyone who went quiet in the same moment, not only the last', () => {
    const gone = quieted(listed(NOBODY_ELSE, [SELF, KEMI, PRIYA], 0), 20_000, ME, say);

    expect(gone.spoken).toBe('leftPlan Kemi Adeyemi leftPlan Priya Shah');
  });

  it('keeps a colleague who keeps saying they are here', () => {
    let state = withKemiChoosing(0);
    for (let at = 5_000; at <= 60_000; at += 5_000) {
      state = quieted(beat(state, 'u_kemi', at, say), at + 1_000, ME, say);
    }

    expect(colleaguesOf(state, ME).map((one) => one.name)).toEqual(['Kemi Adeyemi']);
    expect(Object.keys(ringsOf(state, ME))).toEqual(['t1']);
  });

  it('brings a quiet colleague back, ring and all, when they are heard again', () => {
    const gone = quieted(withKemiChoosing(0), 20_000, ME, say);
    const back = beat(gone, 'u_kemi', 21_000, say);

    expect(colleaguesOf(back, ME).map((one) => one.name)).toEqual(['Kemi Adeyemi']);
    expect(Object.keys(ringsOf(back, ME))).toEqual(['t1']);
    expect(back.spoken).toBe('joinedPlan Kemi Adeyemi');
  });

  it('brings them back on a new connection of theirs, and says nothing when their last tab then closes', () => {
    const gone = quieted(withKemiChoosing(0), 20_000, ME, say);
    const renewed = changed(gone, tab('k2', 'u_kemi', 'Kemi Adeyemi'), ME, say, 21_000);

    expect(colleaguesOf(renewed, ME)).toHaveLength(1);
    expect(renewed.spoken).toBe('joinedPlan Kemi Adeyemi');

    const closedQuiet = changed(gone, { ...KEMI, active: false }, ME, say, 22_000);
    expect(closedQuiet.spoken).toBe(gone.spoken);
  });

  it('lets nobody go while your own connection is lost, and draws no colleague’s ring then', () => {
    const lost = { ...withKemiChoosing(0), connection: 'lost' as const };

    expect(quieted(lost, 60_000, ME, say)).toBe(lost);
    expect(ringsOf(lost, ME)).toEqual({});
  });

  it('gives everyone listed afresh on reconnecting the quiet time again, but not one already quiet', () => {
    const gone = quieted(listed(NOBODY_ELSE, [SELF, KEMI, PRIYA], 0), 20_000, ME, say);
    const kemiBack = beat(gone, 'u_kemi', 20_000, say);
    const relisted = listed(kemiBack, [SELF, KEMI, PRIYA], 40_000);

    expect(colleaguesOf(quieted(relisted, 50_000, ME, say), ME).map((one) => one.name)).toEqual([
      'Kemi Adeyemi',
    ]);
  });

  it('never lets yourself go', () => {
    const state = listed(NOBODY_ELSE, [SELF], 0);

    expect(quieted(state, 60_000, ME, say)).toBe(state);
  });
});
