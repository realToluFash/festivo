import { describe, expect, it } from 'vitest';

import { TO_FIGURES } from '../messages/MessagesSample.ts';
import { SAMPLE_GUESTS } from '../events/GuestCounts.ts';
import {
  DOOR_STATES,
  FILTERS,
  GUESTS_STATES,
  areaStart,
  cardWords,
  clockOf,
  countsFrom,
  countsOf,
  doorMatches,
  doorPeople,
  doorShown,
  emailCheck,
  eventOf,
  filterCount,
  groupRows,
  guestOf,
  markedInvited,
  nameProblem,
  onAnEventDay,
  phoneCheck,
  planRoom,
  recorded,
  replyLine,
  reviewProblems,
  roleOf,
  rowsOf,
  sameNameAs,
} from './GuestsModel.ts';
import { GUESTS, PLAN_SAMPLES } from './GuestsSample.ts';

const EN = 'en-US';
const byKey = (key: string) => {
  const g = GUESTS.find((one) => one.key === key);
  if (g == null) throw new Error(key);
  return g;
};

describe('the states, as guests-a-spec §15 names them', () => {
  it('names each once, the door apart', () => {
    expect(new Set(GUESTS_STATES).size).toBe(GUESTS_STATES.length);
    expect(
      GUESTS_STATES.filter((state) => (DOOR_STATES as readonly string[]).includes(state)),
    ).toEqual([]);
    expect(GUESTS_STATES).toHaveLength(77);
    expect(DOOR_STATES).toHaveLength(13);
  });

  it('opens each guest state on the guest the boards draw', () => {
    expect(guestOf('guest')).toBe('emeka');
    expect(guestOf('guestComing')).toBe('kwame');
    expect(guestOf('notYetInvited')).toBe('bisi');
    expect(guestOf('recordReplace')).toBe('ngozi');
    expect(guestOf('editMax')).toBe('musa');
    expect(guestOf('edit412')).toBe('kwame');
    expect(guestOf('inUse')).toBeNull();
  });

  it('starts each group with its screen open', () => {
    expect(areaStart('edit412').overlay).toBe('edit');
    expect(areaStart('recordComing').overlay).toBe('record');
    expect(areaStart('addOffline').overlay).toBe('add');
    expect(areaStart('picker').overlay).toBe('picker');
    expect(areaStart('androidPick').overlay).toBe('android');
    expect(areaStart('over250').overlay).toBe('review');
    expect(areaStart('replaceAsk').overlay).toBe('replace');
    expect(areaStart('markRefused').overlay).toBe('mark');
    expect(areaStart('filterNone')).toMatchObject({ filter: 'held', typed: 'marta' });
    expect(areaStart('contactsAdded')).toMatchObject({ added: 23, toast: 'manyAdded' });
  });

  it('reads as door staff or Can view only where the spec says', () => {
    expect(roleOf('staffBefore')).toBe('staff');
    expect(roleOf('staffDoorOpen')).toBe('staff');
    expect(roleOf('guestViewer')).toBe('viewer');
    expect(roleOf('inUse')).toBe('owner');
  });

  it('opens a Draft, a Paused event and the plan limit on their own events', () => {
    expect(eventOf('draft')).toBe('evt-draft-4');
    expect(eventOf('paused')).toBe('evt-party-2');
    expect(eventOf('overLimit')).toBe('evt-ireti-2');
    expect(eventOf('inUse')).toBe('evt-wed-4');
  });
});

describe('the counts (sc-99), as Messaging B and Events count the wedding', () => {
  const counts = countsOf(GUESTS);

  it('adds the five replies up to Invited, and Not yet invited to All', () => {
    expect(counts).toMatchObject({
      list: 156,
      invited: 142,
      coming: 96,
      maybe: 10,
      noreply: 21,
      held: 6,
      notcoming: 9,
      notyet: 14,
    });
    expect(counts.coming + counts.maybe + counts.noreply + counts.held + counts.notcoming).toBe(
      counts.invited,
    );
    expect(FILTERS.map((key) => filterCount(key, counts))).toEqual([
      156, 142, 96, 10, 21, 6, 9, 14,
    ]);
  });

  it('says 25 haven’t replied, as Messaging and Events do', () => {
    expect(counts.havent).toBe(25);
    expect(counts.havent).toBe(TO_FIGURES.notReplied.count);
    expect(SAMPLE_GUESTS['evt-wed-4']).toEqual({ invited: 142, coming: 96, replied: 117 });
  });

  it('moves the counts when a reply is recorded, the companion with it', () => {
    const after = GUESTS.map((g) =>
      g.key === 'emeka' ? recorded(g, 'coming', 'By phone', [true], '2026-11-03') : g,
    );
    expect(countsOf(after)).toMatchObject({
      invited: 142,
      coming: 98,
      noreply: 20,
      held: 5,
      havent: 23,
    });
  });

  it('counts a guest marked as invited as No reply, and 23 from contacts as Not yet invited', () => {
    const after = GUESTS.map((g) =>
      g.key === 'bisi' ? markedInvited(g, 'WhatsApp', '2026-11-03') : g,
    );
    expect(countsOf(after)).toMatchObject({ list: 156, invited: 143, noreply: 22, notyet: 13 });
    expect(countsOf(GUESTS, 23)).toMatchObject({ list: 179, notyet: 37 });
  });
});

