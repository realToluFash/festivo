import { describe, expect, test } from 'vitest';

import {
  compareGuestNames,
  guestFullName,
  guestInitials,
  startsWithTitle,
  stripTitle,
} from './guestName.ts';

describe('a guest keeps their whole name', () => {
  test('a title the host typed separately joins the name', () => {
    expectEqual(guestFullName({ title: 'Chief', name: 'Adaeze Okonkwo' }), 'Chief Adaeze Okonkwo');
  });

  test('a title already inside the name is not repeated', () => {
    expectEqual(
      guestFullName({ title: 'Chief', name: 'Chief Adaeze Okonkwo' }),
      'Chief Adaeze Okonkwo',
    );
  });

  test('a different title already in the name is still not doubled', () => {
    expectEqual(guestFullName({ title: 'Mr', name: 'Alhaji Musa Bello' }), 'Alhaji Musa Bello');
  });

  test('either half alone is fine', () => {
    expectEqual(guestFullName({ name: 'Adaeze Okonkwo' }), 'Adaeze Okonkwo');
    expectEqual(guestFullName({ title: 'Chief' }), 'Chief');
    expectEqual(guestFullName({}), '');
    expectEqual(guestFullName({ name: null, title: null }), '');
  });
});

describe('titles are recognised, not guessed at', () => {
  for (const name of [
    'Chief Adaeze Okonkwo',
    'Alhaji Musa Bello',
    'Alhaja Fatima Bello',
    'Dr. Ngozi Eze',
    'Prof Wole Soyinka',
    'Chief (Mrs.) Ngozi Eze',
    'Barrister Tunde Bakare',
    'Engr. Chidi Obi',
  ]) {
    test(`"${name}" starts with a title`, () => {
      expectEqual(startsWithTitle(name), true);
    });
  }

  test('an ordinary name does not', () => {
    expectEqual(startsWithTitle('Adaeze Okonkwo'), false);
  });

  /**
   * The bug this whole module exists to prevent: a name whose first token
   * happens to look like a word is not thereby a title.
   */
  test('a name that merely begins with letters is not a title', () => {
    expectEqual(startsWithTitle('Mister Johnson'), false);
    expectEqual(startsWithTitle('Drew Barry'), false);
    expectEqual(startsWithTitle('Prince'), true);
  });
});

describe('initials are the only place a name is broken up', () => {
  test('it skips the title', () => {
    expectEqual(guestInitials({ name: 'Chief Adaeze Okonkwo' }), 'AO');
    expectEqual(guestInitials({ title: 'Dr.', name: 'Ngozi Eze' }), 'NE');
  });

  test('first and last, not first and second', () => {
    expectEqual(guestInitials({ name: 'Ada Ngozi Chinwe Okonkwo' }), 'AO');
  });

  test('a single word gives two letters', () => {
    expectEqual(guestInitials({ name: 'Adaeze' }), 'AD');
  });

  test('nothing gives nothing rather than throwing', () => {
    expectEqual(guestInitials({}), '');
  });
});

describe('sorting shows what the organiser is looking at', () => {
  /**
   * Sorting on a stripped name puts "Chief Adaeze" under A while the screen
   * shows C, and the organiser scanning for it concludes the guest is missing.
   */
  test('it sorts on the name as displayed, title included', () => {
    const guests = [
      { name: 'Chief Adaeze Okonkwo' },
      { name: 'Bola Ahmed' },
      { name: 'Alhaji Musa Bello' },
    ];

    expectEqual(
      [...guests].sort(compareGuestNames).map((g) => g.name),
      ['Alhaji Musa Bello', 'Bola Ahmed', 'Chief Adaeze Okonkwo'],
    );
  });

  test('it ignores case and accent differences', () => {
    expectEqual(compareGuestNames({ name: 'Émile' }, { name: 'emile' }), 0);
  });
});

describe('stripTitle', () => {
  test('removes a leading title', () => {
    expectEqual(stripTitle('Chief Adaeze Okonkwo'), 'Adaeze Okonkwo');
  });

  test('leaves an untitled name alone', () => {
    expectEqual(stripTitle('Adaeze Okonkwo'), 'Adaeze Okonkwo');
  });
});

function expectEqual(actual: unknown, expected: unknown): void {
  expect(actual).toEqual(expected);
}
