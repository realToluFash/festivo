import {
  ACCESS,
  ALLERGENS,
  type Access,
  type Allergen,
  DIETS,
  type Diet,
  GUEST_KITCHEN_NAMES,
} from './guestKitchenWords.ts';
import { figure } from './guestsWords.ts';

export type DietPick = Diet | 'other';
export type AccessPick = Access | 'other';

export const DIET_PICKS: readonly DietPick[] = [...DIETS, 'other'];
export const ACCESS_PICKS: readonly AccessPick[] = [...ACCESS, 'other'];
export { ALLERGENS };

/** sc-3777's record, the API's one shape for a guest's or a companion's needs: codes with Other among them, each Other's words, and the hosts' private note. The guest's step (sc-3778) keeps its own answer, `Person`, and `recordOf` maps it onto this. */
export interface Needs {
  allergies: readonly Allergen[];
  diet: readonly DietPick[];
  access: readonly AccessPick[];
  otherAllergy: string;
  otherDiet: string;
  otherAccess: string;
  note: string;
  /** sc-3778: who last changed this person's record, the guest on their own page or the hosts, and on which day; none until anyone recorded one. */
  changed?: NeedsChange;
}

export interface NeedsChange {
  by: 'guest' | 'hosts';
  on: string;
}

export const NO_NEEDS: Needs = {
  allergies: [],
  diet: [],
  access: [],
  otherAllergy: '',
  otherDiet: '',
  otherAccess: '',
  note: '',
};

export const OTHER_MOST = 100;
export const NOTE_MOST = 500;

const NAMES = GUEST_KITCHEN_NAMES.en;

export const NW = {
  needs: 'Needs',
  theirNeeds: 'Their needs',
  noneRecorded: 'None recorded',
  noted: (count: number) => `${figure(count)} noted`,
  noneRecordedLine: 'None recorded. Open it to note allergies, diet or access needs.',
  allergies: 'Allergies',
  diet: 'Diet',
  access: 'Access',
  shownFirst: 'Shown first, everywhere',
  allergiesHint: 'What they must not eat, even a trace.',
  dietHint: 'Choices the kitchen honours.',
  accessHint: 'For the venue, not the kitchen.',
  other: 'Other',
  whichAllergy: 'Which allergy?',
  whichDiet: 'Which diet?',
  whatElse: 'What else do they need?',
  sayWhich: 'Say which',
  otherTooLong: `Shorten it to ${figure(OTHER_MOST)} characters or fewer.`,
  privateNote: 'Private note',
  noteHint: 'Only people who manage guests see this. Never the kitchen, the floor or the guest.',
  noteCount: (count: number) => `${figure(count)} of ${figure(NOTE_MOST)}`,
  noteTooLong: `Shorten the note to ${figure(NOTE_MOST)} characters or fewer.`,
  toFix: (count: number) =>
    count === 1
      ? 'One field needs fixing. Nothing was saved.'
      : `${figure(count)} fields need fixing. Nothing was saved.`,
  allergy: 'Allergy',
  allergyWith: (name: string) => `Allergy · ${name}`,
  noDietary: 'No dietary notes.',
  changedByGuest: (day: string) => `Last changed by the guest on ${day}.`,
  dietaryNotes: 'Dietary notes',
  allergen: (code: Allergen) => NAMES.allergens[code],
  dietName: (code: DietPick) => (code === 'other' ? 'Other' : NAMES.diets[code]),
  accessName: (code: AccessPick) => (code === 'other' ? 'Other' : NAMES.access[code]),
} as const;

/** Counted in code points after trimming the ends, as the API counts it. */
export function lengthOf(text: string): number {
  return [...text.trim()].length;
}

export interface NeedsLines {
  otherAllergy?: string;
  otherDiet?: string;
  otherAccess?: string;
  note?: string;
}

export type OtherError = 'empty' | 'long' | null;

/** The one rule for an Other's words, on the host's form and the guest's step: a ticked Other needs words, and at most 100 once trimmed. */
export function otherError(words: string, ticked: boolean): OtherError {
  if (ticked && words.trim() === '') return 'empty';

  return lengthOf(words) > OTHER_MOST ? 'long' : null;
}

