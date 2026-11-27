import { type Milestone } from '@soirely/domain';
import { createInstance } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import { eventNeeds } from './eventNeeds.ts';
import { dayWords } from './todayMoment.ts';

const i18n = createInstance();
beforeAll(() =>
  i18n.init({
    resources: { en: { translation: en } },
    lng: 'en',
    interpolation: { escapeValue: false },
  }),
);

const MANAGES = ['menu.read', 'menu.manage'];
const LAGOS = 'Africa/Lagos';

const day = (date: string, withYear: boolean): string =>
  dayWords(date, 'en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });

function milestone(at: string, overrides: Partial<Milestone> = {}): Milestone {
  return {
    at,
    title: 'Give final numbers to the kitchen',
    note: null,
    owner: 'you',
    area: 'menu',
    action: null,
    ...overrides,
  };
}

const rows = (
  milestones: Milestone[],
  now: string,
  permissions: string[] = MANAGES,
  timeZone = LAGOS,
) =>
  eventNeeds(
    milestones,
    {
      permissions,
      status: 'live',
      startsAt: '2026-12-01T12:00:00Z',
      endsAt: '2026-12-01T20:00:00Z',
    },
    timeZone,
    new Date(now),
    'en-US',
    day,
    i18n.t,
  );

describe('an event’s Needs you rows', () => {
  it('lists a You milestone for manage and none for read only', () => {
    const own = [milestone('2026-11-20T22:59:00Z')];

    expect(rows(own, '2026-11-10T09:00:00Z')).toHaveLength(1);
    expect(rows(own, '2026-11-10T09:00:00Z', ['menu.read'])).toEqual([]);
  });

  it('leaves out Automatic and Event milestones', () => {
    expect(
      rows(
        [
          milestone('2026-11-20T10:00:00Z', { owner: 'automatic' }),
          milestone('2026-11-20T10:00:00Z', { owner: 'event' }),
        ],
        '2026-11-10T09:00:00Z',
      ),
    ).toEqual([]);
  });

  it('words each due form and the late forms, counted in the event’s zone', () => {
    const at = (iso: string) => rows([milestone(iso)], '2026-11-10T09:00:00Z')[0];

    expect(at('2026-11-10T22:59:00Z')?.due).toBe('Due today');
    expect(at('2026-11-11T22:59:00Z')?.due).toBe('Due tomorrow');
    expect(at('2026-11-13T22:59:00Z')?.due).toBe('Due Fri, Nov 13');
    expect(at('2027-01-13T22:59:00Z')?.due).toBe('Due Wed, Jan 13, 2027');
    expect(at('2026-11-10T08:00:00Z')).toMatchObject({ due: 'Overdue', late: true });
    expect(at('2026-11-09T22:59:00Z')).toMatchObject({ due: '1 day overdue', late: true });
    expect(at('2026-11-08T22:59:00Z')).toMatchObject({ due: '2 days overdue', late: true });
  });

  it('counts the day in the event’s zone, whatever zone the reader is in', () => {
    // 23:59 in Lagos on 10 Nov is still 9 Nov in Los Angeles; the event's zone decides.
    expect(rows([milestone('2026-11-10T22:59:00Z')], '2026-11-10T08:00:00Z')[0]?.due).toBe(
      'Due today',
    );
  });

  it('puts overdue rows first and breaks a tie by title', () => {
    const list = rows(
      [
        milestone('2026-11-20T10:00:00Z', { title: 'Zeta' }),
        milestone('2026-11-05T10:00:00Z', { title: 'Late one' }),
        milestone('2026-11-20T10:00:00Z', { title: 'Alpha' }),
      ],
      '2026-11-10T09:00:00Z',
    );

    expect(list.map(({ title }) => title)).toEqual(['Late one', 'Alpha', 'Zeta']);
  });
});
