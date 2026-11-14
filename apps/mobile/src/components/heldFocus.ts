/** The gaps between the moves after the first that hold TalkBack's focus on a refused picker against its own late follow of the scroll (sc-43907). */
export const HELD_AGAIN_MS = [250, 450, 600];

/** Makes `move` once on the first `hold`, and again after each of HELD_AGAIN_MS, then calls `ended`. A later `hold` starts no second chain, and `stop` ends it. */
export function holdFocus(move: () => void, ended: () => void): { hold(): void; stop(): void } {
  let held = false;
  let stopped = false;
  let next: ReturnType<typeof setTimeout> | undefined;
  const again = [...HELD_AGAIN_MS];
  const holdAgain = () => {
    const after = again.shift();
    if (after == null) {
      ended();
      return;
    }
    next = setTimeout(() => {
      if (stopped) return;
      move();
      holdAgain();
    }, after);
  };

  return {
    hold: () => {
      if (held || stopped) return;
      held = true;
      move();
      holdAgain();
    },
    stop: () => {
      stopped = true;
      clearTimeout(next);
    },
  };
}
