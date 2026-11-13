import { describe, expect, it } from 'vitest';

import type { Contact } from '../../kit/accountPage.ts';
import { changeEmail, lifted, UNDELIVERABLE_WORDS, undeliverable } from './Undeliverable.ts';

const primary: Contact = {
  id: 'email-1',
  shown: 'folake@ire.events',
  verified: true,
  primary: true,
};
const other: Contact = {
  id: 'email-2',
  shown: 'folake.adeyemi@gmail.com',
  verified: false,
  primary: false,
};

describe('the lines', () => {
  it('names each address Soirely stopped sending to, the primary first', () => {
    expect(undeliverable([other, primary], ['email-2', 'email-1'])).toEqual([primary, other]);
  });

  it('shows nothing for an account with no suppressed address, or one no longer listed', () => {
    expect(undeliverable([primary, other], [])).toEqual([]);
    expect(undeliverable([primary], ['email-2'])).toEqual([]);
  });

  it('puts the address in the words as Your account lists it', () => {
    expect(UNDELIVERABLE_WORDS.line(other.shown)).toBe(
      'We couldn’t deliver email to folake.adeyemi@gmail.com.',
    );
  });
});

describe('Change email', () => {
  it('opens Add an email address while the account has room', () => {
    expect(changeEmail([primary])).toEqual({ to: 'add' });
  });

  it('opens the address that is not primary once the account holds the most', () => {
    expect(changeEmail([primary, other])).toEqual({ to: 'row', id: 'email-2' });
  });
});

describe('the line goes', () => {
  it('once its address is verified again or removed, and only that one', () => {
    expect(lifted(['email-1', 'email-2'], 'email-2')).toEqual(['email-1']);
    expect(lifted(['email-1'], 'email-2')).toEqual(['email-1']);
  });
});
