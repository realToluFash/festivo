/** sc-5519: Group (sc-3775) and Needs (sc-3777) on the app's guest form, row and details; the rules and the board's English, as the web's demo has them. */

export const ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soybeans',
  'milk',
  'tree_nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
  'other',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const DIETS = [
  'vegetarian',
  'vegan',
  'pescatarian',
  'halal',
  'kosher',
  'no_pork',
  'no_beef',
  'no_alcohol',
  'other',
] as const;
export type Diet = (typeof DIETS)[number];

export const ACCESS = [
  'step_free',
  'near_exit',
  'hearing_loop',
  'sign_language',
  'wheelchair_space',
  'other',
] as const;
export type Access = (typeof ACCESS)[number];

const ALLERGEN_NAMES: Record<Allergen, string> = {
  gluten: 'Cereals containing gluten',
  crustaceans: 'Crustaceans',
  eggs: 'Eggs',
  fish: 'Fish',
  peanuts: 'Peanuts',
  soybeans: 'Soya',
  milk: 'Milk',
  tree_nuts: 'Tree nuts',
  celery: 'Celery',
  mustard: 'Mustard',
  sesame: 'Sesame',
  sulphites: 'Sulphur dioxide and sulphites',
  lupin: 'Lupin',
  molluscs: 'Molluscs',
  other: 'Other allergy',
};

const DIET_NAMES: Record<Diet, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  pescatarian: 'Pescatarian',
  halal: 'Halal',
  kosher: 'Kosher',
  no_pork: 'No pork',
  no_beef: 'No beef',
  no_alcohol: 'No alcohol',
  other: 'Other',
};

const ACCESS_NAMES: Record<Access, string> = {
  step_free: 'Step-free access',
  near_exit: 'A seat near an exit',
  hearing_loop: 'A hearing loop',
  sign_language: 'Sign language',
  wheelchair_space: 'Space for a wheelchair at the table',
  other: 'Other',
};

export const OTHER_MOST = 100;
export const NOTE_MOST = 500;
export const GROUP_NAME_MOST = 60;
export const GROUPS_MOST = 50;

export const NW = {
  needs: 'Needs',
  theirNeeds: 'Their needs',
  noneRecorded: 'None recorded',
  noted: (count: number) => `${count} noted`,
  noneRecordedLine: 'None recorded. Open it to note allergies, diet or access needs.',
  allergies: 'Allergies',
  diet: 'Diet',
  access: 'Access',
  shownFirst: 'Shown first, everywhere',
  allergiesHint: 'What they must not eat, even a trace.',
  dietHint: 'Choices the kitchen honours.',
  accessHint: 'For the venue, not the kitchen.',
  whichAllergy: 'Which allergy?',
  whichDiet: 'Which diet?',
  whatElse: 'What else do they need?',
  sayWhich: 'Say which',
  otherTooLong: `Shorten it to ${OTHER_MOST} characters or fewer.`,
  privateNote: 'Private note',
  noteHint: 'Only people who manage guests see this. Never the kitchen, the floor or the guest.',
  noteCount: (count: number) => `${count} of ${NOTE_MOST}`,
  noteTooLong: `Shorten the note to ${NOTE_MOST} characters or fewer.`,
  toFix: (count: number) =>
    count === 1
      ? 'One field needs fixing. Nothing was saved.'
      : `${count} fields need fixing. Nothing was saved.`,
  allergy: 'Allergy',
  allergyWith: (name: string) => `Allergy · ${name}`,
  noDietary: 'No dietary notes.',
  allergen: (code: Allergen) => ALLERGEN_NAMES[code],
  dietName: (code: Diet) => DIET_NAMES[code],
  accessName: (code: Access) => ACCESS_NAMES[code],
} as const;

export const GW = {
  group: 'Group',
  noGroup: 'No group',
  forWhom: (name: string) => `For ${name} and their companions.`,
  chooseOrType: 'Choose or type a group',
  createNamed: (name: string) => `Create “${name}”`,
  newGroup: 'New group',
  madeOnSave: (name: string) => `${name} is a new group. It’s made when you save.`,
  people: (count: number) => `${count} ${count === 1 ? 'person' : 'people'}`,
  blank: 'Enter a name for the group.',
  tooLong: `A group name can be up to ${GROUP_NAME_MOST} characters.`,
  taken: (name: string) => `There’s already a group called ${name}.`,
  /** Words settled, 23 Oct (#7802, #7811): the app's own, since Groups is on the web. */
  limit: `This event has ${GROUPS_MOST} groups, the most it can have. Choose one of them, or, to create another, use Soirely on the web to delete one in Groups.`,
} as const;

