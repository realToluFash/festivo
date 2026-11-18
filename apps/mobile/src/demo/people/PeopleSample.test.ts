import { describe, expect, it } from 'vitest';

import {
  ADD_PROMPT,
  addedToast,
  addRefusedLine,
  addView,
  ALREADY_A_MEMBER,
  jobHelp,
  outsideRefusal,
  outsideView,
  readTyped,
  firstName,
  listed,
  manages,
  noMatchLine,
  notChangedLine,
  offeredMembers,
  offerLine,
  type OnEvent,
  opens,
  PEOPLE_VIEWERS,
  peopleStart,
  peopleStateOf,
  removedToast,
  removeLine,
  removeTitle,
  rolesOff,
  rowLine,
  sampleMembers,
  sampleOnEvent,
  savedWords,
  seesEveryEvent,
  sheetLine,
  withAdded,
  without,
  withOutside,
  withRole,
} from './PeopleSample.ts';

const members = sampleMembers();
const onEvent = sampleOnEvent();
const on = (name: string): OnEvent => {
  const found = onEvent.find((one) => one.name === name);
  if (found == null) throw new Error(`${name} is on the sample event.`);

  return found;
};
const member = (name: string) => {
  const found = members.find((one) => one.name === name);
  if (found == null) throw new Error(`${name} is in the sample.`);

  return found;
};
const names = (people: readonly { name: string }[]) => people.map((one) => one.name);

describe('People on an event in the demo, as one list', () => {
  it('orders the list by role, then by name within a role', () => {
    expect(names(listed(onEvent))).toEqual([
      'Priya Shah',
      'Ana Souza',
      'Sade Bello',
      'Kemi Okafor',
      'Tom Becker',
    ]);
  });

  it('moves someone to their new place when their role changes', () => {
    const tom = on('Tom Becker');

    expect(names(listed(withRole(onEvent, tom.id, 'Can view')))).toEqual([
      'Priya Shah',
      'Ana Souza',
      'Sade Bello',
      'Tom Becker',
      'Kemi Okafor',
    ]);
  });

  it('names the owners and admins at the foot', () => {
    expect(seesEveryEvent(members)).toBe(
      'Folake Adeyemi and Julien Moreau see every event, as owner and admin of Ire Events.',
    );
  });

  it('starts each state with its viewer and its event', () => {
    expect(peopleStateOf(undefined)).toBe('people');
    expect(peopleStateOf('nonsense')).toBe('people');
    expect(peopleStart('people').viewer).toBe(PEOPLE_VIEWERS.julien);
    expect(peopleStart('readOnly').viewer).toBe(PEOPLE_VIEWERS.ana);
    expect(peopleStart('lead').viewer).toBe(PEOPLE_VIEWERS.priya);
    expect(peopleStart('nobody').onEvent).toEqual([]);
    expect(peopleStart('roleFails').roleFails).toBe(true);
    expect(peopleStart('roleFails').viewer).toBe(PEOPLE_VIEWERS.julien);
    expect(peopleStart('people').roleFails).toBe(false);
    expect(peopleStart('loading').load).toBe('loading');
    expect(peopleStart('failed').load).toBe('failed');
  });

  it('opens Add people on arrival with Julien refused, or with nobody left to add', () => {
    expect(peopleStart('addPartial')).toMatchObject({
      adding: true,
      addRefuses: 'julien@ire.events',
    });
    const full = peopleStart('everyoneOn');
    expect(full.adding).toBe(true);
    expect(addView('', members, full.onEvent)).toEqual({ kind: 'members', offered: [] });
  });
});

describe('a row', () => {
  it('opens every row for an admin', () => {
    const viewer = PEOPLE_VIEWERS.julien;

    expect(manages(viewer, onEvent)).toBe(true);
    expect(onEvent.every((one) => opens(one, viewer, onEvent))).toBe(true);
  });

  it('opens nothing for someone who can edit, and ends her line with You', () => {
    const viewer = PEOPLE_VIEWERS.ana;

    expect(manages(viewer, onEvent)).toBe(false);
    expect(onEvent.some((one) => opens(one, viewer, onEvent))).toBe(false);
    expect(rowLine(on('Ana Souza'), viewer)).toBe('Can edit · You');
  });

  it('opens every row but her own for the lead', () => {
    const viewer = PEOPLE_VIEWERS.priya;
    const opened = listed(onEvent).filter((one) => opens(one, viewer, onEvent));

    expect(manages(viewer, onEvent)).toBe(true);
    expect(names(opened)).toEqual(['Ana Souza', 'Sade Bello', 'Kemi Okafor', 'Tom Becker']);
    expect(rowLine(on('Priya Shah'), viewer)).toBe('Lead · You');
  });

  it('stops a lead changing People once she is no longer the lead', () => {
    const viewer = PEOPLE_VIEWERS.priya;

    expect(manages(viewer, withRole(onEvent, viewer.id, 'Can edit'))).toBe(false);
  });

  it('says the role, then any job label, then You', () => {
    const viewer = PEOPLE_VIEWERS.julien;

    expect(rowLine(on('Tom Becker'), viewer)).toBe('Can check guests in');
    expect(rowLine(on('Kemi Okafor'), viewer)).toBe('Can check guests in · Bar and drinks');
    expect(rowLine({ ...on('Kemi Okafor'), id: viewer.id }, viewer)).toBe(
      'Can check guests in · Bar and drinks · You',
    );
  });
});

