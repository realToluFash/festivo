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

/** sc-3777: needs as codes plus each Other's words, and the hosts' private note; a guest and each companion have their own. */
export interface Needs {
  allergens: readonly Allergen[];
  diets: readonly DietPick[];
  access: readonly AccessPick[];
  otherAllergy: string;
  otherDiet: string;
  otherAccess: string;
  note: string;
}

export const NO_NEEDS: Needs = {
  allergens: [],
  diets: [],
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
  allergiesHint: 'What they must not eat.',
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

function otherLine(ticked: boolean, words: string): string | undefined {
  if (!ticked) return undefined;
  if (words.trim() === '') return NW.sayWhich;
  if (lengthOf(words) > OTHER_MOST) return NW.otherTooLong;

  return undefined;
}

export function needsLines(needs: Needs): NeedsLines {
  const lines: NeedsLines = {};
  const allergy = otherLine(needs.allergens.includes('other'), needs.otherAllergy);
  const diet = otherLine(needs.diets.includes('other'), needs.otherDiet);
  const access = otherLine(needs.access.includes('other'), needs.otherAccess);

  if (allergy != null) lines.otherAllergy = allergy;
  if (diet != null) lines.otherDiet = diet;
  if (access != null) lines.otherAccess = access;
  if (lengthOf(needs.note) > NOTE_MOST) lines.note = NW.noteTooLong;

  return lines;
}

export const NEEDS_FIELDS = ['otherAllergy', 'otherDiet', 'otherAccess', 'note'] as const;

export function allergyNames(needs: Needs): string[] {
  return needs.allergens.map((code) =>
    code === 'other' ? needs.otherAllergy.trim() : NW.allergen(code),
  );
}

export function dietNames(needs: Needs): string[] {
  return needs.diets.map((code) => (code === 'other' ? needs.otherDiet.trim() : NW.dietName(code)));
}

export function accessNames(needs: Needs): string[] {
  return needs.access.map((code) =>
    code === 'other' ? needs.otherAccess.trim() : NW.accessName(code),
  );
}

/** The Dietary notes filter: any allergy or diet recorded, never access alone. */
export function dietary(needs: Needs | undefined): boolean {
  return needs != null && (needs.allergens.length > 0 || needs.diets.length > 0);
}

export function hasAllergy(needs: Needs | undefined): boolean {
  return needs != null && needs.allergens.length > 0;
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
    otherAllergy: needs.allergens.includes('other') ? needs.otherAllergy.trim() : '',
    otherDiet: needs.diets.includes('other') ? needs.otherDiet.trim() : '',
    otherAccess: needs.access.includes('other') ? needs.otherAccess.trim() : '',
    note: needs.note.trim(),
  };
}

export function needsOf(partial: Partial<Needs>): Needs {
  return { ...NO_NEEDS, ...partial };
}
