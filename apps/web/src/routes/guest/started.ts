/** That a Yes was started in this browser and not sent: no answer and nothing chosen, only the fact (pm, 29 Oct). */

const PREFIX = 'soirely.guestStarted.';

/** The key holds a digest of the link, never the link, which is the guest's credential. */
function keyOf(token: string): string {
  let hash = 0x811c9dc5;

  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return PREFIX + (hash >>> 0).toString(36);
}

export function markStarted(token: string): void {
  try {
    localStorage.setItem(keyOf(token), '1');
  } catch {
    // Without storage the page opens as for a guest who never started, as on another device.
  }
}

export function wasStarted(token: string): boolean {
  try {
    return localStorage.getItem(keyOf(token)) === '1';
  } catch {
    return false;
  }
}

export function forgetStarted(token: string): void {
  try {
    localStorage.removeItem(keyOf(token));
  } catch {
    // Nothing kept, so nothing to forget.
  }
}
