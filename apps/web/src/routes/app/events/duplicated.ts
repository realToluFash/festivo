/** Set by Duplicate on its way to the copy's page, which says the draft was created. */
export const DUPLICATED = { duplicated: true } as const;

export function wasDuplicated(state: unknown): boolean {
  return typeof state === 'object' && state != null && 'duplicated' in state;
}
