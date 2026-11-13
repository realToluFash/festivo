import { contactsLeft, primaryFirst } from '@soirely/domain';

import type { Contact } from '../../kit/accountPage.ts';

/** The board's words (Account-Undeliverable.dc.html); the developer moves them to the four locales. */
export const UNDELIVERABLE_WORDS = {
  line: (address: string) => `We couldn’t deliver email to ${address}.`,
  change: 'Change email',
  changeFor: (address: string) => `Change email, instead of ${address}`,
} as const;

/** The addresses Soirely stopped sending to (sc-4332), in the rows' order. A phone number never counts. */
export function undeliverable(
  emails: readonly Contact[],
  suppressed: readonly string[],
): Contact[] {
  return primaryFirst(emails).filter((row) => suppressed.includes(row.id));
}

export type ChangeEmail = { to: 'add' } | { to: 'row'; id: string };

/** Adds an address while there is room; with the most held, opens the one address that can make room. */
export function changeEmail(emails: readonly Contact[]): ChangeEmail {
  const other = emails.find((row) => !row.primary);
  if (contactsLeft(emails) > 0 || other == null) return { to: 'add' };

  return { to: 'row', id: other.id };
}

/** A code typed for the address, or the address removed, ends the line (pm, 13 Nov). */
export function lifted(suppressed: readonly string[], id: string): string[] {
  return suppressed.filter((each) => each !== id);
}
