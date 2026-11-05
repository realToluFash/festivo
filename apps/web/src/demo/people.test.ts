import { describe, expect, it } from 'vitest';

import {
  listed,
  manages,
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

  it('offers active members not on it yet, by name only, and keeps a tick in view', () => {
    const members = sampleMembers();
    const onEvent = sampleOnEvent();

    expect(names(offeredMembers(members, onEvent, ''))).toEqual([
      'Folake Adeyemi',
      'Julien Moreau',
      'Kofi Mensah',
    ]);
    expect(names(offeredMembers(members, onEvent, 'kofi'))).toEqual(['Kofi Mensah']);
    expect(offeredMembers(members, onEvent, 'ire.events')).toEqual([]);
    expect(names(offeredMembers(members, onEvent, 'zzz', ['julien@ire.events']))).toEqual([
      'Julien Moreau',
    ]);
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
