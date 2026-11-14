import {
  type AccessNeed,
  type Allergen,
  type Diet,
  type GuestNeeds,
  NEED_NOTE_MAXIMUM,
  NEED_OTHER_MAXIMUM,
  type NeedsInput,
  type Violation,
} from '@soirely/api-client';
import type { TFunction } from 'i18next';
import { useState } from 'react';

/** sc-3777's Needs as the form holds them: each Other's words kept while unticked, so ticking it again brings them back. */
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
export function lengthOf(text: string): number {
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
    else if (lengthOf(needs[field]) > NEED_OTHER_MAXIMUM) found[field] = 'otherTooLong';
  }
  if (lengthOf(needs.note) > NEED_NOTE_MAXIMUM) found.note = 'noteTooLong';

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

/** The API's refusals on Needs, by person (`guest`, or `c{n}` for a companion), worded as the form's own. */
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

export function needsWords(t: TFunction, problem: NeedsProblem | undefined): string | undefined {
  if (problem == null) return undefined;
  if (problem === 'sayWhich') return t('guestNeeds.sayWhich');
  if (problem === 'otherTooLong') return t('guestNeeds.otherTooLong', { most: NEED_OTHER_MAXIMUM });

  return t('guestNeeds.noteTooLong', { most: NEED_NOTE_MAXIMUM });
}

function named(words: readonly (string | null)[]): string[] {
  return words.filter((word): word is string => word != null && word.trim() !== '');
}

export function allergyNames(t: TFunction, needs: NeedsInput): string[] {
  return named(
    (needs.allergies ?? []).map((code) =>
      code === 'other' ? (needs.otherAllergy ?? null) : t(`guestNeeds.allergen.${code}`),
    ),
  );
}

export function dietNames(t: TFunction, needs: NeedsInput): string[] {
  return named(
    (needs.diet ?? []).map((code) =>
      code === 'other' ? (needs.otherDiet ?? null) : t(`guestNeeds.dietName.${code}`),
    ),
  );
}

export function accessNames(t: TFunction, needs: NeedsInput): string[] {
  return named(
    (needs.access ?? []).map((code) =>
      code === 'other' ? (needs.otherAccess ?? null) : t(`guestNeeds.accessName.${code}`),
    ),
  );
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

export interface NeedChip {
  kind: 'allergy' | 'diet' | 'access' | 'note';
  word: string;
}

/** A closed section's chips: allergies first, then diet, access and a Private note chip that never shows the note. */
export function needsChips(t: TFunction, typed: NeedsTyped): NeedChip[] {
  const needs = needsInputOf(typed);

  return [
    ...allergyNames(t, needs).map((name) => ({
      kind: 'allergy' as const,
      word: t('guestNeeds.allergyWith', { names: name }),
    })),
    ...dietNames(t, needs).map((word) => ({ kind: 'diet' as const, word })),
    ...accessNames(t, needs).map((word) => ({ kind: 'access' as const, word })),
    ...(needs.note == null ? [] : [{ kind: 'note' as const, word: t('guestNeeds.privateNote') }]),
  ];
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

/** Which Needs sections are open, `guest` or `c{n}`; a refusal opens every one that failed. */
export function useNeedsOpen() {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  return {
    open,
    toggle: (who: string, next: boolean) =>
      setOpen((was) => {
        const after = new Set(was);

        if (next) after.add(who);
        else after.delete(who);

        return after;
      }),
    openFailing: (problems: Record<string, NeedsProblems>) =>
      setOpen((was) => new Set([...was, ...Object.keys(problems)])),
    closeAll: () => setOpen(new Set()),
  };
}
