import { describe, expect, it } from 'vitest';

import { ENQUIRIES, PEOPLE } from './enquiries.ts';
import {
  amountOf,
  amountProblem,
  blankTyped,
  dateProblem,
  duplicateOf,
  duplicateSaid,
  firstFailing,
  formStart,
  guestsProblem,
  minorUnits,
  nameProblem,
  phoneOfTyped,
  phoneProblem,
  problemsOf,
  savedEnquiry,
  whereProblem,
} from './enquiryForm.ts';
import { lostLineProblem, lostOf, pageStart } from './enquiryPage.ts';

const typed = { ...blankTyped(PEOPLE.folake), client: 'Ama Mensah' };

describe('A new enquiry’s rules (sc-31226)', () => {
  it('asks for a name and keeps it to 100 characters', () => {
    expect(nameProblem('  ')).toBe('Enter the client’s name.');
    expect(nameProblem('A'.repeat(100))).toBeNull();
    expect(nameProblem('A'.repeat(101))).toBe('Keep the name to 100 characters.');
  });

  it('accepts a fixed line as it accepts a mobile', () => {
    expect(phoneProblem('020 7946 0018', 'GB')).toBeNull();
    expect(phoneOfTyped('020 7946 0018', 'GB')).toBe('+442079460018');
    expect(phoneProblem('07700 900456', 'GB')).toBeNull();
  });

  it('refuses a number that is not one with the new words, which never say mobile', () => {
    expect(phoneProblem('07400 12345O', 'GB')).toBe(
      'That is not a phone number for the United Kingdom. Check it and try again.',
    );
  });

  it('keeps the account’s words for a number too short or too long', () => {
    expect(phoneProblem('0770 090', 'GB')).toBe(
      'That number looks too short for the United Kingdom. Check it and try again.',
    );
    expect(phoneProblem('07700 900456 789', 'GB')).toBe(
      'That number looks too long for the United Kingdom. Check it and try again.',
    );
  });

  it('needs a phone or an email, and puts focus on Phone when neither is given', () => {
    const problems = problemsOf(typed);

    expect(problems.contact).toBe('Add a phone or an email, so you can reach the client.');
    expect(firstFailing(problems)).toBe('contact');
    expect(problemsOf({ ...typed, email: 'ama@example.com' })).toEqual({});
  });

  it('refuses an email without its domain', () => {
    expect(problemsOf({ ...typed, email: 'ama@' }).email).toBe(
      'That does not look like an email address. Check it has an @ and a domain.',
    );
  });

  it('refuses a date that has passed only when it is set or changed', () => {
    expect(dateProblem('2026-11-10', null, '2026-11-18')).toBe('The date has passed.');
    expect(dateProblem('2026-11-18', null, '2026-11-18')).toBeNull();
    expect(dateProblem('2026-11-07', '2026-11-07', '2026-11-18')).toBeNull();
  });

  it('takes guests as a whole number from 1 to 100,000', () => {
    expect(guestsProblem('0')).toBe('Enter a whole number from 1 to 100,000.');
    expect(guestsProblem('12.5')).not.toBeNull();
    expect(guestsProblem('1,200')).toBeNull();
    expect(guestsProblem('100001')).not.toBeNull();
  });

  it('keeps Where to 200 characters', () => {
    expect(whereProblem('W'.repeat(200))).toBeNull();
    expect(whereProblem('W'.repeat(201))).toBe('Keep it to 200 characters.');
  });

  it('takes a budget in its currency’s ISO 4217 decimals', () => {
    expect(minorUnits('JPY')).toBe(0);
    expect(minorUnits('NGN')).toBe(2);
    expect(minorUnits('GBP')).toBe(2);
    expect(minorUnits('EUR')).toBe(2);
    expect(amountProblem('120.555', 'GBP')).toEqual({ amount: 'GBP takes 2 decimal places.' });
    expect(amountProblem('1500.5', 'JPY')).toEqual({ amount: 'JPY takes no decimal places.' });
    expect(amountProblem('0', 'GBP')).toEqual({ amount: 'Enter an amount above 0.' });
    expect(amountProblem('10', 'XYZ')).toEqual({ currency: 'Choose a currency from the list.' });
    expect(amountOf('30,000', 'NGN')).toBe('30000');
    expect(amountOf('120.50', 'EUR')).toBe('120.50');
  });
});

describe('The same client, warned before saving (sc-31226)', () => {
  it('matches a phone however it is typed, in the organisation’s country', () => {
    for (const phone of ['07400 123456', '+44 7400 123456', '0044 7400 123456'])
      expect(duplicateOf(ENQUIRIES, 'phone', { ...typed, phone })?.id).toBe('enq-ada');
  });

  it('matches an email whatever its case and spaces, on Open enquiries only', () => {
    expect(duplicateOf(ENQUIRIES, 'email', { ...typed, email: '  ADA@Example.com ' })?.id).toBe(
      'enq-ada',
    );
    expect(
      duplicateOf(ENQUIRIES, 'email', { ...typed, email: 'ada.okafor@example.com' }),
    ).toBeNull();
  });

  it('names who has it for an Owner, and nobody for a Member who cannot see it', () => {
    const ada = ENQUIRIES.find((one) => one.id === 'enq-ada')!;

    expect(duplicateSaid(ada, 'phone', PEOPLE.folake)).toEqual({
      line: 'There’s already an open enquiry from this number: Ada Okafor, assigned to Folake Adeyemi',
      to: '/demo/enquiries/enq-ada',
    });
    expect(duplicateSaid(ada, 'phone', PEOPLE.tunde).to).toBeNull();
  });
});

describe('New enquiry’s states (sc-31226)', () => {
  it('saves a fixed line', () => {
    const start = formStart('fixedLine');

    expect(problemsOf(start.typed)).toEqual({});
    expect(savedEnquiry(start.typed, start.viewer, null, 'enq-new').phone).toBe('+442079460018');
  });

  it('starts too short and too long already pressed, with the account’s words', () => {
    expect(problemsOf(formStart('phoneTooShort').typed).phone).toMatch(/too short/u);
    expect(problemsOf(formStart('phoneTooLong').typed).phone).toMatch(/too long/u);
    expect(formStart('phoneTooShort').pressed).toBe(true);
    expect(formStart('phoneTooLong').pressed).toBe(true);
  });
});

describe('Close as lost’s line (sc-31226)', () => {
  it('takes up to 200 characters', () => {
    expect(lostLineProblem('L'.repeat(200))).toBe(false);
    expect(lostLineProblem('L'.repeat(201))).toBe(true);
  });

  it('saves no line for a line of only spaces', () => {
    expect(lostOf('elsewhere', '    ')).toEqual({ reason: 'elsewhere', line: null });
    expect(lostOf('budget', ' Went cheaper. ')).toEqual({
      reason: 'budget',
      line: 'Went cheaper.',
    });
  });

  it('opens closeAsLostTooLong with Chose someone else and 201 characters typed', () => {
    expect(pageStart('closeAsLostTooLong').lostTyped).toEqual({
      reason: 'elsewhere',
      line: 'L'.repeat(201),
      pressed: true,
    });
  });
});
