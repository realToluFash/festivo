import { describe, expect, it } from 'vitest';

import {
  AFTER_EXPIRY,
  cardLine,
  codeStatus,
  type DoorCode,
  type DoorStart,
  doorStartOf,
  formFrom,
  levelOf,
  madeCode,
  NOW,
  newCodeOpensForm,
  offeredShifts,
  ON_THE_DAY,
  placesFree,
  renewed,
  type Shift,
  SHIFTS,
  shiftEnd,
  shiftOf,
  shiftState,
  shiftWords,
  WAITER_CODE,
  WAITER_SHIFT,
} from './DoorCodeModel.ts';
import { freePlaces, notOnShift, setBy, W } from './DoorCodeWords.ts';
import { flowAt } from './RedeemModel.ts';

const LOCALE = 'en-US';

function opened(state: string | undefined, code?: string): DoorStart {
  const start = doorStartOf(state, code, undefined);
  if (start == null) throw new Error(`${String(state ?? code)} is a door code state.`);

  return start;
}

function find(id: string, shifts: readonly Shift[] = SHIFTS): Shift {
  const one = shiftOf(id, shifts);
  if (one == null) throw new Error(`${id} is in the sample.`);

  return one;
}

const jobs = (shifts: readonly Shift[]) => shifts.map((one) => one.job);

describe('which shifts a code can name (sc-234)', () => {
  it('words a shift as the AC does, a shift past midnight on its start day', () => {
    const waiter = find(WAITER_SHIFT);

    expect(`${shiftWords(waiter, LOCALE)} · ${placesFree(waiter)}`).toBe(
      'Waiter · Saturday 18:00 to 01:00 · 3 of 8 places free',
    );
    expect(shiftEnd(waiter)).toEqual({ date: '2026-11-15', time: '01:00' });
    expect(freePlaces(1, 1)).toBe('1 of 1 place free');
  });

  it('offers a free place before its end at a level a code may give, by scheduled start', () => {
    expect(jobs(offeredShifts(SHIFTS, NOW))).toEqual(['Set-up', 'Door', 'Waiter', 'Runner']);
    expect(jobs(offeredShifts(SHIFTS, ON_THE_DAY))).toEqual(['Door', 'Waiter', 'Runner']);
  });

  it('never offers Can run the floor, a full shift or one past its end', () => {
    expect(shiftState(find('shift-kitchen'), NOW)).toBe('full');
    expect(shiftState(find('shift-setup'), ON_THE_DAY)).toBe('over');
    expect(shiftState(find('shift-floor-lead'), NOW)).toBe('free');
    expect(jobs(offeredShifts(SHIFTS, NOW))).not.toContain('Floor lead');
    expect(jobs(offeredShifts(SHIFTS, AFTER_EXPIRY))).not.toContain('Set-up');
  });

  it('opens Make with nothing to offer when no shift has a place', () => {
    const start = opened(undefined, 'shift-none');

    expect(offeredShifts(start.shifts, start.now)).toEqual([]);
    expect(W.noShiftRoom).toBe('No shift has a place a code can fill');
  });
});

describe('the level a shift sets (sc-234)', () => {
  const form = { ...formFrom(null), cap: '30' };

  it('takes the shift job’s level while it is picked, and gives back the one chosen before', () => {
    const picked = { ...form, role: 'Can check guests in' as const, shift: WAITER_SHIFT };

    expect(levelOf(picked, SHIFTS)).toBe('Can work the floor');
    expect(levelOf({ ...picked, shift: null }, SHIFTS)).toBe('Can check guests in');
    expect(levelOf({ ...form, shift: null }, SHIFTS)).toBe('Can view');
    expect(setBy('Waiter')).toBe('Set by the Waiter shift. Pick No shift to choose another.');
  });

  it('makes the code at that level, naming the shift', () => {
    const code = madeCode({ ...form, shift: WAITER_SHIFT }, [], SHIFTS);

    expect(code).toMatchObject({ role: 'Can work the floor', shift: WAITER_SHIFT, used: 0 });
    expect(madeCode(form, [], SHIFTS).shift).toBeNull();
  });

  it('opens the picked state on the Waiter shift, and the list on No shift', () => {
    expect(opened(undefined, 'shift-picked').make?.form.shift).toBe(WAITER_SHIFT);
    expect(opened(undefined, 'shift-list').make).toMatchObject({ shiftsOpen: true });
    expect(opened(undefined, 'shift-list').make?.form.shift).toBeNull();
  });
});

