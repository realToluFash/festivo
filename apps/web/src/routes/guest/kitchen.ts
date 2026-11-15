import {
  ALLERGENS,
  type AccessNeed,
  type Allergen,
  DIETS,
  type Diet,
  type GuestPage,
  type GuestPageNeeds,
  NEED_OTHER_MAXIMUM,
  type NeedsChange,
  type PageNeeds,
  type PlaceNeeds,
} from '@soirely/api-client';

import { needsLength } from '@soirely/domain';
import { type Party, comingWith, placeOf } from './party.ts';

export type Field = 'other' | 'words' | 'access';
export const FIELDS: readonly Field[] = ['other', 'words', 'access'];

export const YOU = 'me';

/** One card on Anything the kitchen must know? (sc-3778): the guest ("You"), or a place left Coming by its id, named or not. `place` labels an unnamed one as Who's coming with you? does: 0 for "Your guest", else its position (sc-48740). `words` is Diet · Other and `access` is Access · Other; `host` are the access codes the hosts picked, which the guest may only remove. */
export interface Person {
  key: string;
  name: string | null;
  place: number | null;
  allergies: readonly Allergen[];
  other: string;
  diet: readonly Diet[];
  words: string;
  access: string;
  host: readonly AccessNeed[];
  removed: readonly AccessNeed[];
  changed: NeedsChange | null;
}

export interface Kitchen {
  people: readonly Person[];
  /** Anyone coming has something recorded: the secondary button is Leave it as it is, not Nothing to add. */
  record: boolean;
  tried: boolean;
  /** Left by Nothing to add or Leave it as it is: Send my answer sends no needs, so the record stays. */
  left: boolean;
}

function blank(key: string, name: string | null, place: number | null = null): Person {
  return {
    key,
    name,
    place,
    allergies: [],
    other: '',
    diet: [],
    words: '',
    access: '',
    host: [],
    removed: [],
    changed: null,
  };
}

function personOf(key: string, needs: GuestPageNeeds | null): Person {
  if (needs == null) return blank(key, null);

  return {
    key,
    name: null,
    place: null,
    allergies: needs.allergies,
    other: needs.otherAllergy ?? '',
    diet: needs.diet.filter((code): code is Diet => code !== 'other'),
    words: needs.otherDiet ?? '',
    access: needs.otherAccess ?? '',
    host: needs.access.filter((code) => code !== 'other'),
    removed: [],
    changed: needs.changed,
  };
}

function hasAny(needs: GuestPageNeeds): boolean {
  return needs.allergies.length > 0 || needs.diet.length > 0 || needs.access.length > 0;
}

function recordedPeople(page: GuestPage): Person[] {
  return [
    personOf(YOU, page.guest.needs),
    ...page.guest.companions.map((one) => personOf(one.id, one.needs)),
    ...page.guest.unnamed.map((one) => personOf(one.id, one.needs)),
  ];
}

interface Coming {
  key: string;
  name: string | null;
  place: number | null;
}

/** The guest, then each place left Coming on Who's coming with you?, in its order (sc-48740). */
function comingPeople(party: Party): Coming[] {
  return [
    { key: YOU, name: null, place: null },
    ...comingWith(party).map((one) => ({
      key: one.id,
      name: one.name,
      place: one.name == null ? placeOf(party, one.id) : null,
    })),
  ];
}

function fromRecord(recorded: readonly Person[], { key, name, place }: Coming): Person {
  const one = recorded.find((each) => each.key === key);

  return one == null ? blank(key, name, place) : { ...one, name, place };
}

/** The guest and each place coming, keeping what was chosen on the step so far, then the record, then nothing; a place marked Not coming keeps its card for when it is Coming again. */
export function kitchenOf(page: GuestPage, party: Party, was: Kitchen | null): Kitchen {
  const recorded = recordedPeople(page);
  const kept = (coming: Coming): Person => {
    const one = was?.people.find((each) => each.key === coming.key);

    return one == null
      ? fromRecord(recorded, coming)
      : { ...one, name: coming.name, place: coming.place };
  };

  return {
    people: comingPeople(party).map(kept),
    record: [
      page.guest.needs,
      ...page.guest.companions.map((one) => one.needs),
      ...page.guest.unnamed.map((one) => one.needs),
    ].some(hasAny),
    tried: false,
    left: false,
  };
}

/** Nothing to add clears every card; Leave it as it is puts the record back. Neither is sent as a change. */
export function skipped(kitchen: Kitchen, page: GuestPage): Kitchen {
  const recorded = recordedPeople(page);

  return {
    ...kitchen,
    tried: false,
    left: true,
    people: kitchen.people.map((one) =>
      kitchen.record ? fromRecord(recorded, one) : blank(one.key, one.name, one.place),
    ),
  };
}

function trimmed(one: Person): Person {
  return {
    ...one,
    other: one.allergies.includes('other') ? one.other.trim() : '',
    words: one.words.trim(),
    access: one.access.trim(),
  };
}

function kept(one: Person): AccessNeed[] {
  return one.host.filter((code) => !one.removed.includes(code));
}

