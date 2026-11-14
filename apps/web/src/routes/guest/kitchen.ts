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

import { lengthOf } from '../app/events/guestNeeds.ts';
import type { Party } from './party.ts';

export type Field = 'other' | 'words' | 'access';
export const FIELDS: readonly Field[] = ['other', 'words', 'access'];

export const YOU = 'me';
const PLACE = 'place-';

function placeKey(id: string): string {
  return `${PLACE}${id}`;
}

/** One card on Anything the kitchen must know? (sc-3778): the guest ("You"), a companion coming, or a place nobody named (no name, "Your guest"). `words` is Diet · Other and `access` is Access · Other; `host` are the access codes the hosts picked, which the guest may only remove. */
export interface Person {
  key: string;
  name: string | null;
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

function blank(key: string, name: string | null): Person {
  return {
    key,
    name,
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

function personOf(key: string, name: string | null, needs: GuestPageNeeds | null): Person {
  if (needs == null) return blank(key, name);

  return {
    key,
    name,
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
    personOf(YOU, null, page.guest.needs),
    ...page.guest.companions.map((one) => personOf(one.id, one.fullName, one.needs)),
    ...page.guest.unnamed.map((one) => personOf(placeKey(one.id), null, one.needs)),
  ];
}

interface Coming {
  key: string;
  name: string | null;
  /** The record this card starts from: a name the guest added fills the next unnamed place, in order, and keeps its needs. */
  from: string;
}

function comingPeople(page: GuestPage, party: Party): Coming[] {
  const added = party.people.filter((one) => one.id == null);
  const place = (key: string): string => {
    const one = page.guest.unnamed[added.findIndex((each) => each.key === key)];

    return one == null ? key : placeKey(one.id);
  };

  return [
    ...party.people
      .filter((one) => one.coming)
      .map((one) => ({
        key: one.key,
        name: one.name,
        from: one.id == null ? place(one.key) : one.key,
      })),
    ...page.guest.unnamed
      .slice(added.length)
      .map((one) => ({ key: placeKey(one.id), name: null, from: placeKey(one.id) })),
  ];
}

function fromRecord(
  recorded: readonly Person[],
  from: string,
  key: string,
  name: string | null,
): Person {
  const one = recorded.find((each) => each.key === from);

  return one == null ? blank(key, name) : { ...one, key, name };
}

/** The guest and each companion coming, keeping what was chosen on the step so far, then the record, then nothing. */
export function kitchenOf(page: GuestPage, party: Party, was: Kitchen | null): Kitchen {
  const recorded = recordedPeople(page);
  const kept = ({ key, name, from }: Coming): Person => {
    const one = was?.people.find((each) => each.key === key);

    return one == null ? fromRecord(recorded, from, key, name) : { ...one, name };
  };
  const people = [
    kept({ key: YOU, name: null, from: YOU }),
    ...comingPeople(page, party).map(kept),
  ];

  return {
    people,
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
export function skipped(kitchen: Kitchen, page: GuestPage, party: Party): Kitchen {
  const recorded = recordedPeople(page);
  const from = new Map(comingPeople(page, party).map((one) => [one.key, one.from]));

  return {
    ...kitchen,
    tried: false,
    left: true,
    people: kitchen.people.map((one) =>
      kitchen.record
        ? fromRecord(recorded, from.get(one.key) ?? one.key, one.key, one.name)
        : blank(one.key, one.name),
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

export function unnamedNeeds(kitchen: Kitchen): PlaceNeeds[] {
  return kitchen.people
    .filter((one) => one.key.startsWith(PLACE))
    .map((one) => ({ id: one.key.slice(PLACE.length), needs: needsOf(one) }));
}

export interface WhoWords {
  you: string;
  yourGuest: string;
  yourGuestN: (n: number) => string;
}

export function whoOf(one: Person, people: readonly Person[], words: WhoWords): string {
  if (one.key === YOU) return words.you;
  if (one.name != null) return one.name;
  const companions = people.filter((each) => each.key !== YOU);

  return companions.length === 1 ? words.yourGuest : words.yourGuestN(companions.indexOf(one) + 1);
}

export type Problem = 'empty' | 'long';

function tooLong(text: string): boolean {
  return lengthOf(text) > NEED_OTHER_MAXIMUM;
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
