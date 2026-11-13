const KEY = 'soirely.invitation';

/** Per tab, so signing in from an invitation's link comes back to it rather than to the product. */
export function holdInvitation(token: string): void {
  try {
    sessionStorage.setItem(KEY, token);
  } catch {
    // Storage refused: signing in still works, and the email's link still opens the invitation.
  }
}

export function heldInvitation(): string | null {
  try {
    const token = sessionStorage.getItem(KEY);

    return token != null && token !== '' ? token : null;
  } catch {
    return null;
  }
}

export function dropHeldInvitation(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing was held, or nothing can be.
  }
}
