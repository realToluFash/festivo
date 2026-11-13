import { describe, expect, it } from 'vitest';

import {
  SEARCH_STATES,
  countOf,
  folded,
  groupsFor,
  keyHint,
  moved,
  saidOf,
  searchStart,
  searchStateOf,
  stopsOf,
} from './search.ts';

const names = (term: string, guests = true) =>
  groupsFor(term, guests).map((group) => [group.key, group.rows.map((row) => row.name)]);

describe('what Search finds in the sample (sc-39534)', () => {
  it('is blind to case and accents', () => {
    expect(folded('Inês')).toBe('ines');
    expect(folded('INÈS')).toBe('ines');
    expect(groupsFor('INÊS', true)).toEqual(groupsFor('ines', true));
  });

  it('sends nothing under 2 characters', () => {
    expect(groupsFor('i', true)).toEqual([]);
    expect(groupsFor(' i ', true)).toEqual([]);
    expect(groupsFor('in', true).length).toBeGreaterThan(0);
  });

  it('finds ines in all three groups, in their order', () => {
    expect(names('ines')).toEqual([
      ['events', ['Rafael & Inês’s wedding']],
      [
        'guests',
        [
          'Inês Duarte',
          'Inês Duarte',
          'Inès Laurent',
          'Inés García',
          'Ines Okafor',
          'Inês Almeida',
          'Agnes Inesi',
        ],
      ],
      ['members', ['Inês Santos']],
    ]);
  });

  it('drops the Guests group, never empties it, for a role without guest access', () => {
    expect(names('ines', false)).toEqual([
      ['events', ['Rafael & Inês’s wedding']],
      ['members', ['Inês Santos']],
    ]);
    expect(names('duarte', false)).toEqual([]);
  });

  it('finds an event by its venue, and leaves out a group with no match', () => {
    expect(names('landmark')).toEqual([['events', ['Adaeze & Tunde’s wedding']]]);
    expect(names('quinta')[0]?.[1]).toHaveLength(4);
    expect(names('garden party')).toEqual([]);
  });

  it('draws a guest on two events as two rows, each naming its event', () => {
    const [guests] = groupsFor('duarte', true);

    expect(guests?.rows.map((row) => row.line)).toEqual([
      'Adaeze & Tunde’s wedding · Thu, Nov 5',
      'Rafael & Inês’s wedding · Sat, Oct 17',
    ]);
  });

  it('matches a member on email and never shows it', () => {
    const [members] = groupsFor('ire-events.com', true);

    expect(members?.rows.map((row) => [row.name, row.line])).toEqual([
      ['Folake Adeyemi', 'Owner'],
      ['Inês Santos', 'Admin'],
      ['Julien Moreau', 'Admin'],
      ['Kemi Adebayo', 'Member'],
    ]);
    expect(members?.rows.some((row) => row.line.includes('@'))).toBe(false);
  });

  it('shows 5 of a group then Show all, and the whole group once opened', () => {
    const groups = groupsFor('ines', true);
    const closed = stopsOf(groups, []);
    const open = stopsOf(groups, ['guests']);

    expect(closed.filter((stop) => stop.group === 'guests')).toHaveLength(6);
    expect(closed.find((stop) => stop.kind === 'more')).toEqual({ kind: 'more', group: 'guests' });
    expect(open.filter((stop) => stop.group === 'guests')).toHaveLength(7);
    expect(open.some((stop) => stop.kind === 'more')).toBe(false);
  });

  it('counts the matches for the screen reader', () => {
    expect(countOf(groupsFor('ines', true))).toBe(9);
    expect(saidOf('ines', groupsFor('ines', true))).toBe('9 matches');
    expect(saidOf('landmark', groupsFor('landmark', true))).toBe('1 match');
    expect(saidOf('garden party', [])).toBe('Nothing matches “garden party”');
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
      'all',
      'one',
      'none',
      'no-guests',
      'two-events',
      'long',
      'offline',
    ]);
    expect(searchStart('idle')).toMatchObject({ term: '', phase: 'idle' });
    expect(searchStart('short')).toMatchObject({ term: 'i', phase: 'short' });
    expect(searchStart('loading')).toMatchObject({ term: 'ine', phase: 'loading' });
    expect(searchStart('all')).toMatchObject({ phase: 'found', opened: ['guests'] });
    expect(searchStart('no-guests').guests).toBe(false);
    expect(searchStart('offline')).toMatchObject({ term: 'ines', phase: 'offline' });
    expect(searchStateOf('nope')).toBeNull();
  });
});
