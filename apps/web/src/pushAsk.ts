const ASKED = 'soirely.pushAsked';
/** For a browser that refuses storage: asked once per page load at most. */
let remembered = false;

/** Whether the bell offers push on this opening: the browser has not been asked, and the card has not shown here before. */
export function pushAskDue(): boolean {
  if (typeof Notification === 'undefined' || Notification.permission !== 'default') return false;
  if (remembered) return false;

  try {
    return window.localStorage.getItem(ASKED) == null;
  } catch {
    return true;
  }
}

/** Per device: the card shows on the first opening of the bell, and never again here. */
export function markPushAsked(): void {
  try {
    window.localStorage.setItem(ASKED, new Date().toISOString());
  } catch {
    // Private windows refuse storage; the card may then show once more on the next load.
    remembered = true;
  }
}
