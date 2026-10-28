let held: ((go: () => void) => void) | null = null;

/** A screen with unsaved work asks before the frame takes the reader elsewhere, a destination or another organisation, and calls `go` to leave anyway. */
export function holdLeaving(ask: (go: () => void) => void): () => void {
  held = ask;

  return () => {
    if (held === ask) held = null;
  };
}

export function leaveThen(go: () => void): void {
  if (held == null) go();
  else held(go);
}
