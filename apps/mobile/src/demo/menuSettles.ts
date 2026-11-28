import type { Anchor } from '../components/Summary.tsx';

export const SETTLE_EVERY_MS = 150;
export const SETTLE_TRIES = 12;

export function hasSettled(before: Anchor | null, now: Anchor): boolean {
  return (
    now.width > 0 &&
    before != null &&
    before.x === now.x &&
    before.y === now.y &&
    before.width === now.width
  );
}

/** One measure after a fixed wait can land before Android lays the button out. */
export function openOnceSettled(
  measure: (then: (now: Anchor | null) => void) => void,
  open: (at: Anchor) => void,
  afterMs: number,
): () => void {
  let gone = false;
  let tries = 0;
  let before: Anchor | null = null;
  const look = () =>
    measure((now) => {
      if (gone) return;
      tries += 1;
      if (now != null && hasSettled(before, now)) return open(now);
      if (tries >= SETTLE_TRIES) {
        if (now != null && now.width > 0) open(now);
        return;
      }
      before = now;
      wait = setTimeout(look, SETTLE_EVERY_MS);
    });
  let wait = setTimeout(look, afterMs);

  return () => {
    gone = true;
    clearTimeout(wait);
  };
}
