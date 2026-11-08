import { type PluralBase, demoWords } from './demoWords.ts';

/** The kitchen sheet's Changes since (sc-30692): the sheet now against the latest copy, matched by record, in the sheet's order. Words in [brackets] are not settled yet; they are [en]'s. */
export const CW = {
  since: 'Since {{date}} at {{time}}',
  none: 'No changes since {{date}} at {{time}}.',
  pdfHead: 'Changes since {{date}} at {{time}}',
  give: 'Give the changes…',
  milestone: 'Give the changes to the kitchen',
  allergyNew: 'New allergy: {{allergy}} ({{name}})',
  allergyGone: '[Allergy removed: {{allergy}} ({{name}})]',
  allergyMore_one: '{{count}} more {{allergy}} allergy',
  allergyMore_other: '{{count}} more {{allergy}} allergies',
  allergyFewer_one: '[{{count}} fewer {{allergy}} allergy]',
  allergyFewer_other: '[{{count}} fewer {{allergy}} allergies]',
  dietNew: '[New diet: {{diet}} ({{name}})]',
  dietGone: '[Diet removed: {{diet}} ({{name}})]',
  dietMore_one: '[{{count}} more {{diet}} diet]',
  dietMore_other: '[{{count}} more {{diet}} diets]',
  dietFewer_one: '[{{count}} fewer {{diet}} diet]',
  dietFewer_other: '[{{count}} fewer {{diet}} diets]',
  comingMore_one: '{{count}} more coming',
  comingMore_other: '{{count}} more coming',
  comingFewer_one: '[{{count}} fewer coming]',
  comingFewer_other: '[{{count}} fewer coming]',
  count: '{{dish}} {{old}} to {{new}}',
  added: 'Added: {{dish}}, {{count}}',
  removed: 'Removed: {{dish}}, was {{count}}',
  renamed: 'Renamed: {{old}}, now {{new}}',
  named: '{{dish}} · {{name}}',
} as const;

const { filled, many } = demoWords(CW);

export { filled as cw };

export const CODES: Record<string, { title: string; word: string }> = {
  peanut: { title: 'Peanuts', word: 'peanut' },
  shellfish: { title: 'Shellfish', word: 'shellfish' },
  gluten: { title: 'Gluten', word: 'gluten' },
  sesame: { title: 'Sesame', word: 'sesame' },
  halal: { title: 'Halal', word: 'halal' },
  vegetarian: { title: 'Vegetarian', word: 'vegetarian' },
  vegan: { title: 'Vegan', word: 'vegan' },
};

export interface Need {
  guest: string;
  name: string;
  allergies: readonly string[];
  diets: readonly string[];
  dishes: string;
}

export type ItemKind = 'dish' | 'variant' | 'side' | 'tail';

export interface Item {
  id: string;
  course: string;
  kind: ItemKind;
  name: string;
  parent: string | null;
  count: number;
}

export interface Course {
  id: string;
  name: string;
}

export interface Figures {
  coming: number;
  needs: readonly Need[];
  otherDiets: Readonly<Record<string, number>>;
  courses: readonly Course[];
  items: readonly Item[];
}

export type LineKind = 'allergy' | 'diet' | 'coming' | 'dish';

export interface Line {
  key: string;
  kind: LineKind;
  text: string;
}

export interface Reading {
  /** guests.manage: an allergy or diet change names the person. */
  names: boolean;
  /** Guests erased since the copy: counts only, for every reader. */
  erased: ReadonlySet<string>;
}

function word(code: string): string {
  return CODES[code]?.word ?? code;
}

export function codeTitle(code: string): string {
  return CODES[code]?.title ?? code;
}

function minus(a: readonly string[], b: readonly string[]): string[] {
  return a.filter((one) => !b.includes(one));
}

