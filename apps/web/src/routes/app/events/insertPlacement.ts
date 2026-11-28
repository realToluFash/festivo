/** The part of the window a node can show in: the window, cut by every ancestor that clips what overflows it. */
export function shownBox(node: HTMLElement): { top: number; bottom: number } {
  let top = 0;
  let bottom = window.innerHeight;

  for (let at = node.parentElement; at != null; at = at.parentElement) {
    if (getComputedStyle(at).overflowY === 'visible') continue;
    const box = at.getBoundingClientRect();
    top = Math.max(top, box.top);
    bottom = Math.min(bottom, box.bottom);
  }

  return { top, bottom };
}

/** Insert opens above its button, as the composer sits at the pane's foot, and under it when the room above is too small for the menu and the room under it is larger. */
export function insertOpensUnder(
  button: DOMRect,
  shown: { top: number; bottom: number },
  menuHeight: number,
): boolean {
  const above = button.top - shown.top;
  const under = shown.bottom - button.bottom;

  return above < menuHeight && under > above;
}
