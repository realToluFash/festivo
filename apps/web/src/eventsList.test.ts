import type { EventPhase } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { type ListEvent, dayTiles, shownEvent } from './eventsList.ts';

const DAY = 86_400_000;

const lasting = (days: number, phase: EventPhase) =>
  shownEvent(
    {
      id: 'ev-1',
      name: 'Ana & Leo',
      timeZone: 'Europe/Madrid',
      startsAt: '2026-11-14T09:00:00+01:00',
      endsAt: new Date(Date.parse('2026-11-14T22:00:00+01:00') + (days - 1) * DAY).toISOString(),
      status: 'live',
      concludedAt: null,
      place: null,
      photo: null,
      milestones: [],
    } as ListEvent,
    phase,
  );

const drawn = (tiles: ReturnType<typeof dayTiles>) =>
  tiles.map((tile) => {
    if (tile.kind === 'gap') return tile.more;

    return tile.today ? `[${tile.day}]` : tile.day;
  });

const before = new Date('2026-11-01T12:00:00+01:00');

describe('dayTiles', () => {
  it('keeps a tile a day for up to a week', () => {
    expect(drawn(dayTiles(lasting(7, 'live'), before, 'en-GB'))).toEqual([
      '14',
      '15',
      '16',
      '17',
      '18',
      '19',
      '20',
    ]);
  });

  it('draws the first and last day of a longer event, with the days between counted', () => {
    expect(drawn(dayTiles(lasting(8, 'live'), before, 'en-GB'))).toEqual(['14', '+6', '21']);
    expect(drawn(dayTiles(lasting(547, 'draft'), before, 'en-GB'))).toEqual(['14', '+545', '13']);
  });

  it('adds today between them only while it is on', () => {
    const on = new Date('2026-11-18T12:00:00+01:00');

    expect(drawn(dayTiles(lasting(10, 'happening_now'), on, 'en-GB'))).toEqual([
      '14',
      '+3',
      '[18]',
      '+4',
      '23',
    ]);
    expect(drawn(dayTiles(lasting(10, 'paused'), on, 'en-GB'))).toEqual(['14', '+8', '23']);
  });

  it("draws a single hidden day's own tile rather than +1", () => {
    const second = new Date('2026-11-16T12:00:00+01:00');

    expect(drawn(dayTiles(lasting(9, 'happening_now'), second, 'en-GB'))).toEqual([
      '14',
      '15',
      '[16]',
      '+5',
      '22',
    ]);
  });

  it('marks today on the end it falls on', () => {
    const last = new Date('2026-11-21T12:00:00+01:00');

    expect(drawn(dayTiles(lasting(8, 'happening_now'), last, 'en-GB'))).toEqual([
      '14',
      '+6',
      '[21]',
    ]);
  });

  it('keys each tile by its date, so a day number that repeats a month on is its own', () => {
    const keys = dayTiles(lasting(31, 'live'), before, 'en-GB').map((tile) => tile.key);

    expect(keys).toEqual(['2026-11-14', 'gap-2026-11-14', '2026-12-14']);
  });

  it('draws no tiles once it is over', () => {
    expect(dayTiles(lasting(10, 'finished'), before, 'en-GB')).toEqual([]);
  });
});
