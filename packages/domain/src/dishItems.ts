import { ITEM_NAME_MAXIMUM, type MenuDish, type MenuItem } from '@soirely/api-client';

import { nameKey } from './nameKey.ts';
import { visibleLength } from './visibleText.ts';

/** A dish's item or a course's own as Edit dish and Edit course hold it (sc-34230): `key` keeps a row's focus and refusal while it moves. */
export type ItemRow = MenuItem & { key: string };

export type FixedRow = Extract<ItemRow, { kind: 'fixed' }>;

export type ItemProblem = 'blank' | 'long' | 'taken';

export interface ItemProblems {
  list: 'onlyOne' | null;
  byKey: Record<string, ItemProblem>;
}

export type ItemOffer = { kind: 'variants' } | { kind: 'choice'; choiceId: string };

/** What a row is called: a fixed item its name, a choice its question, the variant its variants as an "or" list in the locale. Null is a choice with no question yet. */
export function itemNameOf(
  item: MenuItem,
  dish: Pick<MenuDish, 'variants' | 'choices'>,
  orList: (names: string[]) => string,
): string | null {
  if (item.kind === 'fixed') return item.name;
  if (item.kind === 'variants') return orList(dish.variants.map((one) => one.name));
  const question = dish.choices.find((one) => one.id === item.choiceId)?.question.trim() ?? '';

  return question === '' ? null : question;
}

/** The dish's variant first, then each choice with a question, that isn't already an item. */
export function itemOffers(
  dish: Pick<MenuDish, 'variants' | 'choices'>,
  items: readonly MenuItem[],
): ItemOffer[] {
  const used = new Set(items.flatMap((one) => (one.kind === 'choice' ? [one.choiceId] : [])));
  const variants: ItemOffer[] =
    dish.variants.length > 0 && !items.some((one) => one.kind === 'variants')
      ? [{ kind: 'variants' }]
      : [];

  return [
    ...variants,
    ...dish.choices
      .filter((one) => one.question.trim() !== '' && !used.has(one.id))
      .map((one): ItemOffer => ({ kind: 'choice', choiceId: one.id })),
  ];
}

export function canAddItem(items: readonly unknown[], most: number): boolean {
  return items.length < most;
}

function nameProblems(
  named: readonly { key: string; name: string | null; fixed: boolean }[],
): Record<string, ItemProblem> {
  const byKey: Record<string, ItemProblem> = {};
  const seen = new Set<string>();

  for (const one of named) {
    const name = (one.name ?? '').trim();

    if (one.fixed && name === '') byKey[one.key] = 'blank';
    else if (one.fixed && visibleLength(name) > ITEM_NAME_MAXIMUM) byKey[one.key] = 'long';
    else if (name !== '' && seen.has(nameKey(name))) byKey[one.key] = 'taken';

    if (name !== '') seen.add(nameKey(name));
  }

  return byKey;
}

/** None, or 2 to 6, each named once: of two the same, the later is refused. The 7th is refused when Add is pressed. */
export function dishItemProblems(
  items: readonly ItemRow[],
  dish: Pick<MenuDish, 'variants' | 'choices'>,
  orList: (names: string[]) => string,
): ItemProblems {
  return {
    list: items.length === 1 ? 'onlyOne' : null,
    byKey: nameProblems(
      items.map((one) => ({
        key: one.key,
        name: itemNameOf(one, dish, orList),
        fixed: one.kind === 'fixed',
      })),
    ),
  };
}

/** Up to 3, named under a dish's rules. */
export function ownItemProblems(items: readonly FixedRow[]): ItemProblems {
  return {
    list: null,
    byKey: nameProblems(items.map((one) => ({ key: one.key, name: one.name, fixed: true }))),
  };
}

export function hasItemProblem(problems: ItemProblems): boolean {
  return problems.list != null || Object.keys(problems.byKey).length > 0;
}

export function movedItems<T>(list: readonly T[], at: number, by: -1 | 1): T[] | null {
  const to = at + by;
  if (to < 0 || to >= list.length) return null;
  const next = list.slice();
  const [one] = next.splice(at, 1);
  next.splice(to, 0, one as T);

  return next;
}

/** As the API takes them: names trimmed, the keys left behind. */
export function sentItems(items: readonly ItemRow[]): MenuItem[] {
  return items.map((one): MenuItem => {
    if (one.kind === 'fixed') return { kind: 'fixed', name: one.name.trim() };
    if (one.kind === 'choice') return { kind: 'choice', choiceId: one.choiceId };

    return { kind: 'variants' };
  });
}

export function isItem(dish: Pick<MenuDish, 'items'>, choiceId: string | null): boolean {
  return dish.items.some((one) =>
    choiceId == null ? one.kind === 'variants' : one.kind === 'choice' && one.choiceId === choiceId,
  );
}