function needLines(
  copy: Figures,
  now: Figures,
  reading: Reading,
  kind: 'allergies' | 'diets',
): Line[] {
  const before = new Map(copy.needs.map((need) => [need.guest, need]));
  const after = new Map(now.needs.map((need) => [need.guest, need]));
  const guests = [
    ...now.needs.map((need) => need.guest),
    ...copy.needs.filter((need) => !after.has(need.guest)).map((need) => need.guest),
  ];
  const named: Line[] = [];
  const net = new Map<string, number>();
  const lineKind: LineKind = kind === 'allergies' ? 'allergy' : 'diet';

  for (const guest of guests) {
    const was = before.get(guest);
    const is = after.get(guest);
    const had = was?.[kind] ?? [];
    const has = is?.[kind] ?? [];
    const name = is?.name ?? was?.name ?? '';
    const counted = !reading.names || reading.erased.has(guest);

    for (const code of minus(has, had)) {
      if (counted) net.set(code, (net.get(code) ?? 0) + 1);
      else
        named.push({
          key: `${kind}-new-${guest}-${code}`,
          kind: lineKind,
          text: filled(kind === 'allergies' ? CW.allergyNew : CW.dietNew, {
            [kind === 'allergies' ? 'allergy' : 'diet']: word(code),
            name,
          }),
        });
    }

    for (const code of minus(had, has)) {
      if (counted) net.set(code, (net.get(code) ?? 0) - 1);
      else
        named.push({
          key: `${kind}-gone-${guest}-${code}`,
          kind: lineKind,
          text: filled(kind === 'allergies' ? CW.allergyGone : CW.dietGone, {
            [kind === 'allergies' ? 'allergy' : 'diet']: word(code),
            name,
          }),
        });
    }
  }

  const counts: Line[] = [];

  for (const [code, change] of net) {
    if (change === 0) continue;
    const slot = kind === 'allergies' ? 'allergy' : 'diet';
    const base = kind === 'allergies' ? 'allergy' : 'diet';
    const way = change > 0 ? 'More' : 'Fewer';

    counts.push({
      key: `${kind}-count-${code}`,
      kind: lineKind,
      text: many(`${base}${way}` as PluralBase<typeof CW>, Math.abs(change), {
        [slot]: word(code),
      }),
    });
  }

  return [...named, ...counts];
}

function shownName(item: Item, items: readonly Item[]): string {
  if (item.parent == null) return item.name;
  const dish = items.find((one) => one.id === item.parent);

  return filled(CW.named, { dish: dish?.name ?? '', name: item.name });
}

function courseOrder(copy: Figures, now: Figures): Course[] {
  const kept = new Set(now.courses.map((course) => course.id));

  return [...now.courses, ...copy.courses.filter((course) => !kept.has(course.id))];
}

/** A course's lines: its rows now, a rename before its count; then the dishes gone, as the copy named them; then the tail rows. */
function courseLines(course: Course, copy: Figures, now: Figures): Line[] {
  const was = new Map(copy.items.map((item) => [item.id, item]));
  const here = new Set(now.items.map((item) => item.id));
  const rows = now.items.filter((item) => item.course === course.id);
  const gone = copy.items.filter((item) => item.course === course.id && !here.has(item.id));
  const lines: Line[] = [];

  function rowLines(item: Item): void {
    const before = was.get(item.id);
    const name = shownName(item, now.items);

    if (before == null) {
      if (item.count > 0)
        lines.push({
          key: `added-${item.id}`,
          kind: 'dish',
          text: filled(CW.added, { dish: name, count: item.count }),
        });
      return;
    }

    if (before.name !== item.name) {
      const old =
        item.parent == null
          ? before.name
          : filled(CW.named, {
              dish: now.items.find((one) => one.id === item.parent)?.name ?? '',
              name: before.name,
            });
      lines.push({
        key: `renamed-${item.id}`,
        kind: 'dish',
        text: filled(CW.renamed, { old, new: item.name }),
      });
    }

    if (before.count !== item.count)
      lines.push({
        key: `count-${item.id}`,
        kind: 'dish',
        text: filled(CW.count, { dish: name, old: before.count, new: item.count }),
      });
  }

  function goneLine(item: Item): void {
    if (item.count === 0) return;
    const dish = item.parent == null ? null : now.items.find((one) => one.id === item.parent);
    const name =
      item.parent == null
        ? item.name
        : filled(CW.named, {
            dish: dish?.name ?? was.get(item.parent)?.name ?? '',
            name: item.name,
          });

    lines.push({
      key: `removed-${item.id}`,
      kind: 'dish',
      text: filled(CW.removed, { dish: name, count: item.count }),
    });
  }

  rows.filter((item) => item.kind !== 'tail').forEach(rowLines);
  gone.filter((item) => item.kind !== 'tail').forEach(goneLine);
  rows.filter((item) => item.kind === 'tail').forEach(rowLines);

  return lines;
}

/** Every change since the copy, in the sheet's order: allergies, diets, the number coming, then each course. */
export function changesSince(copy: Figures, now: Figures, reading: Reading): Line[] {
  const coming = now.coming - copy.coming;
  const comingLines: Line[] =
    coming === 0
      ? []
      : [
          {
            key: 'coming',
            kind: 'coming',
            text: many(coming > 0 ? 'comingMore' : 'comingFewer', Math.abs(coming)),
          },
        ];

  return [
    ...needLines(copy, now, reading, 'allergies'),
    ...needLines(copy, now, reading, 'diets'),
    ...comingLines,
    ...courseOrder(copy, now).flatMap((course) => courseLines(course, copy, now)),
  ];
}

