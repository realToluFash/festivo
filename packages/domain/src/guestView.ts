import type { Companion, Guest, GuestNeeds, HeadcountCounts } from '@soirely/api-client';
import { compareGuestNames } from './guestName.ts';
import { shownReply } from './guestForm.ts';
import { nameKey } from './nameKey.ts';
import { phoneMatches } from './phone.ts';

/** Where a person stands, in the host's words: a companion is Not yet invited with their guest, then Held until their guest is Coming. */
export type Standing = 'coming' | 'maybe' | 'noReply' | 'notYetInvited' | 'held' | 'notComing';

/** The filter menu's choices in its order (sc-3772); `all` is the default and is never written to the address. All and Invited are totals, set apart from the replies below them, which add up to All; Invited is the five replies together (sc-3786). */
export const CHOICES = [
  'all',
  'invited',
  'coming',
  'maybe',
  'noReply',
  'held',
  'notComing',
  'notYetInvited',
] as const;
export type Choice = (typeof CHOICES)[number];

/** On All, the groups in the menu's order. A held companion is always under their guest, so Held has no group. */
const GROUPS: readonly (Standing & Choice)[] = [
  'coming',
  'maybe',
  'noReply',
  'notComing',
  'notYetInvited',
];

export const FIRST_ROWS = 2;

export function choiceOf(value: string | null): Choice {
  return CHOICES.find((choice) => choice === value) ?? 'all';
}

export interface Person {
  id: string;
  standing: Standing;
  guest: Guest;
  companion: Companion | null;
  at: number;
}

/** sc-3777: an allergy or a diet recorded, what the Dietary notes filter and tag keep; access needs alone are not dietary. */
export function dietary(needs: GuestNeeds | null | undefined): boolean {
  return needs != null && (needs.allergies.length > 0 || needs.diet.length > 0);
}

export function peopleOf(guests: readonly Guest[]): Person[] {
  return [...guests]
    .sort((a, b) => compareGuestNames({ name: a.fullName }, { name: b.fullName }))
    .flatMap((guest) => [
      { id: guest.id, standing: shownReply(guest), guest, companion: null, at: 0 },
      ...guest.companions.map((companion, at) => ({
        id: companion.id,
        standing: companion.state,
        guest,
        companion,
        at,
      })),
    ]);
}

export type Counts = Record<Choice, number> & {
  /** Everyone without an answer of their own: the guests who owe one and the companions held behind them. */
  havent: number;
  haventGuests: number;
  haventCompanions: number;
};

/** sc-99's headcount, in the menu's choices: every choice but All adds up to All. */
export function countsOf(headcount: HeadcountCounts): Counts {
  return {
    all: headcount.onList,
    coming: headcount.accepted,
    maybe: headcount.maybe,
    noReply: headcount.awaitingReply,
    held: headcount.held,
    notComing: headcount.declined,
    notYetInvited: headcount.notYetInvited,
    invited: headcount.invited,
    havent: headcount.awaitingReply + headcount.heldBy.hostNoReply,
    haventGuests: headcount.awaitingReply,
    haventCompanions: headcount.heldBy.hostNoReply,
  };
}

/** The full name, ignoring case and accents, anywhere in it; a guest's email address and mobile number too, when the reader is sent them. */
export function matches(person: Person, q: string): boolean {
  const typed = nameKey(q);

  if (typed === '') return true;
  const name = person.companion == null ? person.guest.fullName : person.companion.fullName;

  if (name != null && nameKey(name).includes(typed)) return true;
  if (person.companion != null) return false;
  const { email, mobile } = person.guest;

  return (
    (email != null && nameKey(email).includes(typed)) || (mobile != null && phoneMatches(mobile, q))
  );
}

export interface ViewRow {
  person: Person;
  indent: boolean;
}

export interface ViewGroup {
  standing: Standing;
  count: number;
  rows: ViewRow[];
  collapsed: boolean;
  next: string | null;
}

export type ListView = { kind: 'groups'; groups: ViewGroup[] } | { kind: 'rows'; rows: ViewRow[] };

/** On All or Invited with no search and no Dietary notes, the groups (Invited's without Not yet invited); otherwise the flat rows the choice, the search and Dietary notes keep, a companion under their guest when both are kept. */
export function viewOf(
  guests: readonly Guest[],
  counts: Counts,
  choice: Choice,
  q: string,
  expanded: ReadonlySet<Standing>,
  dietaryOnly = false,
): { view: ListView; shown: number } {
  const people = peopleOf(guests);

  const totals = choice === 'all' || choice === 'invited';

  if (!totals || q.trim() !== '' || dietaryOnly) {
    const found = people.filter(
      (one) =>
        (choice === 'all' ||
          (choice === 'invited' ? one.standing !== 'notYetInvited' : one.standing === choice)) &&
        matches(one, q) &&
        (!dietaryOnly || dietary(one.companion == null ? one.guest.needs : one.companion.needs)),
    );
    const hosts = new Set(found.filter((one) => one.companion == null).map((one) => one.id));

    return {
      view: {
        kind: 'rows',
        rows: found.map((person) => ({
          person,
          indent: person.companion != null && hosts.has(person.guest.id),
        })),
      },
      shown: found.length,
    };
  }

  const groups = GROUPS.filter((standing) => choice === 'all' || standing !== 'notYetInvited')
    .map((standing) => {
      const heads = people.filter((one) => one.companion == null && one.standing === standing);
      const open = expanded.has(standing) || heads.length <= FIRST_ROWS;
      const rows = (open ? heads : heads.slice(0, FIRST_ROWS)).flatMap((head) => [
        { person: head, indent: false },
        ...people
          .filter((one) => one.companion != null && one.guest.id === head.id)
          .map((person) => ({ person, indent: true })),
      ]);

      return {
        standing,
        count: counts[standing],
        rows,
        collapsed: !open,
        next: open ? null : (heads[FIRST_ROWS]?.id ?? null),
      };
    })
    .filter((group) => group.rows.length > 0);

  return { view: { kind: 'groups', groups }, shown: counts[choice] };
}
