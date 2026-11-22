import type { Anchor } from '../../components/Summary.tsx';

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
