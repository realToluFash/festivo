type Ask = (go: () => void) => void;
type Hold = { ask: Ask; drop: () => void };

let held: Hold | null = null;
let asking: { stay: (() => void) | undefined } | null = null;

/** A form with unsaved work asks before any way out (sc-82245); `drop` lets its screen go without asking twice. */
export function holdLeaving(ask: Ask, drop: () => void = () => {}): () => void {
  const hold = { ask, drop };
  held = hold;

  return () => {
    if (held !== hold) return;
    held = null;
    asking = null;
  };
}

/** `go` hears whether work was discarded, so that screen comes off the stack; `stay`, that the way out does nothing. */
export function leaveThen(go: (discarding: boolean) => void, stay?: () => void): void {
  if (asking != null) {
    stay?.();
    return;
  }
  const hold = held;
  if (hold == null) {
    go(false);
    return;
  }

  asking = { stay };
  hold.ask(() => {
    if (held === hold) held = null;
    asking = null;
    hold.drop();
    go(true);
  });
}

export function keptEditing(): void {
  const stay = asking?.stay;
  asking = null;
  stay?.();
}

/** A session that ended without the reader choosing it does not ask. */
export function leaveWithoutAsking(): void {
  const hold = held;
  held = null;
  asking = null;
  hold?.drop();
}
