// One lift per platform; both at once is the double lift. iOS never moves the window, so
// the scroll view adjusts its insets. Android is edge to edge here, so the window does not
// resize either, and the screen pads its content by as much as the keys cover.
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

/** Where the scroll view's visible area ends: at the keys, or above them where a bar docked on the keys ends it. */
export function shownEnd(keyboardTop: number, scrollView: Rect): number {
  return Math.min(keyboardTop, scrollView.y + scrollView.height);
}

/** The height of the scroll view left in sight: down to the keys while they are up. */
export function shownAboveKeys(keyboardTop: number | null, scrollView: Rect): number {
  return keyboardTop == null
    ? scrollView.height
    : Math.max(0, shownEnd(keyboardTop, scrollView) - scrollView.y);
}

export interface DockRoom {
  /** The height between the scroll view's top and the keyboard. */
  room: number;
  field: number;
  bar: number;
  margin: number;
}

/** Whether a bar may dock on the keys: only when the field it saves, and its margins, still fit above it (sc-7099). */
export function barFits({ room, field, bar, margin }: DockRoom): boolean {
  return field + 2 * margin + bar <= room;
}

export interface ScrollInsets {
  automaticallyAdjustKeyboardInsets: boolean;
  contentInset: { bottom: number } | undefined;
}

// A docked bar ends the frame above the keys, but iOS set the scroll view's bottom inset to the
// keys' whole overlap as they rose and keeps it. Only a change of contentInset resets it, and a
// zero one is no change, so the docked inset is a hairline.
export const DOCKED_INSET = { bottom: 0.5 };

/** While a bar is docked the frame clears the keys, so the scroll view must not inset for them too. */
export function scrollInsets(lift: KeyboardLift, docked: boolean): ScrollInsets {
  return docked
    ? { automaticallyAdjustKeyboardInsets: false, contentInset: DOCKED_INSET }
    : { automaticallyAdjustKeyboardInsets: lift.adjustScrollInsets, contentInset: undefined };
}

/** Whether the keyboard covers any of a group, or its margin, in window coordinates. */
export function coveredBy(keyboardTop: number, group: Rect, margin: number): boolean {
  return group.y + group.height + margin > keyboardTop;
}

export interface LiftCheck {
  /** Where the scroll view's visible area ends, in the window. */
  shown: number;
  /** The group in the window. */
  group: Rect;
  /** The focused field's top in the window. */
  focusTop?: number | undefined;
  /** The scroll view's top in the window. */
  scrollTop: number;
  margin: number;
}

/** Whether a group must lift: the keys cover it, or the focused field has gone under the scroll view's top (sc-11978). */
export function liftNeeded({ shown, group, focusTop, scrollTop, margin }: LiftCheck): boolean {
  return coveredBy(shown, group, margin) || (focusTop != null && focusTop < scrollTop);
}

export interface GroupInScroll {
  /** The scroll view's top in the window. */
  scrollTop: number;
  /** The group's top inside the scroll content. */
  contentY: number;
  /** The scroll offset the native scroll view last reported. */
  offset: number;
}

/** The group's top in the window, from where it sits in a scrolled view. */
export function groupInWindow({ scrollTop, contentY, offset }: GroupInScroll): number {
  return scrollTop + contentY - offset;
}

/** The keyboard's top in measureInWindow's frame, which on Android can start below the status bar. */
export function keyboardInWindow(screenY: number, origin: number): number {
  return screenY + origin;
}

/** How much of a view, measured in the window, the keyboard covers from its bottom up. */
export function keysOver(view: Rect, keyboardTop: number | null): number {
  return keyboardTop == null ? 0 : Math.max(0, view.y + view.height - keyboardTop);
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
  /** The focused field's top inside the scroll content; it caps the lift only when it sits above the group. */
  focusY?: number | undefined;
}

/** The scroll offset that rests a group's bottom `margin` above the keyboard, its top and the focused field's never above the scroll view's. */
export function offsetAboveKeyboard({
  contentY,
  height,
  scrollTop,
  keyboardTop,
  margin,
  focusY = contentY,
}: Lift): number {
  const bottomAboveKeys = contentY + height + margin - (keyboardTop - scrollTop);

  return Math.max(0, Math.min(bottomAboveKeys, Math.min(contentY, focusY) - margin));
}

