import type { View, Visit } from './guest.ts';
import {
  type Access,
  type Allergen,
  type Diet,
  type GuestKitchenWords,
} from './guestKitchenWords.ts';
import { type Needs, otherError } from './guestNeeds.ts';
import type { DemoLink } from './settings.ts';

export type From = 'answer' | 'changing' | 'closed';
export type Field = 'other' | 'words' | 'access';
export const FIELDS: readonly Field[] = ['other', 'words', 'access'];

/** One person's answer on the guest's step: the guest (no name, "You") or a companion. Not the record: `recordOf` maps it onto sc-3777's `Needs`. Never the hosts' private note. */
export interface Person {
  key: string;
  name: string | null;
  allergies: readonly Allergen[];
  other: string;
  diet: readonly Diet[];
  words: string;
  access: string;
  host: readonly Access[];
  removed: readonly Access[];
  by: 'hosts' | 'you' | null;
  on: string | null;
}

export interface GuestKitchen {
  people: readonly Person[];
  record: readonly Person[] | null;
  tried: boolean;
  alert: 'refused' | 'ruled' | 'net' | null;
  meals: boolean;
  refuses: boolean;
  from: From;
  saved: boolean;
}

const LONG =
  'Raw tomato and raw pepper, and anything fried in the same oil as the prawns, even when there are no prawns in it';
const HOSTS_ON = '2026-10-03';

function person(key: string, name: string | null, extra: Partial<Person> = {}): Person {
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
    by: null,
    on: null,
    ...extra,
  };
}

export function blankParty(companions: number): Person[] {
  return [
    person('me', null),
    ...Array.from({ length: companions }, (_, at) => person(`c${at + 1}`, null)),
  ];
}

/** You, a companion's name, or for one the host never named "Your guest", "Your first guest", … (pm and ux, 8 Nov). */
export function whoOf(one: Person, people: readonly Person[], words: GuestKitchenWords): string {
  if (one.key === 'me') return words.say('you');
  if (one.name != null) return one.name;
  const companions = people.filter((each) => each.key !== 'me');

  return companions.length === 1 ? words.say('yourGuest') : words.nth(companions.indexOf(one) + 1);
}

export function fromRecord(record: readonly Person[]): Person[] {
  return record.map((one) => ({ ...one, removed: [] }));
}

export function recorded(companions: number, earlier: string): Person[] {
  const [me, ...others] = blankParty(companions);
  const picks: Partial<Person>[] = [
    { diet: ['vegetarian'], access: 'A seat I can reach without stairs', by: 'you', on: earlier },
    {},
  ];

  return [
    {
      ...(me as Person),
      allergies: ['peanuts', 'sesame'],
      diet: ['halal'],
      host: ['step_free', 'near_exit'],
      by: 'hosts',
      on: HOSTS_ON,
    },
    ...others.map((one, at) => ({ ...one, ...picks[at] })),
  ];
}

/** After the date to answer by, Update what the kitchen should know opens the record on its own (sc-3780). */
export function closedKitchen(
  companions: number,
  earlier: string,
  { saved = false, failed = false }: { saved?: boolean; failed?: boolean } = {},
): GuestKitchen {
  const record = recorded(companions, earlier);
  const people = fromRecord(record).map((one) =>
    failed && one.key === 'me' ? { ...one, words: 'No raw onion, please.' } : one,
  );

  return {
    people,
    record,
    tried: false,
    alert: failed ? 'net' : null,
    meals: false,
    refuses: false,
    from: 'closed',
    saved,
  };
}

export function errorsOf(one: Person): Record<Field, 'empty' | 'long' | null> {
  const other = one.allergies.includes('other') ? otherError(one.other, true) : null;

  return { other, words: otherError(one.words, false), access: otherError(one.access, false) };
}

