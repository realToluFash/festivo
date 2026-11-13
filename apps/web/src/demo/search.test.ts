import { describe, expect, it } from 'vitest';

import {
  REACHES,
  type Reach,
  SEARCH_STATES,
  SEARCH_WORDS,
  countOf,
  folded,
  groupsFor,
  keyHint,
  moved,
  reachOfRole,
  saidOf,
  searchStart,
  searchStateOf,
  stopsOf,
} from './search.ts';

const names = (term: string, reach: Reach = REACHES.owner) =>
  groupsFor(term, reach).map((group) => [group.key, group.rows.map((row) => row.name)]);

describe('what Search finds in the sample (sc-39534)', () => {
  it('is blind to case and accents', () => {
    expect(folded('Inês')).toBe('ines');
    expect(folded('INÈS')).toBe('ines');
    expect(groupsFor('INÊS', REACHES.owner)).toEqual(groupsFor('ines', REACHES.owner));
  });

  it('sends nothing under 2 characters', () => {
    expect(groupsFor('i', REACHES.owner)).toEqual([]);
    expect(groupsFor(' i ', REACHES.owner)).toEqual([]);
    expect(groupsFor('in', REACHES.owner).length).toBeGreaterThan(0);
  });

  it('finds ines in all three groups, names that begin with it first, each part alphabetical', () => {
    expect(names('ines')).toEqual([
      ['events', ['Rafael & Inês’s wedding']],
      [
        'guests',
        [
          'Inês Almeida',
          'Inês Duarte',
          'Inês Duarte',
          'Inés García',
          'Inès Laurent',
          'Ines Okafor',
          'Agnes Inesi',
        ],
      ],
      ['members', ['Inês Rocha', 'Inês Santos', 'Inês Santos', 'ines.moura@gmail.com']],
    ]);
  });

  it('gives a Member events and guests, and no Members heading', () => {
    expect(names('ines', REACHES.member).map(([key]) => key)).toEqual(['events', 'guests']);
    expect(names('ire-events.com', REACHES.member)).toEqual([]);
  });

  it('drops the Guests heading, never empties it, for a role without guests.read', () => {
    expect(names('ines', REACHES.planner).map(([key]) => key)).toEqual(['events', 'members']);
    expect(names('duarte', REACHES.planner)).toEqual([]);
  });

  it('matches Awaiting approval only for a person with members.manage', () => {
    expect(names('rocha', REACHES.owner)).toEqual([['members', ['Inês Rocha']]]);
    expect(names('rocha', REACHES.planner)).toEqual([]);
  });

  it('finds nothing for a role that can find nothing', () => {
    expect(names('ines', REACHES.nobody)).toEqual([]);
  });

  it('finds an event by its venue, and leaves out a heading with no match', () => {
    expect(names('landmark')).toEqual([['events', ['Adaeze & Tunde’s wedding']]]);
    expect(names('quinta')[0]?.[1]).toEqual([
      'Quintas de fado no jardim',
      'Ana’s graduation lunch',
      'Casamento de Maria Eduarda Albuquerque e João Pedro Vasconcelos',
      'Rafael & Inês’s wedding',
      'Team offsite',
      'Vindima weekend',
    ]);
    expect(names('garden party')).toEqual([]);
  });

  it('draws a guest on two events as two rows, each naming its event', () => {
    const [guests] = groupsFor('duarte', REACHES.owner);

    expect(guests?.rows.map((row) => row.line)).toEqual([
      'Rafael & Inês’s wedding · Sat, Oct 17',
      'Adaeze & Tunde’s wedding · Thu, Nov 5',
    ]);
  });

  it('shows a member’s email and role, the standing when not Active, and an invitation by its email once', () => {
    const members = groupsFor('ines', REACHES.owner).find((group) => group.key === 'members');

    expect(
      members?.rows.map((row) => [row.name, row.line, row.kind === 'member' && row.standing]),
    ).toEqual([
      ['Inês Rocha', 'ines.rocha@outlook.com · Member', 'Awaiting approval'],
      ['Inês Santos', 'ines.s@gmail.com · Member', 'Suspended'],
      ['Inês Santos', 'ines.santos@ire-events.com · Admin', null],
      ['ines.moura@gmail.com', 'Member', 'Invited'],
    ]);
  });

  it('shows the same row for a member found by email as by name', () => {
    const byName = groupsFor('folake', REACHES.owner)[0]?.rows;
    const byEmail = groupsFor('folake@', REACHES.owner)[0]?.rows;

    expect(byEmail).toEqual(byName);
  });

  it('shows 5 under a heading, and Show all in Events only under Events', () => {
    const guests = stopsOf(groupsFor('ines', REACHES.owner));
    const events = stopsOf(groupsFor('quinta', REACHES.owner));

    expect(guests.filter((stop) => stop.group === 'guests')).toHaveLength(5);
    expect(guests.some((stop) => stop.kind === 'more')).toBe(false);
    expect(events.filter((stop) => stop.kind === 'row')).toHaveLength(5);
    expect(events.at(-1)).toEqual({ kind: 'more', group: 'events' });
  });

  it('counts the matches for the screen reader', () => {
    expect(countOf(groupsFor('ines', REACHES.owner))).toBe(12);
    expect(saidOf('ines', groupsFor('ines', REACHES.owner))).toBe('12 matches');
    expect(saidOf('landmark', groupsFor('landmark', REACHES.owner))).toBe('1 match');
    expect(saidOf('garden party', [])).toBe('Nothing matches “garden party”.');
  });
});

