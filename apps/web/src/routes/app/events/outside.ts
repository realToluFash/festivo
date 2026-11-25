import type { EventPerson, EventRole } from '@soirely/api-client';
import { emailProblem, formatPhone, phoneE164, phoneLengthProblem } from '@soirely/domain';

export interface OutsideAddress {
  kind: 'email' | 'mobile';
  address: string;
  shown: string;
}

export type OutsideView =
  | { kind: 'none' }
  | { kind: 'offer'; address: OutsideAddress }
  | { kind: 'unusable' }
  | { kind: 'leadOff' }
  | { kind: 'onEvent'; name: string };

function read(text: string, country: string): OutsideAddress | 'name' | 'unusable' {
  if (text.includes('@'))
    return emailProblem(text) == null
      ? { kind: 'email', address: text.toLowerCase(), shown: text }
      : 'unusable';
  if (text === '' || /\p{L}/u.test(text) || !/\d/u.test(text)) return 'name';
  const e164 = phoneLengthProblem(text, country) == null ? phoneE164(text, country) : null;

  return e164 == null ? 'unusable' : { kind: 'mobile', address: e164, shown: formatPhone(e164) };
}

/** sc-71's form checks: an @ is an email address, digits a mobile number by the country's lengths, letters a name to find. */
export function outsideView(
  typed: string,
  country: string,
  role: EventRole,
  people: readonly EventPerson[],
): OutsideView {
  const address = read(typed.trim(), country);
  if (address === 'name') return { kind: 'none' };
  if (address === 'unusable') return { kind: 'unusable' };
  const there = people.find((one) => one.address === address.address);
  if (there != null) return { kind: 'onEvent', name: shownAddress(there) ?? address.shown };

  return role === 'lead' ? { kind: 'leadOff' } : { kind: 'offer', address };
}

/** The address a row is listed under until its person has an account; null when the reader is not given it. */
export function shownAddress(person: EventPerson): string | null {
  if (person.address == null) return null;

  return person.addressKind === 'mobile' ? formatPhone(person.address) : person.address;
}

export function faceOf(person: EventPerson): 'mail' | 'phone' | 'user' | null {
  if (person.user != null) return null;
  if (person.addressKind === 'email') return 'mail';

  return person.addressKind === 'mobile' ? 'phone' : 'user';
}