describe('a person’s sheet', () => {
  const tom = on('Tom Becker');
  const kemi = on('Kemi Okafor');

  it('says whether they are a member or from outside, with any job label', () => {
    expect(sheetLine(tom)).toBe('Member of Ire Events');
    expect(sheetLine(kemi)).toBe('From outside Ire Events · Bar and drinks');
  });

  it('keeps Lead off for someone from outside', () => {
    expect(rolesOff(kemi)).toEqual(['Lead']);
    expect(rolesOff(tom)).toEqual([]);
  });

  it('says each role aloud once it is saved', () => {
    expect(
      (['Lead', 'Can edit', 'Can view', 'Can check guests in'] as const).map((role) =>
        savedWords(tom, role),
      ),
    ).toEqual([
      'Saved. Tom Becker leads this event now.',
      'Saved. Tom Becker can edit now.',
      'Saved. Tom Becker can view now.',
      'Saved. Tom Becker can check guests in now.',
    ]);
  });

  it('names the role that still holds when a change fails', () => {
    expect(notChangedLine(tom)).toBe(
      'We couldn’t change Tom’s role, so it’s still Can check guests in. Check your connection and pick again.',
    );
  });

  it('asks before removing, for a member and for someone from outside', () => {
    expect(removeTitle(tom)).toBe('Remove Tom Becker from this event?');
    expect(removeLine(tom)).toBe(
      'They lose this event on their next request. They stay in Ire Events.',
    );
    expect(removeLine(kemi)).toBe('Their access ends on their next request.');
    expect(names(without(onEvent, tom.id))).not.toContain('Tom Becker');
    expect(removedToast(tom)).toBe('Tom Becker is off this event.');
  });

  it('calls someone by their first name', () => {
    expect(firstName(tom)).toBe('Tom');
  });
});

describe('adding people', () => {
  it('finds members by name and someone from outside by their address (sc-71)', () => {
    expect(ADD_PROMPT).toBe('Add by name, email or mobile');
  });

  it('offers active members not on the event, members first, filtered by name', () => {
    expect(names(offeredMembers(members, onEvent, ''))).toEqual([
      'Kofi Mensah',
      'Folake Adeyemi',
      'Julien Moreau',
    ]);
    expect(names(offeredMembers(members, onEvent, 'JUL'))).toEqual(['Julien Moreau']);
    expect(names(offeredMembers(members, onEvent, 'kofi@'))).toEqual([]);
    expect(names(offeredMembers(members, [], 'lucia'))).toEqual([]);
    expect(names(offeredMembers(members, [], 'souza'))).toEqual(['Ana Souza']);
  });

  it('matches what is typed with or without accents', () => {
    const accented = members.map((one) =>
      one.name === 'Kofi Mensah' ? { ...one, name: 'Kofí Mensah' } : one,
    );

    expect(names(offeredMembers(accented, onEvent, 'kofi'))).toEqual(['Kofí Mensah']);
  });

  it('says each organisation role on the offered rows, and you on yours', () => {
    const viewer = PEOPLE_VIEWERS.julien;

    expect(offeredMembers(members, onEvent, '').map((one) => offerLine(one, viewer))).toEqual([
      'Member',
      'Owner · sees every event',
      'Admin · sees every event · you',
    ]);
  });

  it('shows the members a name finds, or that nobody matches, an address included', () => {
    expect(addView('', members, onEvent).kind).toBe('members');
    expect(addView(' kofi ', members, onEvent)).toEqual({
      kind: 'members',
      offered: [member('Kofi Mensah')],
    });
    expect(addView('kemi.okafor@example.com', members, onEvent)).toEqual({
      kind: 'nobody',
      typed: 'kemi.okafor@example.com',
    });
    expect(noMatchLine('Kemi')).toBe('Nobody in Ire Events matches “Kemi”.');
  });

  it('adds the ticked members under the role, in their place, and says how many', () => {
    const added = withAdded(onEvent, 'Can view', [
      member('Kofi Mensah'),
      member('Folake Adeyemi'),
      member('Julien Moreau'),
    ]);

    expect(names(listed(added.onEvent))).toEqual([
      'Priya Shah',
      'Ana Souza',
      'Folake Adeyemi',
      'Julien Moreau',
      'Kofi Mensah',
      'Sade Bello',
      'Kemi Okafor',
      'Tom Becker',
    ]);
    expect(addedToast(added.names, 'Can view')).toBe('3 people can view now.');
    expect(addedToast(['Kofi Mensah'], 'Can view')).toBe('Kofi Mensah can view now.');
    expect(addedToast(['Kofi Mensah', 'Julien Moreau'], 'Lead')).toBe(
      '2 people lead this event now.',
    );
  });
});