describe('what the field says', () => {
  it('names only what the person can find, a whole sentence for each', () => {
    expect([SEARCH_WORDS.placeholder(REACHES.owner), SEARCH_WORDS.idle(REACHES.owner)]).toEqual([
      'Search events, guests and members',
      'Find an event, a guest or a member.',
    ]);
    expect([SEARCH_WORDS.placeholder(REACHES.member), SEARCH_WORDS.idle(REACHES.member)]).toEqual([
      'Search events and guests',
      'Find an event or a guest.',
    ]);
    expect(SEARCH_WORDS.placeholder(REACHES.planner)).toBe('Search events and members');
    expect(
      SEARCH_WORDS.placeholder({ events: false, guests: false, members: true, manage: false }),
    ).toBe('Search members');
  });

  it('is "Search" with no hint for a person who can find nothing', () => {
    expect(SEARCH_WORDS.placeholder(REACHES.nobody)).toBe('Search');
    expect(SEARCH_WORDS.idle(REACHES.nobody)).toBeNull();
  });

  it('takes Owner and Admin to all three, and a Member to events and guests', () => {
    expect(reachOfRole('Owner')).toBe(REACHES.owner);
    expect(reachOfRole('Admin')).toBe(REACHES.owner);
    expect(reachOfRole('Member')).toBe(REACHES.member);
  });
});

describe('moving through the results', () => {
  it('stops at either end and jumps with Home and End', () => {
    expect(moved(0, 'ArrowUp', 4)).toBe(0);
    expect(moved(3, 'ArrowDown', 4)).toBe(3);
    expect(moved(1, 'ArrowDown', 4)).toBe(2);
    expect(moved(2, 'Home', 4)).toBe(0);
    expect(moved(0, 'End', 4)).toBe(3);
    expect(moved(0, 'Enter', 4)).toBeNull();
    expect(moved(0, 'ArrowDown', 0)).toBeNull();
  });
});

describe('the key hint', () => {
  it('reads ⌘K on Apple devices and Ctrl K elsewhere', () => {
    expect(keyHint('MacIntel')).toBe('⌘K');
    expect(keyHint('macOS')).toBe('⌘K');
    expect(keyHint('iPad')).toBe('⌘K');
    expect(keyHint('Win32')).toBe('Ctrl K');
    expect(keyHint('Linux x86_64')).toBe('Ctrl K');
    expect(keyHint(undefined)).toBe('Ctrl K');
  });
});

describe('the demo’s states', () => {
  it('opens each at its term and phase', () => {
    expect(SEARCH_STATES.map((state) => state.key)).toEqual([
      'idle',
      'short',
      'loading',
      'mixed',
      'one',
      'none',
      'member',
      'no-guests',
      'nothing-to-find',
      'two-events',
      'long',
      'offline',
    ]);
    expect(searchStart('idle')).toMatchObject({ term: '', phase: 'idle' });
    expect(searchStart('short')).toMatchObject({ term: 'i', phase: 'short' });
    expect(searchStart('loading')).toMatchObject({ term: 'ine', phase: 'loading' });
    expect(searchStart('member').reach).toBe(REACHES.member);
    expect(searchStart('no-guests').reach).toBe(REACHES.planner);
    expect(searchStart('nothing-to-find').reach).toBe(REACHES.nobody);
    expect(searchStart(null, REACHES.member).reach).toBe(REACHES.member);
    expect(searchStart('offline')).toMatchObject({ term: 'ines', phase: 'offline' });
    expect(searchStateOf('nope')).toBeNull();
  });
});
