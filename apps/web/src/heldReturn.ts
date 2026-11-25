const KEY = 'soirely.return';

/** Per tab, so a product link opened signed out (an email's download, sc-612) is where signing in lands. */
export function holdReturn(path: string): void {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // Storage refused: signing in still lands in the product, and the link still works once signed in.
  }
}

/** Taken once: only a path inside the product, so nothing held can send a sign-in elsewhere. */
export function takeHeldReturn(): string | null {
  try {
    const path = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);

    return path != null && /^\/(?:app|d|w)(?:[/?#]|$)/.test(path) ? path : null;
  } catch {
    return null;
  }
}
