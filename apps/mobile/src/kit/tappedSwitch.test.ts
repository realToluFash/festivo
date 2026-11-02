import { describe, expect, it } from 'vitest';

import { type TappedSwitch, tappedSwitches } from './tappedSwitch.ts';

describe('a tapped switch of organisation', () => {
  it('reaches the screen in view as it lands', () => {
    const switches = tappedSwitches();
    const told: TappedSwitch[] = [];
    switches.listen((answer) => told.push(answer));

    switches.landed('b');

    expect(told).toEqual([{ id: 'b' }]);
  });

  it('is a new answer with each switch, into the same organisation too', () => {
    const switches = tappedSwitches();
    const told: TappedSwitch[] = [];
    switches.listen((answer) => told.push(answer));

    switches.landed('b');
    switches.landed('b');

    expect(told).toHaveLength(2);
    expect(told[0]).not.toBe(told[1]);
  });

  it('is never kept for a screen that comes into view later', () => {
    const switches = tappedSwitches();
    switches.landed('b');
    const told: TappedSwitch[] = [];

    switches.listen((answer) => told.push(answer));

    expect(told).toEqual([]);
  });

  it('does not reach a screen gone out of view', () => {
    const switches = tappedSwitches();
    const told: TappedSwitch[] = [];
    const stop = switches.listen((answer) => told.push(answer));

    stop();
    switches.landed('b');

    expect(told).toEqual([]);
  });
});
