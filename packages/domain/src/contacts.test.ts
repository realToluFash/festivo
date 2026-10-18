import { describe, expect, it } from 'vitest';

import { CONTACTS_MOST, contactActions, contactsLeft, listedContacts } from './contacts.ts';

describe('alternative addresses and numbers', () => {
  it('offers Make primary only on a verified row that is not the primary', () => {
    expect(contactActions({ verified: true, primary: false }).makePrimary).toBe(true);
    expect(contactActions({ verified: false, primary: false }).makePrimary).toBe(false);
    expect(contactActions({ verified: true, primary: true }).makePrimary).toBe(false);
  });

  it('never offers to remove the primary, and asks first only for a verified row', () => {
    expect(contactActions({ verified: true, primary: true })).toEqual({
      verify: false,
      makePrimary: false,
      remove: false,
      askBeforeRemoving: true,
    });
    expect(contactActions({ verified: false, primary: false })).toEqual({
      verify: true,
      makePrimary: false,
      remove: true,
      askBeforeRemoving: false,
    });
  });

  it('counts the primary toward the cap, and never a number waiting to replace it', () => {
    const primary = { verified: true, primary: true };
    const pending = { verified: false, primary: false, pending: true };

    expect(CONTACTS_MOST).toBe(2);
    expect(contactsLeft([primary])).toBe(1);
    expect(contactsLeft([primary, { verified: false, primary: false }])).toBe(0);
    expect(contactsLeft([primary, pending])).toBe(1);
    expect(listedContacts([primary, pending])).toEqual([primary]);
  });
});
