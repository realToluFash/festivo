import { describe, expect, it } from 'vitest';

import {
  listed,
  manages,
  NOT_JOINED,
  seenBy,
  outsideRefusal,
  outsideView,
  offeredMembers,
  opens,
  PEOPLE_PAGES,
  PEOPLE_STATES,
  PEOPLE_VIEWERS,
  peopleStart,
  peopleStateOf,
  rolesOff,
  rowLine,
  sampleMembers,
  sampleOnEvent,
  seesEveryEvent,
  withOutside,
} from './people.ts';

const names = (people: readonly { name: string }[]) => people.map((one) => one.name);

describe('People on an event at a desk (sc-29915)', () => {
  it('lists the lead first, then by role, then by name', () => {
    expect(names(listed(sampleOnEvent()))).toEqual([
      'Priya Shah',
      'Ana Souza',
      'Sade Bello',
      'Kemi Okafor',
      'Tom Becker',
    ]);
  });

  it('lets an owner, an admin or the lead change who is on it, and nobody their own row', () => {
    const onEvent = sampleOnEvent();
    const [priya] = listed(onEvent);
    if (priya == null) throw new Error('nobody leads it');

    expect(manages(PEOPLE_VIEWERS.julien, onEvent)).toBe(true);
    expect(manages(PEOPLE_VIEWERS.ana, onEvent)).toBe(false);
    expect(manages(PEOPLE_VIEWERS.priya, onEvent)).toBe(true);
    expect(opens(priya, PEOPLE_VIEWERS.priya, onEvent)).toBe(false);
    expect(opens(priya, PEOPLE_VIEWERS.julien, onEvent)).toBe(true);
  });

  it('names the owners and admins at the foot, for everyone', () => {
    expect(seesEveryEvent(sampleMembers())).toBe(
      'Folake Adeyemi and Julien Moreau see every event, as owner and admin of Ire Events.',
    );
  });

  it('offers active members not on it yet, by name only, less you, and keeps a tick in view', () => {
    const members = sampleMembers();
    const onEvent = sampleOnEvent();
    const julien = PEOPLE_VIEWERS.julien;

    expect(names(offeredMembers(members, onEvent, julien, ''))).toEqual([
      'Folake Adeyemi',
      'Kofi Mensah',
    ]);
    expect(names(offeredMembers(members, onEvent, PEOPLE_VIEWERS.priya, ''))).toEqual([
      'Folake Adeyemi',
      'Julien Moreau',
      'Kofi Mensah',
    ]);
    expect(names(offeredMembers(members, onEvent, julien, 'kofi'))).toEqual(['Kofi Mensah']);
    expect(offeredMembers(members, onEvent, julien, 'ire.events')).toEqual([]);
    expect(
      names(offeredMembers(members, onEvent, PEOPLE_VIEWERS.priya, 'zzz', ['julien@ire.events'])),
    ).toEqual(['Julien Moreau']);
  });

  it('marks you on your row, and keeps Lead for members', () => {
    const [, ana, sade] = listed(sampleOnEvent());
    if (ana == null || sade == null) throw new Error('the sample is short');

    expect(rowLine(ana, PEOPLE_VIEWERS.ana)).toBe('Can edit · You');
    expect(rowLine(sade, PEOPLE_VIEWERS.julien)).toBe('Can view · The Landmark’s coordinator');
    expect(rolesOff(sade)).toEqual(['Lead']);
    expect(rolesOff(ana)).toEqual([]);
  });

  it('opens each state from a link of its own, and people for a name it does not know', () => {
    const links = PEOPLE_PAGES.flatMap((page) => page.states.map((state) => state.to));

    expect(links).toHaveLength(PEOPLE_STATES.length);
    expect(new Set(links).size).toBe(links.length);
    expect(peopleStateOf('nope')).toBe('people');
    expect(peopleStart('lead').viewer).toBe(PEOPLE_VIEWERS.priya);
    expect(peopleStart('nobody').onEvent).toEqual([]);
    expect(peopleStart('failed').load).toBe('failed');
  });
});

describe('someone from outside at a desk (sc-71)', () => {
  it('reads an @ as an email address, digits as a mobile number, letters as a name', () => {
    expect(outsideView('Kofi', 'NG', 'Can view')).toEqual({ kind: 'none' });
    expect(outsideView('bisi@lagoslights.example', 'NG', 'Can view')).toMatchObject({
      kind: 'offer',
      address: { kind: 'email' },
    });
    expect(outsideView('0803 555 0142', 'NG', 'Can view')).toMatchObject({
      address: { kind: 'mobile', address: '+2348035550142', shown: '+234 803 555 0142' },
    });
    expect(outsideView('0803 12', 'NG', 'Can view')).toEqual({ kind: 'unusable' });
    expect(outsideView('bisi@', 'NG', 'Can view')).toEqual({ kind: 'unusable' });
    expect(outsideView('bisi@lagoslights.example', 'NG', 'Lead')).toEqual({ kind: 'leadOff' });
  });

  it('does not offer someone on the event already, and leaves already_a_member to the server', () => {
    expect(outsideView('kemi.okafor@example.com', 'NG', 'Can view', sampleOnEvent())).toEqual({
      kind: 'onEvent',
      name: 'Kemi Okafor',
    });
    const kofi = { kind: 'email', address: 'kofi@ire.events', shown: 'kofi@ire.events' } as const;
    expect(outsideRefusal(kofi, sampleMembers())).toBe(
      'That person is already a member of this organisation.',
    );
  });

  it('lists them as from outside, with the job label trimmed or none', () => {
    const phone = {
      kind: 'mobile',
      address: '+2348035550142',
      shown: '+234 803 555 0142',
    } as const;
    const [added] = withOutside([], 'Can view', phone, ' Kitchen ');

    expect(added).toMatchObject({ outside: true, label: 'Kitchen', name: '+234 803 555 0142' });
    expect(withOutside([], 'Can view', phone, ' ')[0]?.label).toBeNull();
  });

  it('withholds the address of someone not joined yet from a viewer who does not manage it (pm #67966)', () => {
    const start = peopleStart('readOnly');
    expect(manages(start.viewer, start.onEvent)).toBe(false);
    const seen = seenBy(start.onEvent, false);
    expect(seen.find((one) => one.withheld === true)).toMatchObject({
      name: NOT_JOINED,
      role: 'Can check guests in',
      outside: true,
      label: 'Lighting',
    });
    expect(JSON.stringify(seen)).not.toContain('lagoslights');
    expect(seenBy(start.onEvent, true).find((one) => one.initials === '')?.name).toBe(
      'bisi@lagoslights.example',
    );
  });
});
