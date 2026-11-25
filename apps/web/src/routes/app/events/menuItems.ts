import type { MenuItem } from '@soirely/api-client';
import { type FixedRow, type ItemProblems, type ItemRow, listFormat } from '@soirely/domain';
import { useTranslation } from 'react-i18next';

let made = 0;

export function newItemKey(): string {
  made += 1;
  return `i${made}`;
}

export function rowsOf(items: readonly MenuItem[]): ItemRow[] {
  return items.map((one) => ({ ...one, key: newItemKey() }));
}

export function ownRowsOf(names: readonly string[]): FixedRow[] {
  return names.map((name) => ({ kind: 'fixed', name, key: newItemKey() }));
}

/** A choice's row, or with null the variant's, gone from an open Edit dish as the API drops it: a single row left goes too. */
export function withoutRow(rows: readonly ItemRow[], choiceId: string | null): ItemRow[] {
  const left = rows.filter((one) =>
    choiceId == null
      ? one.kind !== 'variants'
      : !(one.kind === 'choice' && one.choiceId === choiceId),
  );

  return left.length === 1 ? [] : left;
}

export function useOrList(): (names: string[]) => string {
  const { i18n } = useTranslation();

  return (names) => listFormat(i18n.language, { type: 'disjunction' }).format(names);
}

/** The first refused field after Save: the first refused row, then Add for the list's own refusal. */
export function firstItemProblem(
  rows: readonly ItemRow[],
  problems: ItemProblems,
  own: boolean,
): string | null {
  const row = rows.find((one) => problems.byKey[one.key] != null);
  if (row != null)
    return row.kind === 'fixed' ? `${own ? 'mc-own' : 'mc-item'}-${row.key}` : `mc-iup-${row.key}`;

  return problems.list == null ? null : 'mc-add-item';
}
