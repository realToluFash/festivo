let holders = 0;
let pressed: { target: HTMLElement; place: DOMRect } | null = null;
let touched = false;

function pointerDown(event: PointerEvent): void {
  touched = event.pointerType !== 'mouse';
}

function mouseDown(event: MouseEvent): void {
  pressed = null;
  if (touched || event.button !== 0 || !(event.target instanceof Element)) return;

  const target = event.target.closest<HTMLElement>('button, a[href]');
  if (target != null) pressed = { target, place: target.getBoundingClientRect() };
}

function mouseUp(event: MouseEvent): void {
  const down = pressed;
  pressed = null;
  touched = false;
  if (down == null || event.button !== 0) return;
  if (event.target instanceof Node && down.target.contains(event.target)) return;

  const { left, right, top, bottom } = down.place;
  const inPlace =
    event.clientX >= left &&
    event.clientX <= right &&
    event.clientY >= top &&
    event.clientY <= bottom;

  if (inPlace && down.target.isConnected) down.target.click();
}

/**
 * A field's re-check runs as the mouse goes down on a button, and the line it changes can move the button before the
 * mouse comes up, so the browser's own click misses (sc-25852). A release inside the place the button filled when the
 * mouse went down is its click; a release outside it still cancels (WCAG 2.5.2).
 */
export function holdMovedClicks(): () => void {
  if (holders++ === 0) {
    document.addEventListener('pointerdown', pointerDown, true);
    document.addEventListener('mousedown', mouseDown, true);
    document.addEventListener('mouseup', mouseUp, true);
  }

  return () => {
    if (--holders > 0) return;

    document.removeEventListener('pointerdown', pointerDown, true);
    document.removeEventListener('mousedown', mouseDown, true);
    document.removeEventListener('mouseup', mouseUp, true);
    pressed = null;
    touched = false;
  };
}
