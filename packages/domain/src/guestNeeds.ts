import {
  type AccessNeed,
  type Allergen,
  type Diet,
  type GuestNeeds,
  NEED_NOTE_MAXIMUM,
  NEED_OTHER_MAXIMUM,
  type Violation,
} from '@soirely/api-client';

/** sc-3777's Needs as a form holds them, on the web and in the app: each Other's words kept while unticked, so ticking it again brings them back. */
export interface NeedsTyped {
  allergies: readonly Allergen[];
  diet: readonly Diet[];
  access: readonly AccessNeed[];
  otherAllergy: string;
  otherDiet: string;
  otherAccess: string;
  note: string;
}

export const NO_NEEDS: NeedsTyped = {
  allergies: [],
  diet: [],
  access: [],
  otherAllergy: '',
  otherDiet: '',
  otherAccess: '',
  note: '',
};

export const NEEDS_FIELDS = ['otherAllergy', 'otherDiet', 'otherAccess', 'note'] as const;
export type NeedsField = (typeof NEEDS_FIELDS)[number];
export type NeedsProblem = 'sayWhich' | 'otherTooLong' | 'noteTooLong';
export type NeedsProblems = Partial<Record<NeedsField, NeedsProblem>>;

const OTHER_OF = { otherAllergy: 'allergies', otherDiet: 'diet', otherAccess: 'access' } as const;

export function needsTypedOf(needs: GuestNeeds | null | undefined): NeedsTyped {
  if (needs == null) return NO_NEEDS;

  return {
    allergies: needs.allergies,
    diet: needs.diet,
    access: needs.access,
    otherAllergy: needs.otherAllergy ?? '',
    otherDiet: needs.otherDiet ?? '',
    otherAccess: needs.otherAccess ?? '',
    note: needs.note ?? '',
  };
}

/** Counted in code points after trimming the ends, as the API counts it. */
export function needsLength(text: string): number {
  return [...text.trim()].length;
}

function ticked(needs: NeedsTyped, field: keyof typeof OTHER_OF): boolean {
  return (needs[OTHER_OF[field]] as readonly string[]).includes('other');
}

export function needsProblemsOf(needs: NeedsTyped): NeedsProblems {
  const found: NeedsProblems = {};

  for (const field of ['otherAllergy', 'otherDiet', 'otherAccess'] as const) {
    if (!ticked(needs, field)) continue;
    if (needs[field].trim() === '') found[field] = 'sayWhich';
    else if (needsLength(needs[field]) > NEED_OTHER_MAXIMUM) found[field] = 'otherTooLong';
  }
  if (needsLength(needs.note) > NEED_NOTE_MAXIMUM) found.note = 'noteTooLong';

  return found;
}

/** What the API keeps: trimmed, an Other's words only while it is ticked, blank as null. */
export function needsInputOf(needs: NeedsTyped): GuestNeeds {
  const words = (field: keyof typeof OTHER_OF) => {
    const kept = needs[field].trim();

    return ticked(needs, field) && kept !== '' ? kept : null;
  };
  const note = needs.note.trim();

  return {
    allergies: [...needs.allergies],
    diet: [...needs.diet],
    access: [...needs.access],
    otherAllergy: words('otherAllergy'),
    otherDiet: words('otherDiet'),
    otherAccess: words('otherAccess'),
    note: note === '' ? null : note,
  };
}

/** The API's refusals on Needs, by person (`guest`, or `c{n}` for a companion), as the form's own problems. */
export function needsViolations(
  violations: readonly Violation[],
  typedOf: (who: string) => NeedsTyped,
): Record<string, NeedsProblems> {
  const found: Record<string, NeedsProblems> = {};

  for (const one of violations) {
    const at = /^(?:companions\[(\d+)\]\.)?needs\.(otherAllergy|otherDiet|otherAccess|note)$/u.exec(
      one.propertyPath,
    );
    if (at == null) continue;
    const who = at[1] == null ? 'guest' : `c${at[1]}`;
    const field = at[2] as NeedsField;
    const problems = (found[who] ??= {});

    problems[field] =
      field === 'note'
        ? 'noteTooLong'
        : typedOf(who)[field].trim() === ''
          ? 'sayWhich'
          : 'otherTooLong';
  }

  return found;
}

export function hasAllergy(needs: GuestNeeds | null | undefined): boolean {
  return needs != null && needs.allergies.length > 0;
}

export function recorded(needs: GuestNeeds | null | undefined): needs is GuestNeeds {
  return (
    needs != null &&
    (needs.allergies.length > 0 ||
      needs.diet.length > 0 ||
      needs.access.length > 0 ||
      needs.note != null)
  );
}

export function problemsByWho(people: readonly NeedsTyped[]): Record<string, NeedsProblems> {
  return Object.fromEntries(
    people
      .map((needs, at) => [at === 0 ? 'guest' : `c${at - 1}`, needsProblemsOf(needs)] as const)
      .filter(([, found]) => Object.keys(found).length > 0),
  );
}

export function needsFocusKey(who: string): string {
  return who === 'guest' ? 'needs' : `needs-${who}`;
}

/** The first refused field's focus key, the guest's before each companion's, in the form's order. */
export function firstNeedsFailing(problems: Record<string, NeedsProblems>): string | null {
  const order = Object.keys(problems).sort((a, b) =>
    a === 'guest' ? -1 : b === 'guest' ? 1 : Number(a.slice(1)) - Number(b.slice(1)),
  );

  for (const who of order) {
    const field = NEEDS_FIELDS.find((one) => problems[who]?.[one] != null);

    if (field != null) return `${needsFocusKey(who)}-${field}`;
  }

  return null;
}

export function needsFailingCount(problems: Record<string, NeedsProblems>): number {
  return Object.values(problems).reduce((sum, found) => sum + Object.keys(found).length, 0);
}
