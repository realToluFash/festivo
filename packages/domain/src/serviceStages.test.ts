import { describe, expect, it } from 'vitest';

import {
  heldUpMinutes,
  isHeld,
  PLATE_STAGES,
  plateStep,
  SERVICE_WORD_KEYS,
  stepsFrom,
  waitingSince,
} from './serviceStages.ts';

describe('plateStep', () => {
  it('walks To serve, Dishing, Checked, On its way, Served', () => {
    expect(plateStep('toServe', 'start')).toBe('dishing');
    expect(plateStep('dishing', 'check')).toBe('checked');
    expect(plateStep('checked', 'takeToTable')).toBe('onItsWay');
    expect(plateStep('onItsWay', 'serve')).toBe('served');
  });

  it('goes back to To serve only when taken off a tray or sent back', () => {
    expect(plateStep('dishing', 'takeOff')).toBe('toServe');
    expect(plateStep('checked', 'takeOff')).toBe('toServe');
    expect(plateStep('onItsWay', 'takeOff')).toBeNull();
    expect(plateStep('onItsWay', 'sendBack')).toBe('toServe');
    expect(plateStep('served', 'sendBack')).toBe('toServe');
    expect(plateStep('checked', 'sendBack')).toBeNull();
  });

  it('refuses every other step', () => {
    expect(plateStep('dishing', 'takeToTable')).toBeNull();
    expect(plateStep('toServe', 'serve')).toBeNull();
    expect(plateStep('served', 'start')).toBeNull();
  });

  it('lists the steps each stage allows', () => {
    expect(stepsFrom('toServe')).toEqual(['start']);
    expect(stepsFrom('checked')).toEqual(['takeOff', 'takeToTable']);
    expect(stepsFrom('served')).toEqual(['sendBack']);
  });
});

describe('isHeld', () => {
  const ready = { state: 'ready' as const };
  const preparing = { state: 'preparing' as const };

  it('holds an order To serve with an item Preparing', () => {
    expect(isHeld({ stage: 'toServe', items: [ready, preparing], choice: null })).toBe(true);
    expect(isHeld({ stage: 'toServe', items: [ready, preparing], choice: 'waitForAll' })).toBe(
      true,
    );
  });

  it("releases one whose guest chose What's ready, now while something is Ready", () => {
    expect(isHeld({ stage: 'toServe', items: [ready, preparing], choice: 'whatsReadyNow' })).toBe(
      false,
    );
    expect(isHeld({ stage: 'toServe', items: [preparing], choice: 'whatsReadyNow' })).toBe(true);
  });

  it('never holds an order past To serve, or one with everything Ready', () => {
    expect(isHeld({ stage: 'dishing', items: [preparing], choice: null })).toBe(false);
    expect(isHeld({ stage: 'toServe', items: [ready], choice: null })).toBe(false);
  });
});

describe('waitingSince', () => {
  it('is the last step', () => {
    expect(waitingSince([{ at: '2027-03-06T20:00:00Z' }, { at: '2027-03-06T20:05:00Z' }])).toBe(
      '2027-03-06T20:05:00Z',
    );
    expect(waitingSince([])).toBeNull();
  });
});

describe('SERVICE_WORD_KEYS', () => {
  it('gives every stage a word and a plural count of its own', () => {
    for (const stage of PLATE_STAGES) {
      expect(SERVICE_WORD_KEYS.stage[stage]).toBe(`service.stage.${stage}`);
      expect(SERVICE_WORD_KEYS.stageCount[stage]).toBe(`service.stageCount.${stage}`);
    }
  });
});

describe('heldUpMinutes', () => {
  const at = (minutes: number) => new Date(Date.UTC(2027, 2, 6, 19, minutes));
  const preparing = (readyIn: number | null, changed = 0, since = 0) => ({
    state: 'preparing' as const,
    readyIn,
    changedAt: at(changed).toISOString(),
    preparingSince: at(since).toISOString(),
  });

  it('keeps the time its disher gave until it passes, then counts from the first Preparing', () => {
    expect(heldUpMinutes(preparing(10), at(9))).toBeNull();
    expect(heldUpMinutes(preparing(10), at(10))).toBe(10);
  });

  it('is Held up 15 minutes on with no time given', () => {
    expect(heldUpMinutes(preparing(null), at(14))).toBeNull();
    expect(heldUpMinutes(preparing(null), at(22))).toBe(22);
  });

  it('runs a new time from when it was given, and still counts from the first Preparing', () => {
    expect(heldUpMinutes(preparing(5, 4, 0), at(8))).toBeNull();
    expect(heldUpMinutes(preparing(5, 4, 0), at(9))).toBe(9);
  });

  it('is never Held up while Ready', () => {
    expect(
      heldUpMinutes(
        { state: 'ready', readyIn: null, changedAt: null, preparingSince: null },
        at(59),
      ),
    ).toBeNull();
  });
});
