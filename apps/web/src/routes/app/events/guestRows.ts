import {
  COMPANIONS_MAXIMUM,
  type Companion,
  GUEST_NAME_MAXIMUM,
  type Guest,
  type GuestList,
  type NewGuest,
  type Violation,
} from '@soirely/api-client';
import { compareGuestNames, emailProblem, phoneLengthProblem } from '@soirely/domain';

export type ReplyWord = Guest['reply'] | Companion['state'];

export type ListRow =
  | { kind: 'guest'; guest: Guest }
  | { kind: 'companion'; host: Guest; companion: Companion; nth: number | null };

/** Guests by their whole name, each with their companions straight under them in the API's order; an unnamed companion after the host's first is numbered. */
export function rowsOf(guests: readonly Guest[]): ListRow[] {
  return [...guests]
    .sort((a, b) => compareGuestNames({ name: a.fullName }, { name: b.fullName }))
    .flatMap((guest) => {
      let unnamed = 0;

      return [
        { kind: 'guest' as const, guest },
        ...guest.companions.map((companion) => {
          if (blank(companion.fullName)) unnamed += 1;

          return {
            kind: 'companion' as const,
            host: guest,
            companion,
            nth: blank(companion.fullName) && unnamed > 1 ? unnamed : null,
          };
        }),
      ];
    });
}

export function blank(name: string | null): boolean {
  return name == null || name.trim() === '';
}

function folded(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

/** The same words ignoring case and accents: "José Ávila" is "jose avila". */
export function listedAs(guests: readonly Guest[], name: string): Guest | null {
  const wanted = folded(name);

  return guests.find((one) => folded(one.fullName) === wanted) ?? null;
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
}

export type Problem =
  'blank' | 'tooLong' | 'emailShape' | 'phoneTooShort' | 'phoneTooLong' | 'noCountry';

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
        one.propertyPath === 'countryCode' ? 'noCountry' : (own.mobile ?? 'phoneTooShort');
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