describe('a list that starts empty', () => {
  it('counts only who was added to it', () => {
    expect(countsFrom([])).toMatchObject({ list: 0, invited: 0, havent: 0 });
    expect(countsFrom([byKey('bisi')])).toMatchObject({ list: 1, notyet: 1, invited: 0 });
    expect(countsFrom([byKey('emeka')])).toMatchObject({
      invited: 2,
      noreply: 1,
      held: 1,
      havent: 2,
    });
  });
});

describe('the list: groups, the filter and search (sc-3772)', () => {
  it('words each row in the guest’s own words', () => {
    expect(replyLine(byKey('kwame'), EN)).toBe('Coming · replied Oct 2');
    expect(replyLine(byKey('lucia'), EN)).toBe('Not sure yet · asked to decide by Nov 4');
    expect(replyLine(byKey('emeka'), EN)).toBe(
      'No reply · invited by Folake Adeyemi, WhatsApp, Oct 9',
    );
    expect(replyLine(byKey('bisi'), EN)).toBe('Not yet invited');
  });

  it('puts a companion under their host, in the host’s group', () => {
    const coming = groupRows(GUESTS, 'coming', EN);
    expect(coming.map((row) => row.name)).toEqual([
      'Alhaji Musa Bello',
      'Guest of Alhaji Musa Bello',
      'Amaka Eze',
      'Inês Duarte',
      'Rui Duarte',
    ]);
    expect(coming[0]?.line).toBe('Coming · replied Oct 14 · 1 companion');
    expect(groupRows(GUESTS, 'maybe', EN)[1]?.line).toBe('Held · comes only if their host accepts');
  });

  it('filters No reply to the guests, each saying how they were invited', () => {
    const rows = rowsOf(GUESTS, 'noreply', '', EN);
    expect(rows.map((row) => row.name)).toEqual([
      'Dr Emeka Nwosu',
      'Joaquín Ruiz',
      'Nadia Haddad',
      'Oluwaseun Ajayi',
      'Tomás Ferreira',
    ]);
    expect(rows[0]?.line).toBe('Invited by Folake Adeyemi, WhatsApp, Oct 9');
    expect(rowsOf(GUESTS, 'held', '', EN).map((row) => row.name)).toEqual([
      'Guest of Chief Mrs Folasade Okonkwo-Williams',
      'Adanna Nwosu',
    ]);
  });

  it('finds by name, email address or number, and nobody for kofi or Held and marta', () => {
    expect(rowsOf(GUESTS, 'all', 'okon', EN)).toHaveLength(2);
    expect(rowsOf(GUESTS, 'all', 'kofi', EN)).toHaveLength(0);
    expect(rowsOf(GUESTS, 'held', 'marta', EN)).toHaveLength(0);
    expect(rowsOf(GUESTS, 'all', 'nhs.net', EN).map((row) => row.name)).toEqual([
      'Dr Emeka Nwosu',
      'Adanna Nwosu',
    ]);
    expect(rowsOf(GUESTS, 'all', '900412', EN).map((row) => row.name)).toEqual(['Kwame Mensah']);
  });
});

