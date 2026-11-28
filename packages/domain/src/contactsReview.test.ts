import { describe, expect, it } from 'vitest';

import {
  MOST_PICKED,
  contactsBody,
  peopleIn,
  planRoom,
  reviewCounts,
  reviewRowsOf,
  rowProblems,
  savedAs,
} from './contactsReview.ts';

const ADAEZE = {
  name: 'Chief Mrs Adaeze Okonkwo',
  numbers: [
    { number: '01 234 5678', label: 'home', mobile: false },
    { number: '0803 123 4567', label: 'mobile', mobile: true },
  ],
  email: 'adaeze@example.com',
};

describe('the review list from a pick', () => {
  it('keeps the name whole, chooses the mobile number and reads a local one for the organisation', () => {
    const [row] = reviewRowsOf([ADAEZE], 'NG').rows;

    expect(row).toMatchObject({ name: 'Chief Mrs Adaeze Okonkwo', numberAt: 1, country: 'NG' });
    expect(row != null && savedAs(row)).toBe('+234 803 123 4567');
  });

  it('takes the first number when none is labelled mobile, and a number with its own code for its country', () => {
    const [row] = reviewRowsOf(
      [
        {
          name: 'Lucas Moreau',
          numbers: [{ number: '+33 6 12 34 56 78', label: 'work', mobile: false }],
          email: null,
        },
      ],
      'NG',
    ).rows;

    expect(row).toMatchObject({ numberAt: 0, country: 'FR' });
  });

  it('keeps the first 250 and says how many were picked', () => {
    const many = Array.from({ length: 312 }, (_, at) => ({
      name: `Person ${at}`,
      numbers: [],
      email: null,
    }));
    const { rows, picked } = reviewRowsOf(many, 'NG');

    expect(rows).toHaveLength(MOST_PICKED);
    expect(picked).toBe(312);
  });

  it('flags a name missing or too long and a number that cannot be read, and lets a row with a name alone through', () => {
    const { rows } = reviewRowsOf(
      [
        { name: ' ', numbers: [], email: null },
        { name: 'x'.repeat(201), numbers: [], email: null },
        {
          name: 'Kofi Mensah',
          numbers: [{ number: '12', label: 'mobile', mobile: true }],
          email: null,
        },
        { name: 'Ama Owusu', numbers: [], email: null },
      ],
      'NG',
    );

    expect(rows.map((row) => rowProblems(row, rows, []))).toEqual([
      { name: 'blank', number: false, listed: false },
      { name: 'tooLong', number: false, listed: false },
      { name: null, number: true, listed: false },
      { name: null, number: false, listed: false },
    ]);
    expect(reviewCounts(rows, []).fix).toBe(3);
  });

  it('warns on a name already on the list or twice in the pick, whatever its case or accents', () => {
    const { rows } = reviewRowsOf(
      [
        { name: 'Marta Silva', numbers: [], email: null },
        { name: 'José Ramos', numbers: [], email: null },
        { name: 'jose ramos', numbers: [], email: null },
      ],
      'NG',
    );

    expect(reviewCounts(rows, ['MARTA SILVA'])).toEqual({ fix: 0, listed: 3 });
  });

  it('sends each row with its companions, and no email that is not one', () => {
    const { rows } = reviewRowsOf(
      [ADAEZE, { name: 'Ama Owusu', numbers: [], email: 'ama@' }],
      'NG',
    );
    const placed = rows.map((row, at) => ({ ...row, places: at === 0 ? 2 : 0 }));

    expect(contactsBody(placed)).toEqual([
      {
        fullName: 'Chief Mrs Adaeze Okonkwo',
        email: 'adaeze@example.com',
        mobile: { countryCode: 'NG', number: '0803 123 4567' },
        companions: 2,
      },
      { fullName: 'Ama Owusu', email: null, mobile: null, companions: 0 },
    ]);
    expect(peopleIn(placed)).toBe(4);
  });
});

describe('the plan room on the review list', () => {
  it('says nothing below 80%, the room left from it, and over past the limit', () => {
    expect(planRoom({ allowed: 100, people: 50 }, 29)).toBeNull();
    expect(planRoom({ allowed: 100, people: 50 }, 30)).toEqual({
      after: 80,
      room: 20,
      over: false,
      allowed: 100,
    });
    expect(planRoom({ allowed: 100, people: 80 }, 20)).toMatchObject({ room: 0, over: false });
    expect(planRoom({ allowed: 100, people: 80 }, 26)).toMatchObject({ after: 106, over: true });
    expect(planRoom({ allowed: null, people: 9000 }, 250)).toBeNull();
  });
});