describe('the card of a code naming a shift (sc-234)', () => {
  it('names the shift, and says when nobody new is put on it', () => {
    const states = ['code-shift', 'code-shift-full', 'code-shift-over'].map((state) => {
      const start = opened(state);
      const [code] = start.codes;
      const shift = shiftOf(code?.shift ?? null, start.shifts);
      if (code == null || shift == null) throw new Error(`${state} names a shift.`);

      return [shiftWords(shift, LOCALE), shiftState(shift, start.now), codeStatus(code)];
    });

    expect(states).toEqual([
      ['Waiter · Saturday 18:00 to 01:00', 'free', 'working'],
      ['Kitchen · Saturday 13:00 to 00:00', 'full', 'working'],
      ['Set-up · Saturday 08:00 to 12:00', 'over', 'working'],
    ]);
    expect(W.notPutOn).toBe('People who join now are not put on it.');
  });

  it('counts as many in by the code as are listed', () => {
    for (const state of ['code-shift', 'code-shift-full', 'code-shift-over']) {
      const start = opened(state);
      const [code] = start.codes;

      expect(start.people.onEvent.filter((one) => one.byCode?.code === code?.code)).toHaveLength(
        code?.used ?? -1,
      );
    }
    expect(cardLine(WAITER_CODE, LOCALE, ON_THE_DAY.date)).toBe('5 of 30 used · until 23:30');
  });

  it('names no shift once its shift is deleted', () => {
    expect(shiftOf('shift-gone', SHIFTS)).toBeNull();
  });
});

describe('Make a new code on a card naming a shift (pm, 26 Nov)', () => {
  const at = (shift: string): DoorCode => ({ ...WAITER_CODE, shift });

  it('opens the form past the Ask only for a code naming a shift', () => {
    expect(newCodeOpensForm(WAITER_CODE, SHIFTS)).toBe(true);
    expect(newCodeOpensForm({ ...WAITER_CODE, shift: null }, SHIFTS)).toBe(false);
    expect(newCodeOpensForm(at('shift-gone'), SHIFTS)).toBe(false);
  });

  it('keeps a shift it can still name, at the level its job has now', () => {
    const moved = SHIFTS.map((one) =>
      one.id === WAITER_SHIFT ? { ...one, level: 'Can work the pass' as const } : one,
    );
    const form = formFrom(WAITER_CODE, moved, ON_THE_DAY);

    expect(form).toEqual({
      role: 'Can work the floor',
      shift: WAITER_SHIFT,
      job: 'Waiting staff',
      cap: '30',
      ends: { kind: 'event' },
    });
    expect(levelOf(form, moved)).toBe('Can work the pass');
    expect(levelOf({ ...form, shift: null }, moved)).toBe('Can work the floor');
  });

  it('drops a full, over, deleted or Can run the floor shift, keeping the old code’s level', () => {
    const runs = SHIFTS.map((one) =>
      one.id === WAITER_SHIFT ? { ...one, level: 'Can run the floor' as const } : one,
    );
    const dropped = [
      formFrom(at('shift-kitchen'), SHIFTS, ON_THE_DAY),
      formFrom(at('shift-setup'), SHIFTS, ON_THE_DAY),
      formFrom(at('shift-gone'), SHIFTS, ON_THE_DAY),
      formFrom(WAITER_CODE, runs, ON_THE_DAY),
    ];

    for (const form of dropped)
      expect(form).toMatchObject({ shift: null, role: 'Can work the floor' });
  });

  it('makes a code naming no shift at once, as sc-72 does', () => {
    expect(renewed({ ...WAITER_CODE, shift: 'shift-gone' }, [WAITER_CODE.code]).shift).toBeNull();
  });

  it('opens new_code_shift_kept on People with the Waiter code behind it', () => {
    const start = opened('new_code_shift_kept');

    expect(start.codes.map((one) => one.id)).toEqual([WAITER_CODE.id]);
    expect(start.make?.replaces).toBe(WAITER_CODE.id);
    expect(start.make?.form).toEqual({
      role: 'Can work the floor',
      shift: WAITER_SHIFT,
      job: 'Waiting staff',
      cap: '30',
      ends: { kind: 'event' },
    });
    expect(levelOf(start.make?.form ?? formFrom(null), start.shifts)).toBe('Can work the floor');
  });
});

describe('You’re in, when the shift is not joined (sc-234)', () => {
  it('says why, with the Door shift, at the code’s level', () => {
    const full = flowAt('in-shift-full');
    const over = flowAt('in-shift-over');

    expect([full.step, full.notOn, full.role, full.code.job]).toEqual([
      'in',
      'full',
      'Can check guests in',
      'Door',
    ]);
    expect(over.notOn).toBe('over');
    expect(flowAt('in').notOn).toBeNull();
    expect(notOnShift('Door', 'full')).toBe(
      'The Door shift is full, so you’re not on it. Tell whoever gave you the code.',
    );
    expect(notOnShift('Door', 'over')).toBe(
      'The Door shift has ended, so you’re not on it. Tell whoever gave you the code.',
    );
  });
});
