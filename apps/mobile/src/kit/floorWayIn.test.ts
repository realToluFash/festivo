import { type FloorRead, NO_ANSWER_MS } from '@soirely/domain';
import type { TFunction } from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { floorRowLine, readFloorRow } from './floorWayIn.ts';
import { afterFailedRead } from './stationWayIn.ts';

const t = ((key: string, values?: Record<string, unknown>) =>
  key === 'service.floor.wayIn.line'
    ? `${String(values?.where)} · ${String(values?.course)}`
    : key) as unknown as TFunction;

const course = (
  id: string,
  name: string,
  firedAt: string | null,
): FloorRead['courses'][number] => ({
  phase: 'on',
  course: { id, name },
  items: [],
  trays: [],
  tables: [
    {
      key: 't1',
      kind: 'table',
      name: 'Table 1',
      seats: [],
      section: { id: 'B', name: 'Section B' },
      people: [],
      firedAt,
      guests: [],
    },
  ],
});

/** Starter fired, Main fired after it, Dessert not yet: the room is on Main. */
const FLOOR: FloorRead = {
  event: 'Adaeze & Tunde',
  yours: [{ id: 'B', name: 'Section B' }],
  floorLead: null,
  manage: false,
  courses: [
    course('starter', 'Starter', '2026-11-28T19:00:00Z'),
    course('main', 'Main', '2026-11-28T19:40:00Z'),
    course('dessert', 'Dessert', null),
  ],
};

const UNFIRED: FloorRead = { ...FLOOR, courses: [course('starter', 'Starter', null)] };

describe('the Floor row’s line (sc-98893)', () => {
  it('one section and the latest fired course', () => {
    expect(floorRowLine(t, FLOOR, 'en')).toBe('Section B · Main');
  });

  it('the section alone before any fire', () => {
    expect(floorRowLine(t, UNFIRED, 'en')).toBe('Section B');
  });

  it('two sections as a list in the shown language, in section order', () => {
    const two = {
      ...FLOOR,
      yours: [
        { id: 'B', name: 'Section B' },
        { id: 'D', name: 'Section D' },
      ],
    };

    expect(floorRowLine(t, two, 'en')).toBe('Section B and Section D · Main');
    expect(floorRowLine(t, two, 'fr')).toBe('Section B et Section D · Main');
  });

  it('All tables with service.manage on no section, with the course rule', () => {
    expect(floorRowLine(t, { ...FLOOR, yours: [], manage: true }, 'en')).toBe(
      'service.floor.wayIn.allTables · Main',
    );
    expect(floorRowLine(t, { ...UNFIRED, yours: [], manage: true }, 'en')).toBe(
      'service.floor.wayIn.allTables',
    );
  });

  it('No section yet for anyone else on none', () => {
    expect(floorRowLine(t, { ...FLOOR, yours: [] }, 'en')).toBe('service.floor.wayIn.noSection');
  });

  it('follows a move: the next read names the new section', () => {
    const moved = { ...FLOOR, yours: [{ id: 'C', name: 'Section C' }] };

    expect([floorRowLine(t, FLOOR, 'en'), floorRowLine(t, moved, 'en')]).toEqual([
      'Section B · Main',
      'Section C · Main',
    ]);
  });
});

describe('offline, the row keeps its line as of its last read', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a read that never answers gives up after NO_ANSWER_MS, and the line reads as of', async () => {
    const first = await readFloorRow(t, Promise.resolve(FLOOR), 'en');
    const unanswered = readFloorRow(t, new Promise(() => {}), 'en').then(
      () => first,
      (error: unknown) => afterFailedRead(first, error),
    );
    await vi.advanceTimersByTimeAsync(NO_ANSWER_MS);

    expect(await unanswered).toEqual({ ...first, stale: true });
  });

  it('a read that fails before the first answer leaves no row', async () => {
    expect(afterFailedRead(null, new Error('offline'))).toBeNull();
  });

  it('a read that succeeds again drops as of', async () => {
    const stale = { ...(await readFloorRow(t, Promise.resolve(FLOOR), 'en')), stale: true };
    const again = await readFloorRow(t, Promise.resolve(FLOOR), 'en');

    expect(stale.stale).toBe(true);
    expect(again.stale).toBe(false);
    expect(again.line).toBe('Section B · Main');
  });
});