function otherLine(ticked: boolean, words: string): string | undefined {
  if (!ticked) return undefined;
  const error = otherError(words, true);

  if (error === 'empty') return NW.sayWhich;
  if (error === 'long') return NW.otherTooLong;

  return undefined;
}

export function needsLines(needs: Needs): NeedsLines {
  const lines: NeedsLines = {};
  const allergy = otherLine(needs.allergies.includes('other'), needs.otherAllergy);
  const diet = otherLine(needs.diet.includes('other'), needs.otherDiet);
  const access = otherLine(needs.access.includes('other'), needs.otherAccess);

  if (allergy != null) lines.otherAllergy = allergy;
  if (diet != null) lines.otherDiet = diet;
  if (access != null) lines.otherAccess = access;
  if (lengthOf(needs.note) > NOTE_MOST) lines.note = NW.noteTooLong;

  return lines;
}

export const NEEDS_FIELDS = ['otherAllergy', 'otherDiet', 'otherAccess', 'note'] as const;

function named(words: string[]): string[] {
  return words.filter((word) => word !== '');
}

export function allergyNames(needs: Needs): string[] {
  return named(
    needs.allergies.map((code) =>
      code === 'other' ? needs.otherAllergy.trim() : NW.allergen(code),
    ),
  );
}

export function dietNames(needs: Needs): string[] {
  return named(
    needs.diet.map((code) => (code === 'other' ? needs.otherDiet.trim() : NW.dietName(code))),
  );
}

export function accessNames(needs: Needs): string[] {
  return named(
    needs.access.map((code) => (code === 'other' ? needs.otherAccess.trim() : NW.accessName(code))),
  );
}

/** The Dietary notes filter: any allergy or diet recorded, never access alone. */
export function dietary(needs: Needs | undefined): boolean {
  return needs != null && (allergyNames(needs).length > 0 || dietNames(needs).length > 0);
}

export function hasAllergy(needs: Needs | undefined): boolean {
  return needs != null && allergyNames(needs).length > 0;
}

export interface NeedChip {
  kind: 'allergy' | 'diet' | 'access' | 'note';
  word: string;
}

/** A closed section's chips: allergies first, then diet, access and a Private note chip that never shows the note. */
export function needsChips(needs: Needs): NeedChip[] {
  return [
    ...allergyNames(needs).map((word) => ({
      kind: 'allergy' as const,
      word: NW.allergyWith(word),
    })),
    ...dietNames(needs).map((word) => ({ kind: 'diet' as const, word })),
    ...accessNames(needs).map((word) => ({ kind: 'access' as const, word })),
    ...(needs.note.trim() === '' ? [] : [{ kind: 'note' as const, word: NW.privateNote }]),
  ];
}

/** Saved trimmed, an Other's words dropped once it is unticked. */
export function savedNeeds(needs: Needs): Needs {
  return {
    ...needs,
    otherAllergy: needs.allergies.includes('other') ? needs.otherAllergy.trim() : '',
    otherDiet: needs.diet.includes('other') ? needs.otherDiet.trim() : '',
    otherAccess: needs.access.includes('other') ? needs.otherAccess.trim() : '',
    note: needs.note.trim(),
  };
}

function sameNeeds(one: Needs, other: Needs): boolean {
  const { changed: _one, ...a } = savedNeeds(one);
  const { changed: _other, ...b } = savedNeeds(other);

  return JSON.stringify(a) === JSON.stringify(b);
}

/** sc-3778: a host's save that changes the record makes the hosts its last changer, so "Last changed by the guest" goes; one that changes nothing keeps it. */
export function hostsSaved(was: Needs | undefined, now: Needs, on: string | undefined): Needs {
  const saved = savedNeeds(now);

  if (on == null || sameNeeds(was ?? NO_NEEDS, saved)) return saved;

  return { ...saved, changed: { by: 'hosts', on } };
}

export function needsOf(partial: Partial<Needs>): Needs {
  return { ...NO_NEEDS, ...partial };
}
