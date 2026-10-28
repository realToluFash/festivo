let held: ((go: () => void) => void) | null = null;

/** A screen with unsaved work asks before the frame takes the reader elsewhere, a destination or another organisation, and calls `go` to leave anyway. */
export function holdLeaving(ask: (go: () => void) => void): () => void {
  held = ask;

  return () => {
    if (held === ask) held = null;
  };
}

/** `go` hears whether the reader discarded unsaved work, so the destination can take that screen off the stack. */
export function leaveThen(go: (discarding: boolean) => void): void {
  const ask = held;
  if (ask == null) {
    go(false);
    return;
  }

  ask(() => {
    if (held === ask) held = null;
    go(true);
  });
}