/** sc-3778's AC: "Anything else" is Diet · Other and the access line is Access · Other, each recorded only with words; the host's access codes stay unless removed. */
export function recordOf(one: Person): Omit<Needs, 'note'> {
  const kept = trimmed(one);
  const host = kept.host.filter((code) => !kept.removed.includes(code));

  return {
    allergies: kept.allergies,
    otherAllergy: kept.other,
    diet: kept.words === '' ? kept.diet : [...kept.diet, 'other'],
    otherDiet: kept.words,
    access: kept.access === '' ? host : [...host, 'other'],
    otherAccess: kept.access,
  };
}

export function fieldId(field: Field, key: string): string {
  return `k-${field}-${key}`;
}

export function firstError(kitchen: GuestKitchen): string | null {
  for (const one of kitchen.people) {
    const errors = errorsOf(one);
    const field = FIELDS.find((each) => errors[each] != null);
    if (field != null) return fieldId(field, one.key);
  }

  return null;
}

export function toggled<T extends string>(list: readonly T[], code: T, order: readonly T[]): T[] {
  const next = list.includes(code) ? list.filter((one) => one !== code) : [...list, code];

  return next.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

function trimmed(one: Person): Person {
  return {
    ...one,
    other: one.allergies.includes('other') ? one.other.trim() : '',
    words: one.words.trim(),
    access: one.access.trim(),
  };
}

function picksOf(one: Person) {
  const kept = trimmed(one);

  return JSON.stringify([
    kept.allergies,
    kept.other,
    kept.diet,
    kept.words,
    kept.access,
    kept.host.filter((code) => !kept.removed.includes(code)),
  ]);
}

export function changes(kitchen: GuestKitchen): boolean {
  const before = kitchen.record ?? blankParty(kitchen.people.length - 1);

  return kitchen.people.some((one, at) => {
    const was = before[at];

    return was == null || picksOf(one) !== picksOf(was);
  });
}

/** What Send records: each changed person's picks, last changed by the guest today; removed rows gone. */
export function saved(kitchen: GuestKitchen, today: string): Person[] {
  const before = kitchen.record ?? blankParty(kitchen.people.length - 1);

  return kitchen.people.map((one, at) => {
    const was = before[at];
    const kept = trimmed(one);
    const host = kept.host.filter((code) => !kept.removed.includes(code));
    const same = was != null && picksOf(one) === picksOf(was);

    return {
      ...kept,
      host,
      removed: [],
      by: same ? kept.by : 'you',
      on: same ? kept.on : today,
    };
  });
}

/** The card's line once an allergy is picked: the names in a list, lower case after the first, Other's words as typed. */
export function allergyNames(one: Person, words: GuestKitchenWords): string[] {
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

/** Check and send's For the kitchen: per person in the order a cook reads it, or Nothing to add once when nobody has anything. */
export function guestKitchenLines(
  kitchen: GuestKitchen,
  words: GuestKitchenWords,
): { who: string | null; lines: Line[] }[] {
  const line = (text: string, extra: Partial<Line> = {}): Line => ({
    text,
    allergy: false,
    quiet: false,
    ...extra,
  });
  const people = kitchen.people.map((one) => {
    const kept = trimmed(one);
    const allergies = [
      ...kept.allergies
        .filter((code) => code !== 'other')
        .map((code) => words.lower(words.allergen(code))),
      ...(kept.other === '' ? [] : [kept.other]),
    ];
    const lines: Line[] = [];

    if (allergies.length > 0) {
      lines.push(
        line(words.many('allergyLine', allergies.length, { list: words.list(allergies) }), {
          allergy: true,
        }),
      );
    }
    if (kept.diet.length > 0) {
      const named = kept.diet.map((code, at) =>
        at === 0 ? words.diet(code) : words.lower(words.diet(code)),
      );
      lines.push(line(named.join(', ')));
    }
    if (kept.words !== '') lines.push(line(words.say('quote', { text: kept.words })));
    for (const code of kept.host.filter((each) => !kept.removed.includes(each))) {
      lines.push(line(words.access(code)));
    }
    for (const code of kept.removed) {
      lines.push(line(words.say('removed', { label: words.access(code) }), { quiet: true }));
    }
    if (kept.access !== '') lines.push(line(words.say('gettingIn', { text: kept.access })));

    return { who: whoOf(one, kitchen.people, words), lines };
  });
  const nothing = line(words.say('nothingRow'), { quiet: true });

  if (people.every((one) => one.lines.length === 0)) return [{ who: null, lines: [nothing] }];

  return people.map((one) => (one.lines.length > 0 ? one : { ...one, lines: [nothing] }));
}

/** sc-3907's sample picks and their allergens (MealStep.dc.html), for meal_ruled_out only. */
const MEALS: Record<string, readonly { name: string; allergens: readonly Allergen[] }[]> = {
  me: [
    { name: 'Canapé selection', allergens: ['gluten', 'fish', 'milk'] },
    { name: 'Jollof rice with grilled chicken', allergens: ['celery'] },
    { name: 'Fresh fruit', allergens: [] },
  ],
  c1: [
    { name: 'Canapé selection', allergens: ['gluten', 'fish', 'milk'] },
    { name: 'Jollof rice with grilled fish', allergens: ['fish'] },
    { name: 'Fresh fruit', allergens: [] },
  ],
};

export interface MealRow {
  key: string;
  row: string;
  dishes: { name: string; reason: string | null }[];
}

export function mealRows(kitchen: GuestKitchen, words: GuestKitchenWords): MealRow[] {
  if (!kitchen.meals) return [];

  return kitchen.people.map((one) => {
    const you = one.key === 'me';
    const name = whoOf(one, kitchen.people, words);
    const row = you ? words.say('yourMeals') : words.say('theirMeals', { name });
    const dishes = (MEALS[one.key] ?? MEALS.me ?? []).map((dish) => {
      const hit = dish.allergens.filter((code) => one.allergies.includes(code));
      const list = words.list(hit.map((code) => words.lower(words.allergen(code))));
      const reason =
        hit.length === 0
          ? null
          : you
            ? words.say('reasonYou', { list })
            : words.say('reason', { name, list });

      return { name: dish.name, reason };
    });

    return { key: one.key, row, dishes };
  });
}

export function mealsId(key: string): string {
  return `k-meals-${key}`;
}

export function ruledOut(kitchen: GuestKitchen): string | null {
  if (!kitchen.meals) return null;
  for (const one of kitchen.people) {
    const meals = MEALS[one.key] ?? MEALS.me ?? [];
    if (meals.some((dish) => dish.allergens.some((code) => one.allergies.includes(code)))) {
      return mealsId(one.key);
    }
  }

  return null;
}

/** The board's Page states for sc-3778, kitchen to refused, and the step's own: alone, nothing to add, sending and not sent. */
const GUEST_KITCHEN_STATES = {
  kitchen: 'Anything the kitchen must know?, a first reply, nothing picked',
  kitchen_alone: 'Coming alone: one card, “You”',
  kitchen_one_guest: 'One companion the host never named: “Your guest”',
  kitchen_picked: 'Allergies and a diet picked',
  kitchen_say_which: 'Next pressed: Say which, and over 100 characters',
  kitchen_returning: 'Coming back: what is recorded, the hosts’ picks included',
  kitchen_access_removed: 'A host’s access need removed, until Send',
  check_and_send: 'Check and send, For the kitchen',
  kitchen_nothing: 'Check and send after Nothing to add',
  kitchen_sending: 'Sending, with For the kitchen',
  kitchen_not_sent: 'A send that failed, with For the kitchen',
  meal_ruled_out: 'An allergy that rules out a meal picked earlier (sc-3907)',
  refused: 'Not saved: this page is out of date (422)',
} as const;

export type GuestKitchenState = keyof typeof GUEST_KITCHEN_STATES;

export function isGuestKitchenState(value: string | null): value is GuestKitchenState {
  return value != null && Object.hasOwn(GUEST_KITCHEN_STATES, value);
}

export const GUEST_KITCHEN_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The kitchen step',
    states: (Object.keys(GUEST_KITCHEN_STATES) as GuestKitchenState[]).map((state) => ({
      to: `/demo/guest?state=${state}`,
      name: GUEST_KITCHEN_STATES[state],
    })),
  },
];

