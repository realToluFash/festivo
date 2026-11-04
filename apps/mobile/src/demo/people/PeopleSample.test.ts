import { describe, expect, it } from 'vitest';

import {
  addedToast,
  addressOf,
  addView,
  fieldLabel,
  firstName,
  jobHelp,
  linkLine,
  listed,
  manages,
  noMatchLine,
  notChangedLine,
  offeredMembers,
  offerLine,
  type OnEvent,
  opens,
  outsiderFor,
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

  it('calls someone by their first name, and an address by itself', () => {
    expect(firstName(tom)).toBe('Tom');
    expect(firstName({ id: '07700 900123', name: '07700 900123' })).toBe('07700 900123');
  });
});

describe('adding people', () => {
  it('asks for a name only under Lead', () => {
    expect(fieldLabel('Lead')).toBe('Name');
    expect(fieldLabel('Can view')).toBe('Name, email or mobile number');
  });

  it('offers active members not on the event, members first, filtered by name or email', () => {
    expect(names(offeredMembers(members, onEvent, ''))).toEqual([
      'Kofi Mensah',
      'Folake Adeyemi',
      'Julien Moreau',
    ]);
    expect(names(offeredMembers(members, onEvent, 'JUL'))).toEqual(['Julien Moreau']);
    expect(names(offeredMembers(members, onEvent, 'kofi@'))).toEqual(['Kofi Mensah']);
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

  it('tells an email address and a mobile number from half of one', () => {
    expect(addressOf('kemi.okafor@example.com', 'GB')).toEqual({
      kind: 'email',
      text: 'kemi.okafor@example.com',
    });
    expect(addressOf(' 07700 900123 ', 'GB')).toEqual({ kind: 'mobile', text: '07700 900123' });
    expect(addressOf('+44 7700 900123', 'GB')?.kind).toBe('mobile');
    expect(addressOf('+234 803 123 4567', 'GB')?.kind).toBe('mobile');
    expect(addressOf('kemi.okafor@exa', 'GB')).toBeNull();
    expect(addressOf('0770', 'GB')).toBeNull();
    expect(addressOf('Kofi', 'GB')).toBeNull();
    expect(linkLine({ kind: 'email', text: 'a@b.example' })).toBe(
      'We send them a link by email. Their account is made from it.',
    );
    expect(linkLine({ kind: 'mobile', text: '07700 900123' })).toBe(
      'We send them a link by text. Their account is made from it.',
    );
  });

  it('shows members, someone from outside, or nobody, for what is typed', () => {
    expect(addView('Can view', '', members, onEvent).kind).toBe('members');
    expect(addView('Can view', 'kemi.okafor@example.com', members, onEvent)).toEqual({
      kind: 'outside',
      address: { kind: 'email', text: 'kemi.okafor@example.com' },
    });
    expect(addView('Can view', 'kemi.okafor@exa', members, onEvent)).toEqual({
      kind: 'nobody',
      typed: 'kemi.okafor@exa',
      notAnAddress: true,
    });
    expect(addView('Can view', 'kofi@ire.events', members, onEvent)).toEqual({
      kind: 'members',
      offered: [member('Kofi Mensah')],
    });
    expect(noMatchLine('kemi.okafor@exa')).toBe('Nobody in Ire Events matches “kemi.okafor@exa”.');
  });

  it('takes members only under Lead, and says why an address is not one', () => {
    expect(addView('Lead', 'kemi.okafor@example.com', members, onEvent)).toEqual({
      kind: 'leadAddress',
    });
    expect(addView('Lead', 'kofi@ire.events', members, onEvent).kind).toBe('members');
    expect(addView('Lead', 'nobody here', members, onEvent)).toEqual({
      kind: 'nobody',
      typed: 'nobody here',
      notAnAddress: false,
    });
  });

  it('counts the job label against its limit', () => {
    expect(jobHelp('Bar and drinks'.length)).toBe(
      'What they’re there for, shown beside their name. It grants nothing. 14 of 60.',
    );
  });

  it('adds the ticked members under the role, in their place, and says how many', () => {
    const added = withAdded(onEvent, 'Can view', {
      members: [member('Kofi Mensah'), member('Folake Adeyemi'), member('Julien Moreau')],
      outside: null,
    });

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

  it('adds someone from outside by their address, with their job label', () => {
    const address = { kind: 'email', text: 'dj@sounds.example' } as const;
    const added = withAdded([], 'Can view', { members: [], outside: { address, label: ' DJ ' } });

    expect(added.names).toEqual(['dj@sounds.example']);
    expect(added.onEvent).toEqual([
      {
        id: 'dj@sounds.example',
        name: 'dj@sounds.example',
        initials: 'D',
        tone: 3,
        role: 'Can view',
        outside: true,
        label: 'DJ',
      },
    ]);
    expect(outsiderFor({ kind: 'mobile', text: '07700 900123' }, []).initials).toBeNull();
  });

  it('moves someone from outside already on the event, with the label as typed', () => {
    const address = { kind: 'email', text: 'Kemi.Okafor@example.com' } as const;
    const kemi = outsiderFor(address, onEvent);
    const moved = withAdded(onEvent, 'Can view', {
      members: [],
      outside: { address, label: kemi.label ?? '' },
    });
    const cleared = withAdded(onEvent, 'Can view', {
      members: [],
      outside: { address, label: '' },
    });

    expect(kemi).toBe(on('Kemi Okafor'));
    expect(moved.onEvent.filter((one) => one.id === kemi.id)).toEqual([
      { ...kemi, role: 'Can view' },
    ]);
    expect(moved.onEvent).toHaveLength(onEvent.length);
    expect(moved.names).toEqual(['Kemi Okafor']);
    expect(cleared.onEvent.find((one) => one.id === kemi.id)?.label).toBeNull();
  });
});
