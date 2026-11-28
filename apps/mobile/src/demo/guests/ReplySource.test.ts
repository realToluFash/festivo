import { describe, expect, it } from 'vitest';

import { guestOf, guestsAt, replyLine, rowsOf } from './GuestsModel.ts';
import { replyByOf } from './GuestsSample.ts';

const REPLY_BY = replyByOf('evt-wed-4');
const guests = guestsAt('replyFromLink');
const line = (key: string) => {
  const guest = guests.find((one) => one.key === key);
  if (guest == null) throw new Error(`no ${key}`);
  return replyLine(guest, 'en-US', REPLY_BY);
};

describe('where a reply came from (sc-1291)', () => {
  it('names the email answer link a reply was confirmed from, and nothing for the page itself', () => {
    expect(line('sophie')).toBe('Coming · replied Oct 12 · from the email link');
    expect(line('camille')).toBe('Not coming · replied Oct 20');
    expect(line('kwame')).toBe('Coming · replied Oct 2');
  });

  it('keeps the source with the reply on the host’s row, before the group', () => {
    const row = rowsOf(guests, 'all', '', 'en-US', REPLY_BY).find((one) => one.key === 'sophie');
    expect(row?.line).toMatch(/^Coming · replied Oct 12 · from the email link · Work/);
  });

  it('opens on Sophie Laurent', () => {
    expect(guestOf('replyFromLink')).toBe('sophie');
  });
});
