import { describe, expect, it } from 'vitest';

import { ENQUIRIES, PEOPLE, type Person } from './EnquiriesModel.ts';
import { blankFor } from './EnquiryFormModel.ts';
import {
  E,
  budgetCheck,
  countryName,
  counterWords,
  firstRefused,
  guestsCheck,
  lostProblems,
  minorUnits,
  moneyWords,
  noteProblem,
  phoneCheck,
  refusalsOf,
  sameClient,
  savedLine,
} from './EnquiryRules.ts';

const TODAY = '2026-11-18';
const typed = (more: Partial<ReturnType<typeof blankFor>>) => ({
  ...blankFor(PEOPLE.folake),
  name: 'Ama Mensah',
  number: '07700 900456',
  ...more,
});

describe('the phone, as the account checks it', () => {
  it.each(['07700 900456', '+44 7700 900456', '020 7946 0018'])('accepts %s', (number) => {
    expect(typeof phoneCheck(number, 'GB')).toBe('string');
  });

  it('accepts a fixed line, and says nothing of mobiles', () => {
    expect(refusalsOf(typed({ number: '020 7946 0018' }), TODAY)).toEqual({});
  });

  it('refuses a number that is not one, naming the country', () => {
    expect(refusalsOf(typed({ number: '04000 000000' }), TODAY).phone).toBe(
      'That is not a phone number for the United Kingdom. Check it and try again.',
    );
  });

  it('says a number is too short', () => {
    expect(refusalsOf(typed({ number: '0770 090' }), TODAY).phone).toBe(
      'That number looks too short for the United Kingdom. Check it and try again.',
    );
  });

  it('says a number is too long', () => {
    expect(refusalsOf(typed({ number: '07700 900456 789' }), TODAY).phone).toBe(
      'That number looks too long for the United Kingdom. Check it and try again.',
    );
  });

  it('names a country without “the” where it takes none', () => {
    expect(countryName('NG')).toBe('Nigeria');
  });
});

describe('what Save checks', () => {
  it('passes a name and a phone', () => {
    expect(refusalsOf(typed({}), TODAY)).toEqual({});
  });

  it('wants a phone or an email, and focus starts at Phone', () => {
    const found = refusalsOf(typed({ number: '' }), TODAY);
    expect(found).toEqual({ contact: E.contact });
    expect(firstRefused(found)).toBe('phone');
  });

  it('takes an email alone', () => {
    expect(refusalsOf(typed({ number: '', email: 'ama@example.com' }), TODAY)).toEqual({});
  });

  it.each([
    [{ name: '  ' }, 'name', E.nameBlank],
    [{ name: 'A'.repeat(101) }, 'name', E.nameLong],
    [{ email: 'ama@' }, 'email', E.email],
    [{ date: '2026-11-17' }, 'date', E.datePassed],
    [{ guests: '0' }, 'guests', E.guests],
    [{ guests: '100001' }, 'guests', E.guests],
    [{ guests: '2.5' }, 'guests', E.guests],
    [{ where: 'W'.repeat(201) }, 'where', E.whereLong],
    [{ mind: 'M'.repeat(5001) }, 'mind', E.noteLong],
    [{ amount: '0' }, 'budget', E.amount],
  ] as const)('refuses %o on %s', (more, field, words) => {
    expect(refusalsOf(typed(more), TODAY)).toEqual({ [field]: words });
  });

  it('keeps a date that has passed when it is the one saved', () => {
    expect(refusalsOf(typed({ date: '2026-11-07' }), TODAY, '2026-11-07')).toEqual({});
  });

  it('focuses the first refusal in the form’s order', () => {
    expect(firstRefused(refusalsOf(typed({ name: '', guests: '0' }), TODAY))).toBe('name');
  });

  it('takes 100,000 guests, written with a comma', () => {
    expect(guestsCheck('100,000')).toBe(100_000);
  });
});

