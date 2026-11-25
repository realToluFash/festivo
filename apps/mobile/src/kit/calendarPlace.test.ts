import { monthOfDay } from '@soirely/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { keepPlace, openingOf } from './calendarPlace.ts';

const kept = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (key: string) => kept.get(key) ?? null,
    setItem: async (key: string, value: string) => void kept.set(key, value),
  },
}));

const TODAY = '2026-11-19';
const A = 'acc_a';
const B = 'acc_b';

beforeEach(() => kept.clear());

describe('where the Calendar opens on a device (sc-74024)', () => {
  it('opens a person who has never chosen on Month at today', async () => {
    await expect(openingOf(A, TODAY)).resolves.toEqual({ view: 'month', at: TODAY });
  });

  it('keeps each of two people on one device to their own view and month', async () => {
    await keepPlace(A, { view: 'agenda', month: monthOfDay('2027-03-01') });

    await expect(openingOf(B, TODAY)).resolves.toEqual({ view: 'month', at: TODAY });
    await keepPlace(B, { view: 'month', month: monthOfDay('2027-01-01') });

    await expect(openingOf(A, TODAY)).resolves.toEqual({ view: 'agenda', at: '2027-03-01' });
    await expect(openingOf(B, TODAY)).resolves.toEqual({ view: 'month', at: '2027-01-01' });
  });

  it('gives the place the device kept before this change to nobody', async () => {
    kept.set('soirely.calendar', '{"view":"month","month":"2024-11"}');

    await expect(openingOf(A, TODAY)).resolves.toEqual({ view: 'month', at: TODAY });
  });

  it('lands on today when the kept month is the current one', async () => {
    await keepPlace(A, { view: 'agenda', month: monthOfDay(TODAY) });

    await expect(openingOf(A, TODAY)).resolves.toEqual({ view: 'agenda', at: TODAY });
  });
});