export interface InScroll {
  /** The view's top inside the scroll content. */
  contentY: number;
  height: number;
  /** The scroll offset the native scroll view last reported. */
  offset: number;
  /** The scroll view's own height. */
  shown: number;
  margin: number;
}

/** The scroll offset that brings a view wholly into sight, `margin` clear of the edge it came from; null when it is already there. */
export function offsetIntoView({
  contentY,
  height,
  offset,
  shown,
  margin,
}: InScroll): number | null {
  if (contentY >= offset && contentY + height <= offset + shown) return null;
  if (contentY < offset) return Math.max(0, contentY - margin);

  return Math.max(0, Math.min(contentY + height + margin - shown, contentY - margin));
}

/** Whether no part of a view is in sight. TalkBack's focus rests on a view partly in sight, and a scroll under it moves that focus on (sc-18588). */
export function outOfSight({ contentY, height, offset, shown }: Omit<InScroll, 'margin'>): boolean {
  return contentY + height <= offset || contentY >= offset + shown;
}

/** How far a pass brings a view into sight: `wholly`, or only back into sight once it has wholly left it. */
export type IntoView = 'wholly' | 'outOfSight';

/** The scroll offset a pass brings a view to, as offsetIntoView, except that an `outOfSight` pass leaves a view with any part in sight where it is, under TalkBack's focus (sc-18588); null when it stays put. */
export function settledOffset(at: InScroll, when: IntoView): number | null {
  if (when === 'outOfSight' && !outOfSight(at)) return null;

  return offsetIntoView(at);
}

/** The scroll offset that keeps a view where it shows after the content above it moved it from `before` to `after` inside the scroll content; null when it has not moved (sc-18588). */
export function keptOffset(offset: number, before: number, after: number): number | null {
  if (after === before) return null;

  return offset + after - before;
}

/** Where the focused field sits inside the scroll content, as the last part of its group. */
export interface Focused {
  contentY: number;
  height: number;
}

/** As offsetAboveKeyboard while the group fits; when it does not, the field wins and the group's top goes. */
export function offsetToFocus(group: Lift, field: Focused): number {
  const room = group.keyboardTop - group.scrollTop;

  return offsetAboveKeyboard(
    group.height + 2 * group.margin <= room ? group : { ...group, ...field },
  );
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

export interface Turned {
  os: string;
  phone: boolean;
  width: number;
  height: number;
}

export function iPhoneOnItsSide({ os, phone, width, height }: Turned): boolean {
  return os === 'ios' && phone && width > height;
}

/** Whether a list's search sits beside its title: an iPhone on its side leaves little more than a row above the keys (sc-10118). */
export function searchBesideTitle(turned: Turned): boolean {
  return iPhoneOnItsSide(turned);
}

/** On an Android phone this tall or shorter, in dp, the keys leave no room for the help line and back row (sc-3132). */
export const SHORT_ANDROID_HEIGHT = 700;

export interface Typing {
  os: string;
  phone: boolean;
  /** The window's height, in dp. */
  height: number;
  keysUp: boolean;
}

/** Whether a card gives up its help line and the header its back row while the keys are up. */
export function shortWhileTyping({ os, phone, height, keysUp }: Typing): boolean {
  return os === 'android' && phone && keysUp && height <= SHORT_ANDROID_HEIGHT;
}

export interface SidewaysTyping {
  os: string;
  phone: boolean;
  /** The window's width, in dp. */
  width: number;
  /** The window's height, in dp. */
  height: number;
  keysUp: boolean;
}

/** Whether an iPhone on its side with the keys up scrolls a sheet's title with its body, leaving the field room (sc-9442). */
export function titleScrollsWhileTyping({ keysUp, ...turned }: SidewaysTyping): boolean {
  return keysUp && iPhoneOnItsSide(turned);
}

/** Whether a sheet keeps its field in the body's sight: while typing, and on an iPhone on its side once the keys go down too, resting the body at its top (sc-9442). */
export function fieldKeptInSight({ keysUp, ...turned }: SidewaysTyping): boolean {
  return keysUp || iPhoneOnItsSide(turned);
}
