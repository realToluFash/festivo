import {
  COMPANIONS_MAXIMUM,
  type Companion,
  GUEST_NAME_MAXIMUM,
  type Guest,
  type GuestList,
  type NewGuest,
  type Violation,
} from '@soirely/api-client';
import { emailProblem, nameKey, phoneLengthProblem } from '@soirely/domain';

export type ReplyWord = Guest['reply'] | Companion['state'];

/** Not yet invited stands where the reply goes until somebody invites them (sc-3788). */
export function shownReply(guest: Guest): ReplyWord {
  return guest.invitation == null && guest.reply === 'noReply' ? 'notYetInvited' : guest.reply;
}

export function blank(name: string | null): boolean {
  return name == null || name.trim() === '';
}

/** A guest or a named companion with the same words, ignoring case and accents: "José Ávila" is "jose avila". */
export function isListed(guests: readonly Guest[], name: string): boolean {
  const wanted = nameKey(name);

  return guests.some(
    (one) =>
      nameKey(one.fullName) === wanted ||
      one.companions.some(
        (companion) => !blank(companion.fullName) && nameKey(companion.fullName ?? '') === wanted,
      ),
  );
}

/** In code points, as the API counts them. */
export function nameLength(name: string): number {
  return [...name.trim()].length;
}

export interface Typed {
  fullName: string;
  email: string;
  country: string;
  number: string;
  companions: readonly string[];
  /** The host's Language for them, null for Not set (sc-3790). */
  language: string | null;
}

export type Problem =
  | 'blank'
  | 'tooLong'
  | 'emailShape'
  | 'phoneTooShort'
  | 'phoneTooLong'
  | 'noCountry'
  // A number of a length its country uses that the API still refuses, in the API's words.
  | { refused: string };

/** Field keys in the form's order: fullName, email, mobile, then companion-0 and on. */
export type Problems = Readonly<Record<string, Problem>>;

export function problemsOf(typed: Typed): Problems {
  const found: Record<string, Problem> = {};

  if (typed.fullName.trim() === '') found.fullName = 'blank';
  else if (nameLength(typed.fullName) > GUEST_NAME_MAXIMUM) found.fullName = 'tooLong';
  if (emailProblem(typed.email) === 'shape') found.email = 'emailShape';
  const phone = phoneLengthProblem(typed.number, typed.country);
  if (phone === 'tooShort') found.mobile = 'phoneTooShort';
  else if (phone === 'tooLong') found.mobile = 'phoneTooLong';
  else if (phone === 'noCountry') found.mobile = 'noCountry';
  typed.companions.forEach((name, at) => {
    if (nameLength(name) > GUEST_NAME_MAXIMUM) found[`companion-${at}`] = 'tooLong';
  });

  return found;
}

/** The server's refusals on the same fields, worded as the form words its own. */
export function violationProblems(violations: readonly Violation[], typed: Typed): Problems {
  const own = problemsOf(typed);
  const found: Record<string, Problem> = {};

  for (const one of violations) {
    const companion = /^companions\[(\d+)\]\.fullName$/u.exec(one.propertyPath);
    const key =
      companion != null
        ? `companion-${companion[1]}`
        : one.propertyPath === 'countryCode' || one.propertyPath.startsWith('mobile')
          ? 'mobile'
          : one.propertyPath;

    if (key === 'fullName') found.fullName = typed.fullName.trim() === '' ? 'blank' : 'tooLong';
    else if (key === 'email') found.email = 'emailShape';
    else if (key === 'mobile')
      found.mobile =
        one.propertyPath === 'countryCode' ? 'noCountry' : (own.mobile ?? { refused: one.message });
    else if (key.startsWith('companion-')) found[key] = 'tooLong';
  }

  return found;
}

export function firstProblem(problems: Problems, companions: number): string | null {
  const order = [
    'fullName',
    'email',
    'mobile',
    ...Array.from({ length: companions }, (_, at) => `companion-${at}`),
  ];

  return order.find((key) => problems[key] != null) ?? null;
}

export function newGuestOf(typed: Typed, allowDuplicate: boolean): NewGuest {
  const email = typed.email.trim();
  const number = typed.number.trim();

  return {
    fullName: typed.fullName.trim(),
    email: email === '' ? null : email,
    mobile: number === '' ? null : { countryCode: typed.country, number },
    companions: typed.companions.map((name) => ({
      fullName: name.trim() === '' ? null : name.trim(),
    })),
    language: typed.language,
    ...(allowDuplicate ? { allowDuplicate: true } : {}),
  };
}

/** The list with one more guest, counted as the header counts: guests and companions together. */
export function withGuest(list: GuestList, guest: Guest): GuestList {
  if (list.guests.some((one) => one.id === guest.id)) return list;

  return {
    guests: [...list.guests, guest],
    counts: {
      people: list.counts.people + 1 + guest.companions.length,
      guests: list.counts.guests + 1,
      companions: list.counts.companions + guest.companions.length,
    },
  };
}

export const MOST_COMPANIONS = COMPANIONS_MAXIMUM;
