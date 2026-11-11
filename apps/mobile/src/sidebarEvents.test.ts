import type { ListedEvent } from '@soirely/api-client';
import { describe, expect, it, vi } from 'vitest';

import { listedFor, publishSidebarEvents, sidebarList } from './sidebarEvents.ts';

vi.mock('./api.ts', () => ({ api: {} }));
vi.mock('./i18n/index.ts', () => ({ dateLocale: () => 'en-GB' }));
vi.mock('expo-router', () => ({ useFocusEffect: () => undefined }));

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
    hosts: [],
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
    const listed = sidebarList(
      {
        events: [
          event('Draft', { status: 'draft', phase: 'draft' }),
          event('Later', { startsAt: '2026-12-01T19:00:00Z', endsAt: '2026-12-01T23:00:00Z' }),
          event('Soon'),
        ],
        at: NOW,
      },
      NOW,
      LONDON,
    );

    expect(listed.map(({ name }) => name)).toEqual(['Soon', 'Later', 'Draft']);
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
