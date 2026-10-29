import type { ViewInstance } from 'react-native';

let focused: ViewInstance | null = null;
const watchers = new Set<() => void>();

/** The Field whose control has focus: its label, control and error, which a lift keeps in sight. */
export function focusedField(): ViewInstance | null {
  return focused;
}

export function fieldFocused(field: ViewInstance | null): void {
  focused = field;
  watchers.forEach((moved) => moved());
}

export function fieldLeft(field: ViewInstance | null): void {
  if (focused === field) focused = null;
}

/** Calls `moved` each time focus moves to a field, as the keys stay up. Returns the unsubscribe. */
export function watchFocusedField(moved: () => void): () => void {
  watchers.add(moved);

  return () => watchers.delete(moved);
}
