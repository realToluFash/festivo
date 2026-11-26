import { keptServiceTap } from '@soirely/api-client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { storedServiceTaps } from './serviceTaps.ts';

const tap = keptServiceTap(
  'evt-1',
  { kind: 'check', trayId: 't1' },
  { plates: { p1: 'dishing' } },
  'k1',
);

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('service taps kept in the browser', () => {
  it('are there after the tab is closed and opened again, and gone once sent', async () => {
    await storedServiceTaps('evt-1').save([tap]);

    expect(await storedServiceTaps('evt-1').load()).toEqual([tap]);

    await storedServiceTaps('evt-1').save([]);
    expect(window.localStorage.getItem('soirely.serviceTaps.evt-1')).toBeNull();
  });

  it('are one store per event, so every view sees the taps another kept', () => {
    expect(storedServiceTaps('evt-3')).toBe(storedServiceTaps('evt-3'));
    expect(storedServiceTaps('evt-3')).not.toBe(storedServiceTaps('evt-4'));
  });

  it('are kept in memory where storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const store = storedServiceTaps('evt-blocked');

    await store.save([tap]);

    expect(await store.load()).toEqual([tap]);
  });
});
