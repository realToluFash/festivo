import { describe, expect, it } from 'vitest';

import {
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
