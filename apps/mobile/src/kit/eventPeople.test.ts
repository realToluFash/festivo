import type { EventPerson, EventRole } from '@soirely/api-client';
import { init, t } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';

import {
  inListOrder,
  managesPeople,
  nowCan,
  offered,
  opensRow,
  rowLine,
  seesEveryEvent,
} from './eventPeople.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

function person(id: string, name: string, role: EventRole, jobLabel: string | null = null) {
  return {
    id,
    membershipId: `m_${id}`,
    user: { id: `u_${id}`, name },
    role,
    jobLabel,
    outside: false,
  } satisfies EventPerson;
}

const PRIYA = person('priya', 'Priya Shah', 'lead');
const TOM = person('tom', 'Tom Becker', 'can_check_in', 'Door');
const ANA = person('ana', 'Ana Souza', 'can_edit');
const BEN = person('ben', 'Ben Adler', 'can_check_in');

describe('People on an event', () => {
  it('runs by role, Lead first, then by name', () => {
    expect(inListOrder([TOM, BEN, ANA, PRIYA], 'en').map((one) => one.id)).toEqual([
      'priya',
      'ana',
      'ben',
      'tom',
    ]);
  });

  it('is changed by whoever the event gives people.manage', () => {
    expect(managesPeople({ permissions: ['events.read', 'people.manage'] })).toBe(true);
    expect(managesPeople({ permissions: ['events.read'] })).toBe(false);
  });

  it('opens every row but your own, and none without people.manage', () => {
    expect(opensRow(TOM.user.id, true, 'u_priya')).toBe(true);
    expect(opensRow(PRIYA.user.id, true, 'u_priya')).toBe(false);
    expect(opensRow(TOM.user.id, false, 'u_priya')).toBe(false);
  });

  it('lines a row with its role, then any job label, then You', () => {
    expect(rowLine(t, TOM, 'u_priya')).toBe('Can check guests in · Door');
    expect(rowLine(t, PRIYA, 'u_priya')).toBe('Lead · You');
  });

  it('names the owners and admins who see every event', () => {
    expect(
      seesEveryEvent(
        t,
        { owners: ['Folake Adeyemi'], admins: ['Julien Morel'] },
        'Ire Events',
        'en',
      ),
    ).toBe('Folake Adeyemi and Julien Morel see every event, as owner and admin of Ire Events.');
    expect(seesEveryEvent(t, { owners: ['Folake Adeyemi'], admins: [] }, 'Ire Events', 'en')).toBe(
      'Folake Adeyemi sees every event, as owner of Ire Events.',
    );
    expect(seesEveryEvent(t, { owners: [], admins: [] }, 'Ire Events', 'en')).toBeNull();
  });

  it('says who was added, and how many when several were', () => {
    expect(nowCan(t, 'can_view', ['Kofi Mensah'])).toBe('Kofi Mensah can view now.');
    expect(nowCan(t, 'can_view', ['A', 'B', 'C'])).toBe('3 people can view now.');
  });

  it('finds members by name, ignoring accents and case', () => {
    const addable = [
      { membershipId: 'm1', name: 'Lucía Pérez' },
      { membershipId: 'm2', name: 'Kofi Mensah' },
    ];

    expect(offered(addable, 'lucia').map((one) => one.membershipId)).toEqual(['m1']);
    expect(offered(addable, '  ')).toHaveLength(2);
    expect(offered(addable, 'zed')).toEqual([]);
  });
});
