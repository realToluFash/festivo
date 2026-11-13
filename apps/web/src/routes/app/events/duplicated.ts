/** Set by Duplicate on its way to the copy's page, which says the draft was created and how many guests came with it (sc-3656). */
export function duplicated(guestsCopied: number | null) {
  return { duplicated: true, guestsCopied } as const;
}

export function wasDuplicated(state: unknown): boolean {
  return typeof state === 'object' && state != null && 'duplicated' in state;
}

/** Null when the copy was made without its guest list. */
export function guestsCopied(state: unknown): number | null {
  return typeof state === 'object' &&
    state != null &&
    'guestsCopied' in state &&
    typeof state.guestsCopied === 'number'
    ? state.guestsCopied
    : null;
}
