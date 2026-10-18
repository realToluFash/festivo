import { describe, expect, it, vi } from 'vitest';

import {
  CONTACTS_MOST,
  contactActions,
  contactsLeft,
  justVerified,
  listedContacts,
  rereadAfterRefusal,
} from './contacts.ts';

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

describe('a refusal that says the list has changed', () => {
  it.each([
    'primary_address',
    'last_verified_address',
    'address_not_verified',
    'address_limit_reached',
    'already_linked',
  ])('reads the list again for %s', async (code) => {
    const read = vi.fn(async () => {});

    expect(await rereadAfterRefusal(code, read)).toBe(true);
    expect(read).toHaveBeenCalledOnce();
  });

  it.each(['too_many_attempts', 'validation_failed', 'not_found', null])(
    'leaves the list alone for %s',
    async (code) => {
      const read = vi.fn(async () => {});

      expect(await rereadAfterRefusal(code, read)).toBe(false);
      expect(read).not.toHaveBeenCalled();
    },
  );

  it('still lets the reason show when the read fails', async () => {
    await expect(
      rereadAfterRefusal('already_linked', () => Promise.reject(new Error('offline'))),
    ).resolves.toBe(true);
  });
});

describe('the row a verify screen came back for', () => {
  const rows = [
    { id: 'e1', verified: true, primary: true },
    { id: 'e2', verified: true, primary: false },
    { id: 'e3', verified: false, primary: false },
    { id: 'p9', verified: true, primary: false, pending: true },
  ];

  it('is the listed row with that id once it is verified', () => {
    expect(justVerified(rows, 'e2')).toEqual(rows[1]);
  });

  it('is nothing for a row still unverified, one not listed, or no id', () => {
    expect(justVerified(rows, 'e3')).toBeNull();
    expect(justVerified(rows, 'p9')).toBeNull();
    expect(justVerified(rows, 'gone')).toBeNull();
    expect(justVerified(rows, null)).toBeNull();
  });
});
