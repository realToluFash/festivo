import type { OutsideEvent } from '@soirely/api-client';
import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';

import {
  levelLine,
  outsideLanding,
  outsideMore,
  outsideOn,
  outsidePlaces,
  readsOverview,
} from './outsideEvent.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const WEDDING: OutsideEvent = {
  id: 'ev_1',
  name: 'Adaeze and Tunde',
  organisationName: 'Ìrè Events',
  role: 'can_view',
  jobLabel: 'Cloakroom',
  startsAt: '2030-11-14T16:00:00+01:00',
  endsAt: '2030-11-15T02:00:00+01:00',
};

const LAUNCH: OutsideEvent = { ...WEDDING, id: 'ev_2', name: 'Studio launch', role: 'can_edit' };

const MEMBERSHIP = { id: 'org_1' };

describe('what a level held from outside opens', () => {
  it('opens the reading areas at Can view', () => {
    expect(outsidePlaces('can_view')).toEqual([
      'overview',
      'guests',
      'schedule',
      'seating',
      'people',
    ]);
    expect(outsideMore('can_view')).toEqual(['schedule', 'seating', 'people']);
  });

  it('opens the same areas at Can check guests in', () => {
    expect(outsidePlaces('can_check_in')).toEqual(outsidePlaces('can_view'));
    expect(outsideMore('can_check_in')).toEqual(['schedule', 'seating', 'people']);
  });

  it('opens every area but Budget at Can edit', () => {
    const places = outsidePlaces('can_edit');

    expect(places).not.toContain('budget');
    expect(places).toEqual(
      expect.arrayContaining([
        'overview',
        'guests',
        'menu',
        'messages',
        'staff',
        'people',
        'reports',
      ]),
    );
    expect(outsideMore('can_edit')).not.toContain('overview');
    expect(outsideMore('can_edit')).not.toContain('guests');
    expect(outsideMore('can_edit')).toContain('menu');
  });
});

describe('where an account in no organisation lands', () => {
  it('lands on the API’s first: under way, then soonest, then the grant made first, never re-sorted here', () => {
    const account = { outsideEvents: [LAUNCH, WEDDING] };

    expect(outsideLanding({ account, organisation: null })?.id).toBe('ev_2');
  });

  it('lands nowhere with no event held from outside', () => {
    expect(outsideLanding({ account: { outsideEvents: [] }, organisation: null })).toBeNull();
  });

  it('lands nowhere in an organisation, or paused in one', () => {
    const account = { outsideEvents: [WEDDING] };

    expect(outsideLanding({ account, organisation: MEMBERSHIP })).toBeNull();
    expect(outsideLanding({ account, organisation: null, pausedIn: MEMBERSHIP })).toBeNull();
  });

  it('finds the held event by id, and no other', () => {
    const held = { account: { outsideEvents: [WEDDING, LAUNCH] }, organisation: null };

    expect(outsideOn(held, 'ev_2')?.role).toBe('can_edit');
    expect(outsideOn(held, 'ev_9')).toBeNull();
    expect(outsideOn({ ...held, organisation: MEMBERSHIP }, 'ev_1')).toBeNull();
  });
});

describe('Overview held from outside', () => {
  const ENDS = { endsAt: '2030-11-15T01:00:00Z', timeZone: 'Africa/Lagos' };

  it('is the demo’s own at the two reading levels, the member’s at Can edit', () => {
    expect(readsOverview('can_view')).toBe(true);
    expect(readsOverview('can_check_in')).toBe(true);
    expect(readsOverview('can_edit')).toBe(false);
  });

  it('lines the card with the level, the job label and when it ends, in the event’s time', () => {
    expect(levelLine(t, WEDDING, ENDS, 'en-GB')).toBe(
      'Can view · Cloakroom · until Fri 15 Nov, 02:00',
    );
  });

  it('leaves the job label out when there is none', () => {
    expect(levelLine(t, { role: 'can_check_in', jobLabel: null }, ENDS, 'en-GB')).toBe(
      'Can check guests in · until Fri 15 Nov, 02:00',
    );
  });
});
