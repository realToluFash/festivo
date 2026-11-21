import type { ListedEvent } from '@soirely/api-client';
import { createInstance } from 'i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import en from './i18n/locales/en.json';
import { todayMoment } from './kit/todayMoment.ts';
import {
  listLeast,
  listedFor,
  publishSidebarEvents,
  sidebarList,
  sidebarRow,
} from './sidebarEvents.ts';

vi.mock('./api.ts', () => ({ api: {} }));
vi.mock('./i18n/index.ts', () => ({ dateLocale: () => 'en-GB' }));
vi.mock('expo-router', () => ({ useFocusEffect: () => undefined }));

const i18n = createInstance();
beforeAll(() =>
  i18n.init({
    resources: { en: { translation: en } },
    lng: 'en',
    interpolation: { escapeValue: false },
  }),
);

const NOW = new Date('2026-11-03T09:41:00Z');
const LONDON = { timeZone: 'Europe/London', locale: 'en-GB' };

function event(name: string, rest: Partial<ListedEvent> = {}): ListedEvent {
  return {
    id: name,
    organisationId: 'org',
    name,
    type: 'wedding',
    status: 'live',
    phase: 'live',
    startsAt: '2026-11-06T19:00:00Z',
    endsAt: '2026-11-08T14:00:00Z',
    timeZone: 'Europe/London',
    dayCount: 3,
    currency: 'GBP',
    cover: null,
    venue: null,
    arrivalNote: null,
    hosts: [],
    thankYou: null,
    madeLiveAt: '2026-10-01T00:00:00Z',
    pausedAt: null,
    concludedAt: null,
    createdAt: '2026-10-01T00:00:00Z',
    permissions: [],
    milestones: [],
    ...rest,
  };
}

describe('sidebarList', () => {
  it("lists Today's events in Today's order, drafts after", () => {
    const loaded = {
      events: [
        event('Draft', { status: 'draft', phase: 'draft' }),
        event('Later', { startsAt: '2026-12-01T19:00:00Z', endsAt: '2026-12-01T23:00:00Z' }),
        event('Soon'),
      ],
      at: NOW,
    };
    const listed = sidebarList(loaded, NOW, LONDON);

    expect(listed.map(({ name }) => name)).toEqual(['Soon', 'Later', 'Draft']);
    expect(listed).toEqual(
      todayMoment(loaded, NOW, LONDON, 'Folake', i18n.t).events.map(({ event }) => event),
    );
  });
});

describe('listedFor', () => {
  it("never shows another organisation's or another account's list", () => {
    publishSidebarEvents('acc', 'orgA', { events: [event('A only')], at: new Date() });

    expect(listedFor('acc', 'orgB')).toEqual([]);
    expect(listedFor('other', 'orgA')).toEqual([]);
    expect(listedFor(undefined, 'orgA')).toEqual([]);
  });
});

describe('listLeast', () => {
  const LARGEST = 3.12;
  const size = 12 * LARGEST;
  const row = sidebarRow(LARGEST);
  const twoLines = 103.5;

  it('draws a row at the largest text with its padding', () => {
    expect(row).toBeCloseTo(69.29, 2);
  });

  it.each([
    [1, 172.79],
    [2, 242.08],
    [3, 311.37],
  ])('counts a two-line heading as drawn over %i events', (rows, least) => {
    expect(listLeast({ heading: twoLines, size, rows, row })).toBeCloseTo(least, 2);
  });

  it.each([4, 20])('stops at four rows with %i events', (rows) => {
    expect(listLeast({ heading: twoLines, size, rows, row })).toBeCloseTo(380.66, 2);
  });

  it('counts the heading as one line before it has been drawn', () => {
    expect(listLeast({ heading: null, size, rows: 2, row })).toBeCloseTo(196.26, 2);
  });
});
