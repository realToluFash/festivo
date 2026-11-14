/** The API's User::NAME_MAXIMUM: the most a person's own name takes, wherever it is typed. */
export const ACCOUNT_NAME_MAXIMUM = 180;

/** What Save name does with the field: the ends trimmed, the inside as typed, as the API saves it (sc-22741). */
export function nameToSave(
  typed: string,
  held: string,
): { kind: 'blank' } | { kind: 'unchanged' } | { kind: 'changed'; name: string } {
  const name = typed.trim();

  if (name === '') return { kind: 'blank' };
  if (name === held) return { kind: 'unchanged' };

  return { kind: 'changed', name };
}