const RETURNING: readonly GuestKitchenState[] = [
  'kitchen_returning',
  'kitchen_access_removed',
  'check_and_send',
  'kitchen_sending',
  'kitchen_not_sent',
  'meal_ruled_out',
  'refused',
];

const REMOVED: Partial<Person> = { removed: ['step_free'] };
const SENDING: Record<string, Partial<Person>> = {
  me: { removed: ['step_free'], words: 'No raw onion, please.' },
};

/** What each state has picked over the record (or over nothing, for a first reply): the board's kitSeed. */
const SEEDS: Partial<Record<GuestKitchenState, Record<string, Partial<Person>>>> = {
  kitchen_picked: {
    me: { allergies: ['peanuts', 'sesame'], diet: ['halal'] },
    c1: { diet: ['vegetarian'] },
  },
  kitchen_say_which: {
    me: { allergies: ['peanuts', 'other'] },
    c1: { allergies: ['other'], other: LONG },
  },
  kitchen_access_removed: { me: REMOVED },
  check_and_send: SENDING,
  kitchen_sending: SENDING,
  kitchen_not_sent: SENDING,
  refused: SENDING,
  meal_ruled_out: { c1: { allergies: ['milk'] } },
};

const CHECK_STATES: readonly GuestKitchenState[] = [
  'check_and_send',
  'kitchen_nothing',
  'kitchen_sending',
  'kitchen_not_sent',
  'meal_ruled_out',
  'refused',
];

