import type { View, Visit } from './guest.ts';
import { type Access, type Allergen, type Diet, type KitchenWords } from './kitchenWords.ts';
import type { DemoLink } from './settings.ts';

export const MOST = 100;

export type From = 'answer' | 'changing' | 'closed';
export type Field = 'other' | 'words' | 'access';
export const FIELDS: readonly Field[] = ['other', 'words', 'access'];

/** One person's record in sc-3777's shape: the guest (no name, "You") or a companion. Never the hosts' private note. */
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

export interface Kitchen {
  people: readonly Person[];
  record: readonly Person[] | null;
  tried: boolean;
  alert: 'refused' | 'ruled' | 'net' | null;
  meals: boolean;
  refuses: boolean;
  fails: boolean;
  from: From;
}

/** The two companions named on the sample's invitation (the board draws one, Chidi Okonkwo-Williams). */
export const COMPANION_NAMES = ['Ana Paula Albuquerque', 'Rafael Albuquerque Santos'] as const;

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
    ...COMPANION_NAMES.slice(0, companions).map((name, at) => person(`c${at + 1}`, name)),
  ];
}

export function fromRecord(record: readonly Person[]): Person[] {
  return record.map((one) => ({ ...one, removed: [] }));
}

function recorded(companions: number, earlier: string): Person[] {
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

export function errorsOf(one: Person): Record<Field, 'empty' | 'long' | null> {
  const long = (text: string) => (Array.from(text.trim()).length > MOST ? 'long' : null);
  const other = one.allergies.includes('other')
    ? one.other.trim() === ''
      ? 'empty'
      : long(one.other)
    : null;

  return { other, words: long(one.words), access: long(one.access) };
}

export function fieldId(field: Field, key: string): string {
  return `k-${field}-${key}`;
}

export function firstError(kitchen: Kitchen): string | null {
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

export function changes(kitchen: Kitchen): boolean {
  const before = kitchen.record ?? blankParty(kitchen.people.length - 1);

  return kitchen.people.some((one, at) => {
    const was = before[at];

    return was == null || picksOf(one) !== picksOf(was);
  });
}

/** What Send records: each changed person's picks, last changed by the guest today; removed rows gone. */
export function saved(kitchen: Kitchen, today: string): Person[] {
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

/** Check and send's For the kitchen: per person in the order a cook reads it, or Nothing to add once when nobody has anything. */
export function kitchenLines(
  kitchen: Kitchen,
  words: KitchenWords,
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

    return { who: one.name ?? words.say('you'), lines };
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

export function mealRows(kitchen: Kitchen, words: KitchenWords): MealRow[] {
  if (!kitchen.meals) return [];

  return kitchen.people.map((one) => {
    const row =
      one.name == null ? words.say('yourMeals') : words.say('theirMeals', { name: one.name });
    const dishes = (MEALS[one.key] ?? MEALS.me ?? []).map((dish) => {
      const hit = dish.allergens.filter((code) => one.allergies.includes(code));
      const list = words.list(hit.map((code) => words.lower(words.allergen(code))));
      const reason =
        hit.length === 0
          ? null
          : one.name == null
            ? words.say('reasonYou', { list })
            : words.say('reason', { name: one.name, list });

      return { name: dish.name, reason };
    });

    return { key: one.key, row, dishes };
  });
}

export function mealsId(key: string): string {
  return `k-meals-${key}`;
}

export function ruledOut(kitchen: Kitchen): string | null {
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
const KITCHEN_STATES = {
  kitchen: 'Anything the kitchen must know?, a first reply, nothing picked',
  kitchen_alone: 'Coming alone: one card, “You”',
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

export type KitchenState = keyof typeof KITCHEN_STATES;

export function isKitchenState(value: string | null): value is KitchenState {
  return value != null && Object.hasOwn(KITCHEN_STATES, value);
}

export const KITCHEN_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The kitchen step',
    states: (Object.keys(KITCHEN_STATES) as KitchenState[]).map((state) => ({
      to: `/demo/guest?state=${state}`,
      name: KITCHEN_STATES[state],
    })),
  },
];

const RETURNING: readonly KitchenState[] = [
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
const SEEDS: Partial<Record<KitchenState, Record<string, Partial<Person>>>> = {
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

const CHECK_STATES: readonly KitchenState[] = [
  'check_and_send',
  'kitchen_nothing',
  'kitchen_sending',
  'kitchen_not_sent',
  'meal_ruled_out',
  'refused',
];

const FOCUS: Partial<Record<KitchenState, string>> = {
  kitchen_picked: 'chip-me-sesame',
  kitchen_say_which: fieldId('other', 'me'),
  kitchen_access_removed: 'keep-me-step_free',
  kitchen_sending: 'send',
  kitchen_not_sent: 'send',
  meal_ruled_out: mealsId('c1'),
  refused: 'send',
};

export function kitchenStarts(
  state: KitchenState,
  { earlier }: { earlier: string },
): Partial<Visit> {
  const companions = state === 'kitchen_alone' ? 0 : COMPANION_NAMES.length;
  const returning = RETURNING.includes(state);
  const record = returning ? recorded(companions, earlier) : null;
  const picks: Partial<Record<string, Partial<Person>>> = SEEDS[state] ?? {};
  const people = (record == null ? blankParty(companions) : fromRecord(record)).map((one) => ({
    ...one,
    ...picks[one.key],
  }));

  const from: From = returning ? 'changing' : 'answer';
  const kitchen: Kitchen = {
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
    fails: false,
    from,
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
