// One lift per platform; both at once is the double lift. iOS never moves the window, so
// the scroll view adjusts its insets. Android is edge to edge here, so the window does not
// resize either, and a KeyboardAvoidingView pads the content.
export interface KeyboardLift {
  avoid: 'padding' | null;
  adjustScrollInsets: boolean;
}

export function keyboardLift(os: string): KeyboardLift {
  if (os === 'ios') return { avoid: null, adjustScrollInsets: true };
  if (os === 'android') return { avoid: 'padding', adjustScrollInsets: false };

  return { avoid: null, adjustScrollInsets: false };
}

export interface Rect {
  y: number;
  height: number;
}

/** Whether the keyboard covers any of a group, or its margin, in window coordinates. */
export function coveredBy(keyboardTop: number, group: Rect, margin: number): boolean {
  return group.y + group.height + margin > keyboardTop;
}

export interface Lift {
  /** The group's top inside the scroll content. */
  contentY: number;
  height: number;
  /** The scroll view's top in the window. */
  scrollTop: number;
  /** The keyboard's top in the window. */
  keyboardTop: number;
  margin: number;
}

/** The scroll offset that rests a group's bottom `margin` above the keyboard, its top never above the scroll view's. */
export function offsetAboveKeyboard({
  contentY,
  height,
  scrollTop,
  keyboardTop,
  margin,
}: Lift): number {
  const bottomAboveKeys = contentY + height + margin - (keyboardTop - scrollTop);

  return Math.max(0, Math.min(bottomAboveKeys, contentY - margin));
}

export interface ListRoom {
  /** The height between the scroll view's top and the keyboard, less a margin at each end. */
  room: number;
  /** The height of everything in the group but the list. */
  rest: number;
  /** The list's height at one whole row. */
  oneRow: number;
  /** The list's height with the keyboard down. */
  most: number;
}

/** The tallest a list may grow so its group fits above the keyboard, never under one whole row. */
export function listRoom({ room, rest, oneRow, most }: ListRoom): number {
  return Math.max(oneRow, Math.min(most, room - rest));
}