/** sc-3777's record for one person: words in Anything else or the access line tick that Other, and empty ones leave it unticked. */
export function needsOf(one: Person): PageNeeds {
  const sent = trimmed(one);
  const access = kept(sent);

  return {
    allergies: [...sent.allergies],
    otherAllergy: sent.other === '' ? null : sent.other,
    diet: sent.words === '' ? [...sent.diet] : [...sent.diet, 'other'],
    otherDiet: sent.words === '' ? null : sent.words,
    access: sent.access === '' ? access : [...access, 'other'],
    otherAccess: sent.access === '' ? null : sent.access,
  };
}

/** The kitchen needs alone, as they are sent after Reply by (sc-3780): each place's by its id, named or left unnamed. */
export function placeNeeds(
  kitchen: Kitchen,
  page: GuestPage,
): { companions: PlaceNeeds[]; unnamed: PlaceNeeds[] } {
  const left = new Set(page.guest.unnamed.map((one) => one.id));
  const places = kitchen.people.filter((one) => one.key !== YOU);
  const sent = (one: Person): PlaceNeeds => ({ id: one.key, needs: needsOf(one) });

  return {
    companions: places.filter((one) => !left.has(one.key)).map(sent),
    unnamed: places.filter((one) => left.has(one.key)).map(sent),
  };
}

export interface WhoWords {
  you: string;
  yourGuest: string;
  yourGuestN: (n: number) => string;
}

export function whoOf(one: Person, words: WhoWords): string {
  if (one.key === YOU) return words.you;
  if (one.name != null) return one.name;

  return one.place == null || one.place === 0 ? words.yourGuest : words.yourGuestN(one.place);
}

export type Problem = 'empty' | 'long';

function tooLong(text: string): boolean {
  return needsLength(text) > NEED_OTHER_MAXIMUM;
}

export function problemsOf(one: Person): Record<Field, Problem | null> {
  const other = one.allergies.includes('other')
    ? one.other.trim() === ''
      ? 'empty'
      : tooLong(one.other)
        ? 'long'
        : null
    : null;

  return {
    other,
    words: tooLong(one.words) ? 'long' : null,
    access: tooLong(one.access) ? 'long' : null,
  };
}

export function fieldId(field: Field, key: string): string {
  return `gk-${field}-${key}`;
}

export function firstProblem(kitchen: Kitchen): string | null {
  for (const one of kitchen.people) {
    const problems = problemsOf(one);
    const field = FIELDS.find((each) => problems[each] != null);
    if (field != null) return fieldId(field, one.key);
  }

  return null;
}

export function toggled<T extends string>(list: readonly T[], code: T, order: readonly T[]): T[] {
  const next = list.includes(code) ? list.filter((one) => one !== code) : [...list, code];

  return next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export const ALLERGEN_ORDER: readonly Allergen[] = ALLERGENS;
export const DIET_CHIPS: readonly Diet[] = DIETS.filter((code) => code !== 'other');

export interface KitchenWords {
  allergen: (code: Allergen) => string;
  diet: (code: Diet) => string;
  access: (code: AccessNeed) => string;
  lower: (text: string) => string;
  list: (items: readonly string[]) => string;
  allergyLine: (list: string, count: number) => string;
  quote: (text: string) => string;
  removed: (label: string) => string;
  gettingIn: (text: string) => string;
  nothing: string;
}

/** The card's line once an allergy is picked: the names in a list, lower case after the first, Other's words as typed. */
export function allergyNames(one: Person, words: KitchenWords): string[] {
  const coded = one.allergies
    .filter((code) => code !== 'other')
    .map((code, at) => (at === 0 ? words.allergen(code) : words.lower(words.allergen(code))));
  const typed = one.allergies.includes('other') ? one.other.trim() : '';

  return typed === '' ? coded : [...coded, typed];
}

export interface Line {
  text: string;
  allergy: boolean;
  quiet: boolean;
}

/** Check and send's For the kitchen, per person in the order a cook reads it, or Nothing to add once when nobody has anything. */
export function kitchenLines(
  kitchen: Kitchen,
  who: (one: Person) => string,
  words: KitchenWords,
): { who: string | null; lines: Line[] }[] {
  const line = (text: string, extra: Partial<Line> = {}): Line => ({
    text,
    allergy: false,
    quiet: false,
    ...extra,
  });
  const people = kitchen.people.map((one) => {
    const sent = trimmed(one);
    const allergies = [
      ...sent.allergies
        .filter((code) => code !== 'other')
        .map((code) => words.lower(words.allergen(code))),
      ...(sent.other === '' ? [] : [sent.other]),
    ];
    const lines: Line[] = [];

    if (allergies.length > 0) {
      lines.push(
        line(words.allergyLine(words.list(allergies), allergies.length), { allergy: true }),
      );
    }
    if (sent.diet.length > 0) {
      const named = sent.diet.map((code, at) =>
        at === 0 ? words.diet(code) : words.lower(words.diet(code)),
      );
      lines.push(line(named.join(', ')));
    }
    if (sent.words !== '') lines.push(line(words.quote(sent.words)));
    for (const code of kept(sent)) lines.push(line(words.access(code)));
    for (const code of sent.removed) {
      lines.push(line(words.removed(words.access(code)), { quiet: true }));
    }
    if (sent.access !== '') lines.push(line(words.gettingIn(sent.access)));

    return { who: who(one), lines };
  });
  const nothing = line(words.nothing, { quiet: true });

  if (people.every((one) => one.lines.length === 0)) return [{ who: null, lines: [nothing] }];

  return people.map((one) => (one.lines.length > 0 ? one : { ...one, lines: [nothing] }));
}