export function dietCounts(figures: Figures): [string, number][] {
  const counts = new Map(Object.entries(figures.otherDiets));

  for (const need of figures.needs)
    for (const diet of need.diets) counts.set(diet, (counts.get(diet) ?? 0) + 1);

  return [...counts.entries()].filter(([, count]) => count > 0);
}

export function allergyCounts(figures: Figures): [string, number][] {
  const counts = new Map<string, number>();

  for (const need of figures.needs)
    for (const code of need.allergies) counts.set(code, (counts.get(code) ?? 0) + 1);

  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function allergic(figures: Figures): Need[] {
  return figures.needs.filter((need) => need.allergies.length > 0);
}

export function courseRows(
  figures: Figures,
  course: string,
): { id: string; name: string; count: number }[] {
  return figures.items
    .filter((item) => item.course === course)
    .map((item) => ({ id: item.id, name: shownName(item, figures.items), count: item.count }));
}

const NOT_CHOSEN = 'Not chosen yet';

const BASE_NEEDS: readonly Need[] = [
  need('amaka', 'Amaka Eze', ['peanut'], 'Pepper soup · Jollof rice with chicken · Fruit plate'),
  need(
    'kwame',
    'Kwame Mensah',
    ['shellfish'],
    'Burrata with peaches · Mushroom risotto · Chocolate tart',
  ),
  need('sophie', 'Sophie Laurent', ['gluten'], 'Pepper soup · Grilled sea bass · Fruit plate'),
  need(
    'yusuf',
    'Yusuf Ibrahim',
    ['sesame'],
    'Burrata with peaches · Jollof rice with chicken · Fruit plate',
  ),
  need('ines', 'Inês Duarte', ['peanut'], 'Pepper soup · Grilled sea bass · Chocolate tart'),
  need(
    'nadia',
    'Nadia Haddad',
    ['peanut'],
    'Burrata with peaches · Mushroom risotto · Fruit plate',
  ),
  need(
    'tomas',
    'Tomás Ferreira',
    ['shellfish'],
    'Pepper soup · Jollof rice with chicken · Chocolate tart',
  ),
];

function need(
  guest: string,
  name: string,
  allergies: readonly string[],
  dishes: string,
  diets: readonly string[] = [],
): Need {
  return { guest: `g-${guest}`, name, allergies, diets, dishes };
}

function item(
  id: string,
  name: string,
  count: number,
  kind: ItemKind = 'dish',
  parent: string | null = null,
): Item {
  return { id, course: id.slice(0, 1), kind, name, parent, count };
}

export const BASE: Figures = {
  coming: 96,
  needs: BASE_NEEDS,
  otherDiets: { halal: 18, vegetarian: 12, vegan: 4 },
  courses: [
    { id: 's', name: 'Starter' },
    { id: 'm', name: 'Main' },
    { id: 'd', name: 'Dessert' },
  ],
  items: [
    item('s-pepper', 'Pepper soup', 52),
    item('s-burrata', 'Burrata with peaches', 41),
    item('s-none', NOT_CHOSEN, 3, 'tail'),
    item('m-jollof', 'Jollof rice with chicken', 48),
    item('m-bass', 'Grilled sea bass', 30),
    item('m-risotto', 'Mushroom risotto', 15),
    item('m-none', NOT_CHOSEN, 3, 'tail'),
    item('d-tart', 'Chocolate tart', 53),
    item('d-fruit', 'Fruit plate', 40),
    item('d-none', NOT_CHOSEN, 3, 'tail'),
  ],
};

function counted(figures: Figures, counts: Readonly<Record<string, number>>): Figures {
  return {
    ...figures,
    items: figures.items.map((one) =>
      one.id in counts ? { ...one, count: counts[one.id] ?? 0 } : one,
    ),
  };
}

function swapped(needs: readonly Need[], from: string, to: string): Need[] {
  return needs.map((one) => ({ ...one, dishes: one.dishes.replaceAll(from, to) }));
}

const NGOZI_HALAL = need(
  'ngozi',
  'Ngozi Eze',
  [],
  'Pepper soup · Jollof rice with chicken · Chocolate tart',
  ['halal'],
);

/** Yusuf records sesame; Ngozi (halal) and one more guest start coming; one guest moves from sea bass to jollof. */
const NAMED_NOW: Figures = {
  ...BASE,
  needs: [...BASE_NEEDS, NGOZI_HALAL],
  otherDiets: { halal: 17, vegetarian: 12, vegan: 4 },
};

const NAMED_COPY: Figures = counted(
  {
    ...BASE,
    coming: 94,
    needs: BASE_NEEDS.map((one) => (one.guest === 'g-yusuf' ? { ...one, allergies: [] } : one)),
    otherDiets: { halal: 17, vegetarian: 12, vegan: 4 },
  },
  { 's-pepper': 50, 'm-jollof': 45, 'm-bass': 31, 'd-tart': 51 },
);

const MENU_NOW: Figures = {
  ...BASE,
  needs: swapped(
    swapped(BASE_NEEDS, 'Grilled sea bass', 'Pan-seared sea bass'),
    'Mushroom risotto',
    NOT_CHOSEN,
  ),
  items: [
    item('s-pepper', 'Pepper soup', 52),
    item('s-burrata', 'Burrata with peaches', 35),
    item('s-moimoi', 'Moi moi', 6),
    item('s-none', NOT_CHOSEN, 3, 'tail'),
    item('m-jollof', 'Jollof rice with chicken', 48),
    item('m-bass', 'Pan-seared sea bass', 32),
    item('m-none', NOT_CHOSEN, 16, 'tail'),
    item('d-tart', 'Chocolate tart', 53),
    item('d-fruit', 'Fruit plate', 40),
    item('d-none', NOT_CHOSEN, 3, 'tail'),
  ],
};

const VARIANT_ITEMS = (fish: string, chicken: number, fishCount: number, plantain: number) => [
  item('s-pepper', 'Pepper soup', 52),
  item('s-burrata', 'Burrata with peaches', 41),
  item('s-none', NOT_CHOSEN, 3, 'tail'),
  item('m-jollof', 'Jollof rice', 48),
  item('m-jollof-chicken', 'Chicken', chicken, 'variant', 'm-jollof'),
  item('m-jollof-fish', fish, fishCount, 'variant', 'm-jollof'),
  item('m-jollof-plantain', 'Plantain', plantain, 'side', 'm-jollof'),
  item('m-bass', 'Grilled sea bass', 30),
  item('m-risotto', 'Mushroom risotto', 15),
  item('m-none', NOT_CHOSEN, 3, 'tail'),
  item('d-tart', 'Chocolate tart', 53),
  item('d-fruit', 'Fruit plate', 40),
  item('d-none', NOT_CHOSEN, 3, 'tail'),
];

const VARIANT_NEEDS = swapped(BASE_NEEDS, 'Jollof rice with chicken', 'Jollof rice · Chicken');

const NGOZI = need(
  'ngozi',
  'Ngozi Eze',
  ['sesame'],
  'Pepper soup · Jollof rice with chicken · Fruit plate',
  ['vegetarian'],
);

/** Inês (peanut, halal) stops coming; Ngozi (sesame, vegetarian) starts. */
const PERSON_NOW: Figures = {
  ...BASE,
  needs: [...BASE_NEEDS.filter((one) => one.guest !== 'g-ines'), NGOZI],
  otherDiets: { halal: 18, vegetarian: 11, vegan: 4 },
};

const PERSON_COPY: Figures = counted(
  {
    ...BASE,
    needs: BASE_NEEDS.map((one) => (one.guest === 'g-ines' ? { ...one, diets: ['halal'] } : one)),
    otherDiets: { halal: 18, vegetarian: 11, vegan: 4 },
  },
  { 'm-jollof': 47, 'm-bass': 31, 'd-tart': 54, 'd-fruit': 39 },
);

/** Kwame (shellfish) is erased since the copy; Yusuf records sesame. */
const ERASED_NOW: Figures = {
  ...BASE,
  needs: BASE_NEEDS.filter((one) => one.guest !== 'g-kwame'),
};

const ERASED_COPY: Figures = counted(
  {
    ...BASE,
    coming: 97,
    needs: BASE_NEEDS.map((one) => (one.guest === 'g-yusuf' ? { ...one, allergies: [] } : one)),
  },
  { 's-burrata': 42, 'm-risotto': 16, 'd-tart': 54 },
);

export interface ChangesSample {
  copy: Figures;
  now: Figures;
  erased: readonly string[];
}

export const SAMPLES = {
  named: { copy: NAMED_COPY, now: NAMED_NOW, erased: [] },
  menu: { copy: BASE, now: MENU_NOW, erased: [] },
  variantSide: {
    copy: { ...BASE, needs: VARIANT_NEEDS, items: VARIANT_ITEMS('Fish', 28, 20, 33) },
    now: { ...BASE, needs: VARIANT_NEEDS, items: VARIANT_ITEMS('Sea bass', 30, 18, 35) },
    erased: [],
  },
  person: { copy: PERSON_COPY, now: PERSON_NOW, erased: [] },
  erased: { copy: ERASED_COPY, now: ERASED_NOW, erased: ['g-kwame'] },
} satisfies Record<string, ChangesSample>;

export type SampleName = keyof typeof SAMPLES;

export function linesFor(sample: SampleName, settled: boolean, names: boolean): Line[] {
  const { copy, now, erased } = SAMPLES[sample];

  return changesSince(settled ? now : copy, now, { names, erased: new Set(erased) });
}