describe('Add people refused part way', () => {
  it('says who went in, then who is still ticked', () => {
    expect(addRefusedLine('Can view', ['Kofi Mensah'], ['Julien Moreau'])).toBe(
      'Kofi Mensah can view now. We couldn’t add Julien Moreau, so they’re still ticked. Check your connection and press Add again.',
    );
    expect(addRefusedLine('Can view', ['Kofi Mensah', 'Ana Souza'], ['A', 'B', 'C'])).toBe(
      '2 people can view now. We couldn’t add the 3 still ticked. Check your connection and press Add again.',
    );
  });

  it('says only the refusal when nobody went in', () => {
    expect(addRefusedLine('Lead', [], ['Julien Moreau'])).toBe(
      'We couldn’t add Julien Moreau, so they’re still ticked. Check your connection and press Add again.',
    );
  });
});

describe('adding someone from outside (sc-71)', () => {
  it('reads an @ as an email address, digits as a mobile number, and letters as a name', () => {
    expect(readTyped('Kofi', 'NG')).toEqual({ kind: 'name' });
    expect(readTyped('  ', 'NG')).toEqual({ kind: 'name' });
    expect(readTyped('bisi@lagoslights.example', 'NG')).toEqual({
      kind: 'address',
      address: {
        kind: 'email',
        address: 'bisi@lagoslights.example',
        shown: 'bisi@lagoslights.example',
      },
    });
    expect(readTyped('bisi@lagos', 'NG')).toEqual({ kind: 'unusable' });
    expect(readTyped('kofi@', 'NG')).toEqual({ kind: 'unusable' });
  });

  it('checks a mobile number by the country’s lengths and keeps it in E.164', () => {
    expect(readTyped('0803 555 0142', 'NG')).toEqual({
      kind: 'address',
      address: { kind: 'mobile', address: '+2348035550142', shown: '+234 803 555 0142' },
    });
    expect(readTyped('+351 912 345 678', 'NG')).toMatchObject({
      address: { address: '+351912345678' },
    });
    expect(readTyped('0803 12', 'NG')).toEqual({ kind: 'unusable' });
    expect(readTyped('0803 555 0142 9999 9999 99', 'NG')).toEqual({ kind: 'unusable' });
  });

  it('offers the address under any role but Lead, and says so under Lead', () => {
    const email = 'bisi@lagoslights.example';

    expect(outsideView(email, 'NG', 'Can view').kind).toBe('offer');
    expect(outsideView(email, 'NG', 'Can edit').kind).toBe('offer');
    expect(outsideView(email, 'NG', 'Lead')).toEqual({ kind: 'leadOff' });
    expect(outsideView('Kofi', 'NG', 'Lead')).toEqual({ kind: 'none' });
    expect(outsideView('bisi@', 'NG', 'Can view')).toEqual({ kind: 'unusable' });
  });

  it('does not offer someone already on the event', () => {
    expect(outsideView('Kemi.Okafor@example.com', 'NG', 'Can view', onEvent)).toEqual({
      kind: 'onEvent',
      name: 'Kemi Okafor',
    });
  });

  it('leaves already_a_member to the server, in its own words', () => {
    const address = {
      kind: 'email',
      address: 'Kofi@ire.events',
      shown: 'Kofi@ire.events',
    } as const;

    expect(outsideRefusal(address, members)).toBe(ALREADY_A_MEMBER);
    expect(addRefusedLine('Can view', [], ['Kofi@ire.events'], ALREADY_A_MEMBER)).toBe(
      'That person is already a member of this organisation.',
    );
    expect(outsideRefusal({ ...address, address: 'bisi@lagoslights.example' }, members)).toBeNull();
  });

  it('puts them on the list as Outside, with their job label, and counts the label to 60', () => {
    const address = {
      kind: 'mobile',
      address: '+2348035550142',
      shown: '+234 803 555 0142',
    } as const;
    const after = withOutside(onEvent, 'Can check guests in', address, ' Bar and drinks ');
    const added = after.find((one) => one.id === '+2348035550142');

    expect(added).toMatchObject({
      outside: true,
      label: 'Bar and drinks',
      name: '+234 803 555 0142',
    });
    expect(rowLine(added as OnEvent, PEOPLE_VIEWERS.julien)).toBe(
      'Can check guests in · Bar and drinks',
    );
    expect(withOutside([], 'Can view', address, '  ')[0]?.label).toBeNull();
    expect(jobHelp('Kitchen')).toBe(
      'What they’re there for, shown beside their name. It grants nothing. 7 of 60.',
    );
  });

  it('opens each Add state from its link', () => {
    expect(peopleStart(peopleStateOf('addOutside'))).toMatchObject({
      adding: true,
      addTyped: 'bisi@lagoslights.example',
    });
    expect(peopleStart(peopleStateOf('addLeadOutside'))).toMatchObject({ addRole: 'Lead' });
    expect(peopleStart(peopleStateOf('addMemberAddress')).addTyped).toBe('kofi@ire.events');
  });
});
