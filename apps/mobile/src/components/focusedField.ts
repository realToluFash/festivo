import type { ViewInstance } from 'react-native';

let focused: ViewInstance | null = null;
const watchers = new Set<() => void>();
let checking = false;
const checkWatchers = new Set<(field: ViewInstance) => void>();

/** The Field whose control has focus: its label, control and error, which a lift keeps in sight. */
export function focusedField(): ViewInstance | null {
  return focused;
}

export function fieldFocused(field: ViewInstance | null): void {
  focused = field;
  watchers.forEach((moved) => moved());
  if (checking && field != null) {
    checking = false;
    checkWatchers.forEach((checked) => checked(field));
  }
}

export function fieldLeft(field: ViewInstance | null): void {
  if (focused === field) focused = null;
}

/** Calls `moved` each time focus moves to a field, as the keys stay up. Returns the unsubscribe. */
export function watchFocusedField(moved: () => void): () => void {
  watchers.add(moved);

  return () => watchers.delete(moved);
}

/** A check is moving focus to a field: the Field it lands in is handed to each `watchCheckedField`. With `landed`, focus is already there and no focus event is coming; a picker, which takes none, passes its own `field`. */
export function fieldChecked(landed: boolean, field: ViewInstance | null = focused): void {
  if (!landed) {
    checking = true;
    return;
  }
  if (field != null) checkWatchers.forEach((checked) => checked(field));
}

/** Calls `checked` with the Field a client check moved focus to (sc-20721). Returns the unsubscribe. */
export function watchCheckedField(checked: (field: ViewInstance) => void): () => void {
  checkWatchers.add(checked);

  return () => checkWatchers.delete(checked);
}

const takers = new Set<() => void>();

/** A control that takes no focus of its own was taken, as a picker opens from a tap. */
export function controlTaken(): void {
  takers.forEach((taken) => taken());
}

/** Calls `taken` each time a control with no focus of its own is taken. Returns the unsubscribe. */
export function watchControlTaken(taken: () => void): () => void {
  takers.add(taken);

  return () => takers.delete(taken);
}

/** Calls `moved` as focus leaves the field the screen settled on, for another field or a control taken. Anything before `settled` is the screen landing, not moving on (sc-37519). */
export function watchMovedOn(moved: () => void): { settled(): void; stop(): void } {
  let landed: ViewInstance | null | undefined;
  const unwatchFocus = watchFocusedField(() => {
    if (landed !== undefined && focused !== landed) moved();
  });
  const unwatchTaken = watchControlTaken(() => {
    if (landed !== undefined) moved();
  });

  return {
    settled: () => {
      landed = focused;
    },
    stop: () => {
      unwatchFocus();
      unwatchTaken();
    },
  };
}