export interface Needs {
  allergies: readonly Allergen[];
  diet: readonly Diet[];
  access: readonly Access[];
  otherAllergy: string;
  otherDiet: string;
  otherAccess: string;
  note: string;
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

export function needsOf(partial: Partial<Needs>): Needs {
  return { ...NO_NEEDS, ...partial };
}

/** Counted in code points after trimming the ends, as the API counts it. */
export function lengthOf(text: string): number {
  return [...text.trim()].length;
}

export type OtherError = 'empty' | 'long' | null;

export function otherError(words: string, ticked: boolean): OtherError {
  if (!ticked) return null;
  if (words.trim() === '') return 'empty';

  return lengthOf(words) > OTHER_MOST ? 'long' : null;
}

export const NEEDS_FIELDS = ['otherAllergy', 'otherDiet', 'otherAccess', 'note'] as const;
export type NeedsField = (typeof NEEDS_FIELDS)[number];

export function needsLines(needs: Needs): Partial<Record<NeedsField, string>> {
  const lines: Partial<Record<NeedsField, string>> = {};
  const others = [
    ['otherAllergy', needs.allergies.includes('other'), needs.otherAllergy],
    ['otherDiet', needs.diet.includes('other'), needs.otherDiet],
    ['otherAccess', needs.access.includes('other'), needs.otherAccess],
  ] as const;

  for (const [field, ticked, words] of others) {
    const error = otherError(words, ticked);
    if (error === 'empty') lines[field] = NW.sayWhich;
    if (error === 'long') lines[field] = NW.otherTooLong;
  }
  if (lengthOf(needs.note) > NOTE_MOST) lines.note = NW.noteTooLong;

  return lines;
}

function named(words: string[]): string[] {
  return words.filter((word) => word !== '');
}

/** The first failing needs field across people in form order: each person's fields in turn. */
export function firstFailing(
  people: readonly Partial<Record<NeedsField, string>>[],
): { at: number; field: NeedsField } | null {
  for (const [at, lines] of people.entries()) {
    const field = NEEDS_FIELDS.find((one) => lines[one] != null);
    if (field != null) return { at, field };
  }

  return null;
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

export function needsHeadLine(needs: Needs): string {
  const count = needsChips(needs).length;

  return count === 0 ? NW.noneRecorded : NW.noted(count);
}

export function savedNeeds(needs: Needs): Needs {
  return {
    ...needs,
    otherAllergy: needs.allergies.includes('other') ? needs.otherAllergy.trim() : '',
    otherDiet: needs.diet.includes('other') ? needs.otherDiet.trim() : '',
    otherAccess: needs.access.includes('other') ? needs.otherAccess.trim() : '',
    note: needs.note.trim(),
  };
}

export function toggled<T>(list: readonly T[], one: T): T[] {
  return list.includes(one) ? list.filter((each) => each !== one) : [...list, one];
}

export interface GuestGroup {
  id: string;
  name: string;
  people: number;
}

export type GroupPick = { id: string } | { name: string } | null;

export const WEDDING_GROUPS: readonly GuestGroup[] = [
  { id: 'g-bride', name: 'Bride’s side', people: 9 },
  { id: 'g-groom', name: 'Groom’s side', people: 4 },
  { id: 'g-work', name: 'Work', people: 5 },
  { id: 'g-school', name: 'Old school friends', people: 3 },
];

export function fullGroups(): GuestGroup[] {
  return [
    ...WEDDING_GROUPS,
    ...Array.from({ length: GROUPS_MOST - WEDDING_GROUPS.length }, (_, at) => ({
      id: `g-table-${at + 1}`,
      name: `Table ${at + 1} friends`,
      people: 2,
    })),
  ];
}

/** Case and accents aside, as the API compares names within an event. */
export function foldedName(name: string): string {
  return name
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .replaceAll(/[’‘`]/gu, "'")
    .replaceAll(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

export function sameGroup(groups: readonly GuestGroup[], name: string): GuestGroup | null {
  const folded = foldedName(name);

  return groups.find((one) => foldedName(one.name) === folded) ?? null;
}

export function sortedGroups(groups: readonly GuestGroup[]): GuestGroup[] {
  return [...groups].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

export type GroupProblem = 'blank' | 'tooLong' | 'limit';

/** What return, or Create, does with the typed name: blank, over 60, then 50 groups; a name that matches is a pick, not a problem. */
export function typedProblem(groups: readonly GuestGroup[], typed: string): GroupProblem | null {
  if (typed.trim() === '') return 'blank';
  if (sameGroup(groups, typed) != null) return null;
  if (lengthOf(typed) > GROUP_NAME_MOST) return 'tooLong';

  return groups.length >= GROUPS_MOST ? 'limit' : null;
}

export function problemLine(problem: GroupProblem): string {
  if (problem === 'blank') return GW.blank;

  return problem === 'tooLong' ? GW.tooLong : GW.limit;
}

export function groupOptions(
  groups: readonly GuestGroup[],
  typed: string,
): { groups: GuestGroup[]; create: string | null } {
  const words = typed.trim();
  const folded = foldedName(words);
  const found = sortedGroups(groups).filter((one) => foldedName(one.name).includes(folded));
  const create =
    words === '' || sameGroup(groups, words) != null || typedProblem(groups, words) != null
      ? null
      : words;

  return { groups: found, create };
}

export function returnPick(
  groups: readonly GuestGroup[],
  typed: string,
): { pick: GroupPick } | { problem: GroupProblem } {
  const found = sameGroup(groups, typed);
  if (found != null) return { pick: { id: found.id } };
  const problem = typedProblem(groups, typed);

  return problem == null ? { pick: { name: typed.trim() } } : { problem };
}

export function pickName(groups: readonly GuestGroup[], pick: GroupPick): string | null {
  if (pick == null) return null;
  if ('name' in pick) return pick.name;

  return groups.find((one) => one.id === pick.id)?.name ?? null;
}

export function groupName(groups: readonly GuestGroup[], id: string | null | undefined) {
  return id == null ? null : (groups.find((one) => one.id === id)?.name ?? null);
}