describe('the card, per state (spec §4)', () => {
  const counts = countsOf(GUESTS);

  it('says how the room stands, and who hasn’t replied in words', () => {
    expect(cardWords('inUse', 'owner', counts, false)).toMatchObject({
      says: '96 coming of 142 invited',
      line: '25 haven’t replied (21 guests and 4 of their companions). Replies close tomorrow, Wed, Nov 4.',
      step: 'write',
    });
    expect(cardWords('viewer', 'viewer', counts, false).step).toBeNull();
    expect(cardWords('first', 'owner', counts, true)).toMatchObject({
      says: 'No guests yet',
      step: 'addGuest',
    });
  });

  it('counts arrivals on the day, with Open check-in all day', () => {
    expect(cardWords('onTheDay', 'owner', counts, false)).toMatchObject({
      count: { arrived: 41, expected: 98 },
      step: 'openCheckIn',
    });
    expect(cardWords('secondDay', 'owner', counts, false).line).toBe(
      '96 coming of 142 invited. Check-in is open all day.',
    );
    expect(cardWords('staffDayBefore', 'staff', counts, false)).toMatchObject({
      says: 'Check-in opens at 16:00',
      step: 'openCheckIn',
    });
    expect(cardWords('staffDoorOpen', 'staff', counts, false).count).toEqual({
      arrived: 3,
      expected: 98,
    });
    expect(cardWords('staffBefore', 'staff', counts, false).step).toBeNull();
  });

  it('knows each of the event’s three days from 05:00, and no other', () => {
    const [start, end] = ['2026-11-05T18:00:00Z', '2026-11-07T15:00:00Z'];
    expect(onAnEventDay(clockOf('staffDayBefore'), start, end)).toBe(true);
    expect(onAnEventDay(clockOf('secondDay'), start, end)).toBe(true);
    expect(onAnEventDay(new Date('2026-11-05T04:30:00Z'), start, end)).toBe(false);
    expect(onAnEventDay(clockOf('inUse'), start, end)).toBe(false);
  });
});

describe('the forms check before they send', () => {
  it('in main’s words', () => {
    expect(nameProblem('  ')).toBe('Enter their full name.');
    expect(nameProblem('x'.repeat(201))).toBe('Shorten the name to 200 characters or fewer.');
    expect(emailCheck('kwame.mensah@outlook')).toBe(
      'That does not look like an email address. Check it has an @ and a domain.',
    );
    expect(emailCheck('')).toBeNull();
    expect(phoneCheck('7700 90', 'GB')).toBe(
      'That number looks too short for United Kingdom. Check it and try again.',
    );
    expect(phoneCheck('', 'GB')).toBeNull();
  });

  it('says when the name is already on the list, never itself', () => {
    expect(sameNameAs(GUESTS, 'marta silva', 'kwame')?.name).toBe('Marta Silva');
    expect(sameNameAs(GUESTS, 'Kwame Mensah', 'kwame')).toBeNull();
  });
});

describe('From contacts and the plan limit (sc-7579, sc-3930)', () => {
  it('counts what to fix and what is already on the list', () => {
    const row = {
      key: 'a',
      name: 'A',
      country: 'GB',
      number: '0151 23',
      saved: null,
      unreadable: true,
      listed: false,
      numberAt: 0,
      places: 0,
    };
    expect(reviewProblems([row, { ...row, unreadable: false, listed: true }])).toEqual({
      fix: 1,
      listed: 1,
    });
    expect(reviewProblems([{ ...row, number: '' }])).toEqual({ fix: 0, listed: 0 });
  });

  it('says the room left from 80%, and refuses past 100', () => {
    const near = PLAN_SAMPLES.roomLeft;
    expect(planRoom(near.listed, near.picked)).toEqual({ after: 94, room: 6, over: false });
    const over = PLAN_SAMPLES.overLimit;
    expect(planRoom(over.listed, over.picked + over.places)).toEqual({
      after: 106,
      room: -6,
      over: true,
    });
    expect(planRoom(40, 10)).toBeNull();
  });
});

describe('the door (sc-1454)', () => {
  it('matches word starts in any order', () => {
    expect(doorMatches('Chief Mrs Folasade Okonkwo-Williams', 'okon fola')).toBe(true);
    expect(doorMatches('Chief Mrs Folasade Okonkwo-Williams', 'fola okon')).toBe(true);
    expect(doorMatches('Kwame Mensah', 'ensah')).toBe(false);
  });

  it('keeps a companion with their host, and finds nobody for a walk-in', () => {
    const people = doorPeople();
    expect(doorShown(people, 'okon fola').map((p) => p.name)).toEqual([
      'Chief Mrs Folasade Okonkwo-Williams',
      'Guest of Chief Mrs Folasade Okonkwo-Williams',
    ]);
    expect(doorShown(people, 'Kofi Asante')).toEqual([]);
    expect(people.find((p) => p.key === 'musa')).toMatchObject({
      arrivedAt: '18:12',
      by: 'Ana Souza',
    });
  });
});
