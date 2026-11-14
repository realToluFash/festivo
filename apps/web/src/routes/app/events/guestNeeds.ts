import { NEED_NOTE_MAXIMUM, NEED_OTHER_MAXIMUM, type NeedsInput } from '@soirely/api-client';
import {
  type NeedsProblem,
  type NeedsProblems,
  type NeedsTyped,
  needsInputOf,
} from '@soirely/domain';
import type { TFunction } from 'i18next';
import { useState } from 'react';

export {
  NEEDS_FIELDS,
  NO_NEEDS,
  type NeedsField,
  type NeedsProblem,
  type NeedsProblems,
  type NeedsTyped,
  firstNeedsFailing,
  hasAllergy,
  needsFailingCount,
  needsFocusKey,
  needsInputOf,
  needsLength as lengthOf,
  needsProblemsOf,
  needsTypedOf,
  needsViolations,
  problemsByWho,
  recorded,
} from '@soirely/domain';

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
