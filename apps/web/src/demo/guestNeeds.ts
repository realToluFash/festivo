import { figure } from './guestsWords.ts';
import {
  ACCESS,
  ALLERGENS,
  type Access,
  type Allergen,
  DIETS,
  type Diet,
  GUEST_KITCHEN_NAMES,
} from './guestKitchenWords.ts';

export type NeedGroup = 'allergies' | 'diet' | 'access';
export const NEED_GROUPS: readonly NeedGroup[] = ['allergies', 'diet', 'access'];

/** sc-3777's codes; Other is its own box per group, with its words beside it. */
export const GROUP_CODES = {
  allergies: ALLERGENS.filter((code) => code !== 'other'),
  diet: DIETS,
  access: ACCESS,
} as const;

export type NeedCode = Allergen | Diet | Access;

/** A guest's or a companion's needs as the API serves them: codes, each Other's words (null while unticked), and the Private note. */
export interface Needs {
  allergies: readonly Allergen[];
  diet: readonly Diet[];
  access: readonly Access[];
  other: Readonly<Record<NeedGroup, string | null>>;
  note: string;
}

export const NO_NEEDS: Needs = {
  allergies: [],
  diet: [],
  access: [],
  other: { allergies: null, diet: null, access: null },
  note: '',
};

export const OTHER_MOST = 100;
export const NOTE_MOST = 500;

const NAMES = GUEST_KITCHEN_NAMES.en;

/** The boards' English (GuestNeeds.dc.html, accepted by pm on 21 Oct, #5661); the words are proposals for [en]. */
export const GN = {
  needs: 'Needs',
  theirNeeds: 'Their needs',
  noneRecorded: 'None recorded',
  noted: (count: number) => `${figure(count)} noted`,
  emptyLine: 'None recorded. Open it to note allergies, diet or access needs.',
  groups: { allergies: 'Allergies', diet: 'Diet', access: 'Access' } as Record<NeedGroup, string>,
  hints: {
    allergies: 'What they must not eat, even a trace.',
    diet: 'Choices the kitchen honours.',
    access: 'For the venue, not the kitchen.',
  } as Record<NeedGroup, string>,
  shownFirst: 'Shown first, everywhere',
  other: {
    allergies: 'Other allergy',
    diet: 'Other diet',
    access: 'Other access need',
  } as Record<NeedGroup, string>,
  which: {
    allergies: 'Which allergy?',
    diet: 'Which diet?',
    access: 'What else do they need?',
  } as Record<NeedGroup, string>,
  sayWhich: 'Say which',
  otherTooLong: `Shorten it to ${figure(OTHER_MOST)} characters or fewer.`,
  privateNote: 'Private note',
  noteHint: 'Only people who manage guests see this. Never the kitchen, the floor or the guest.',
  noteTooLong: `Shorten the note to ${figure(NOTE_MOST)} characters or fewer.`,
  allergy: 'Allergy',
  fix: (count: number) =>
    count === 1
      ? 'One field needs fixing. Nothing was saved.'
      : `${figure(count)} fields need fixing. Nothing was saved.`,
  addedWithNeeds: (name: string) => `${name} added. Their needs are on the list under Dietary.`,
};

export function codeName(group: NeedGroup, code: NeedCode): string {
  if (group === 'allergies') return NAMES.allergens[code as Allergen];
  if (group === 'diet') return NAMES.diets[code as Diet];

  return NAMES.access[code as Access];
}

/** Counted in code points after trimming, as the API counts it (pm #5004). */
export function lengthOf(text: string): number {
  return [...text.trim()].length;
}

export function codesOf(needs: Needs, group: NeedGroup): readonly NeedCode[] {
  return needs[group];
}

export function toggled(needs: Needs, group: NeedGroup, code: NeedCode): Needs {
  const was = codesOf(needs, group);
  const next = was.includes(code) ? was.filter((one) => one !== code) : [...was, code];
  const order = GROUP_CODES[group] as readonly NeedCode[];

  return { ...needs, [group]: order.filter((one) => next.includes(one)) } as Needs;
}

export type NeedsLines = Partial<Record<NeedGroup | 'note', string>>;

export function needsLinesOf(needs: Needs): NeedsLines {
  const lines: NeedsLines = {};

  for (const group of NEED_GROUPS) {
    const words = needs.other[group];

    if (words == null) continue;
    if (words.trim() === '') lines[group] = GN.sayWhich;
    else if (lengthOf(words) > OTHER_MOST) lines[group] = GN.otherTooLong;
  }
  if (lengthOf(needs.note) > NOTE_MOST) lines.note = GN.noteTooLong;

  return lines;
}

export interface Chip {
  key: string;
  words: string;
  allergy: boolean;
}

/** The collapsed section's chips: allergies first, each with the word Allergy; the note by name, never its text. */
export function chipsOf(needs: Needs): Chip[] {
  const chips: Chip[] = [];

  for (const group of NEED_GROUPS) {
    const allergy = group === 'allergies';

    for (const code of codesOf(needs, group)) {
      chips.push({ key: `${group}-${code}`, words: codeName(group, code), allergy });
    }
    const words = needs.other[group]?.trim() ?? '';

    if (words !== '') chips.push({ key: `${group}-other`, words, allergy });
  }
  if (needs.note.trim() !== '') chips.push({ key: 'note', words: GN.privateNote, allergy: false });

  return chips;
}

export function hasNeeds(needs: Needs): boolean {
  return chipsOf(needs).length > 0;
}

/** Saved as the API keeps them: each Other trimmed, an unticked or blank one gone, the note trimmed. */
export function keptNeeds(needs: Needs): Needs {
  const other = { ...needs.other };

  for (const group of NEED_GROUPS) {
    const words = other[group]?.trim() ?? '';

    other[group] = words === '' ? null : words;
  }

  return { ...needs, other, note: needs.note.trim() };
}

export interface NeedsPerson {
  who: string;
  needs: Needs;
}

/** Every refusal on the form's needs, by section, and the field the focus goes to first. */
export function needsRefused(people: readonly NeedsPerson[]): {
  lines: Readonly<Record<string, NeedsLines>>;
  count: number;
  first: string | null;
} {
  const lines: Record<string, NeedsLines> = {};
  let count = 0;
  let first: string | null = null;

  for (const { who, needs } of people) {
    const found = needsLinesOf(needs);
    const keys = Object.keys(found) as (NeedGroup | 'note')[];

    if (keys.length === 0) continue;
    lines[who] = found;
    count += keys.length;
    first ??= `${who}-${keys[0]}`;
  }

  return { lines, count, first };
}

/** Sample needs for the demo's states. */
export const KWAME_NEEDS: Needs = {
  allergies: ['peanuts', 'sesame'],
  diet: ['halal'],
  access: ['step_free'],
  other: { allergies: null, diet: null, access: null },
  note: 'Carries an adrenaline pen; his wife Akosua knows where it is.',
};

export const HAUWA_NEEDS: Needs = {
  ...NO_NEEDS,
  allergies: ['milk'],
  diet: ['vegetarian'],
};

export const OTHER_LONG =
  'Kiwi, and anything cooked in the same pan as kiwi, including the dessert sauce, the fruit salad and any garnish on the plate';