const FOCUS: Partial<Record<GuestKitchenState, string>> = {
  kitchen_picked: 'chip-me-sesame',
  kitchen_say_which: fieldId('other', 'me'),
  kitchen_access_removed: 'keep-me-step_free',
  kitchen_sending: 'send',
  kitchen_not_sent: 'send',
  meal_ruled_out: mealsId('c1'),
  refused: 'send',
};

export function guestKitchenStarts(
  state: GuestKitchenState,
  { earlier, companions: invited }: { earlier: string; companions: number },
): Partial<Visit> {
  const companions = state === 'kitchen_alone' ? 0 : state === 'kitchen_one_guest' ? 1 : invited;
  const returning = RETURNING.includes(state);
  const record = returning ? recorded(companions, earlier) : null;
  const picks: Partial<Record<string, Partial<Person>>> = SEEDS[state] ?? {};
  const people = (record == null ? blankParty(companions) : fromRecord(record)).map((one) => ({
    ...one,
    ...picks[one.key],
  }));

  const from: From = returning ? 'changing' : 'answer';
  const kitchen: GuestKitchen = {
    people,
    record,
    tried: state === 'kitchen_say_which',
    alert:
      state === 'refused'
        ? 'refused'
        : state === 'meal_ruled_out'
          ? 'ruled'
          : state === 'kitchen_not_sent'
            ? 'net'
            : null,
    meals: state === 'meal_ruled_out',
    refuses: state === 'refused',
    from,
    saved: false,
  };
  const view: View = CHECK_STATES.includes(state)
    ? {
        kind: 'check',
        busy: state === 'kitchen_sending',
        failed: false,
        refused: false,
        from: from === 'changing' ? 'changing' : 'answer',
      }
    : { kind: 'kitchen' };

  return {
    recorded: returning ? { answer: 'coming', on: earlier } : null,
    companionsComing: companions,
    view,
    kitchen,
    want: FOCUS[state] ?? (view.kind === 'check' ? 'checkHead' : 'kitchenHead'),
  };
}
