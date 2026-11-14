export type InTurn<T> =
  | { kind: 'all'; added: T[] }
  | { kind: 'stopped'; added: T[]; went: string[]; left: string[]; error: unknown };

/** Adds each id in turn; a refusal stops there, naming who went in before it and who is still to go. */
export async function addInTurn<T>(
  ids: readonly string[],
  add: (id: string) => Promise<T>,
): Promise<InTurn<T>> {
  const added: T[] = [];
  const went: string[] = [];
  for (const id of ids) {
    try {
      added.push(await add(id));
    } catch (error) {
      return {
        kind: 'stopped',
        added,
        went,
        left: ids.filter((one) => !went.includes(one)),
        error,
      };
    }
    went.push(id);
  }

  return { kind: 'all', added };
}
