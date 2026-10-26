import type { View } from 'react-native';

let focused: View | null = null;
const watchers = new Set<() => void>();

/** The Field whose control has focus: its label, control and error, which a lift keeps in sight. */
export function focusedField(): View | null {
  return focused;
}

export function fieldFocused(field: View | null): void {
  focused = field;
  watchers.forEach((moved) => moved());
}

export function fieldLeft(field: View | null): void {
  if (focused === field) focused = null;
}

/** Calls `moved` each time focus moves to a field, as the keys stay up. Returns the unsubscribe. */
export function watchFocusedField(moved: () => void): () => void {
  watchers.add(moved);

  return () => watchers.delete(moved);
}