describe('money, in its own currency’s decimals', () => {
  it.each([
    ['JPY', 0],
    ['NGN', 2],
    ['GBP', 2],
    ['EUR', 2],
  ] as const)('%s takes %i', (currency, digits) => {
    expect(minorUnits(currency)).toBe(digits);
  });

  it('refuses decimals the currency does not have', () => {
    expect(budgetCheck('300000.5', 'JPY')).toEqual({ problem: 'JPY takes no decimal places.' });
    expect(budgetCheck('120.555', 'GBP')).toEqual({ problem: 'GBP takes 2 decimal places.' });
  });

  it('sends the amount as typed, without its commas', () => {
    expect(budgetCheck('30,000', 'GBP')).toEqual({ amount: '30000' });
    expect(budgetCheck('2500000.50', 'NGN')).toEqual({ amount: '2500000.50' });
    expect(budgetCheck('300000', 'JPY')).toEqual({ amount: '300000' });
  });

  it('refuses a currency not on the list', () => {
    expect(budgetCheck('100', 'XYZ')).toEqual({ problem: E.currency });
  });

  it('shows the minor unit only when the amount has one', () => {
    expect(moneyWords({ amount: '30000', currency: 'GBP' }, 'en-GB')).toBe('£30,000');
    expect(moneyWords({ amount: '120.5', currency: 'GBP' }, 'en-GB')).toBe('£120.50');
    expect(moneyWords({ amount: '300000', currency: 'JPY' }, 'en-GB')).toBe('JP¥300,000');
  });
});

describe('the same client', () => {
  const by = (more: { number?: string; email?: string }, viewer: Person = PEOPLE.folake) => ({
    phone: sameClient(
      ENQUIRIES,
      'phone',
      { number: '', country: 'GB', email: '', ...more },
      viewer,
    ),
    email: sameClient(
      ENQUIRIES,
      'email',
      { number: '', country: 'GB', email: '', ...more },
      viewer,
    ),
  });

  it.each(['07400 123456', '+44 7400 123456', '0044 7400 123456', '7400123456'])(
    'finds Ada’s Open enquiry from %s',
    (number) => {
      const found = by({ number }).phone;
      expect(found?.seen === true ? found.enquiry.id : null).toBe('enq-ada');
    },
  );

  it('ignores case and outer spaces in an email', () => {
    const found = by({ email: '  ADA@Example.COM ' }).email;
    expect(found?.seen === true ? found.enquiry.id : null).toBe('enq-ada');
  });

  it('does not warn for a Lost enquiry’s email', () => {
    expect(by({ email: 'ada.okafor@example.com' }).email).toBeNull();
  });

  it('tells a Member only that someone else has it', () => {
    expect(by({ number: '07400 123456' }, PEOPLE.tunde).phone).toEqual({
      by: 'phone',
      seen: false,
    });
  });

  it('does not match the enquiry being edited', () => {
    expect(
      sameClient(
        ENQUIRIES,
        'phone',
        { number: '07400 123456', country: 'GB', email: '' },
        PEOPLE.folake,
        'enq-ada',
      ),
    ).toBeNull();
  });

  it('says nothing for a number the account would refuse', () => {
    expect(by({ number: '0740' }).phone).toBeNull();
  });
});

describe('notes and Close as lost', () => {
  it('wants words in a note, at most 5,000', () => {
    expect(noteProblem('   ')).toBe(E.noteBlank);
    expect(noteProblem('x'.repeat(5001))).toBe(E.noteLong);
    expect(noteProblem('x'.repeat(5000))).toBeNull();
  });

  it('wants a reason and keeps the line to 200', () => {
    expect(lostProblems(null, '')).toEqual({ reason: 'Choose why it was lost.' });
    expect(lostProblems('elsewhere', 'L'.repeat(201))).toEqual({
      line: 'Keep it to 200 characters.',
    });
    expect(lostProblems('elsewhere', 'L'.repeat(200))).toEqual({});
  });

  it('saves no line from spaces alone', () => {
    expect(savedLine('    ')).toBeNull();
    expect(savedLine('  Went with the hotel. ')).toBe('Went with the hotel.');
  });

  it('counts near the limit', () => {
    expect(counterWords(4812, 5000)).toBe('4,812 of 5,000');
  });
});
