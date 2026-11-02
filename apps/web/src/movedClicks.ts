let holders = 0;
let pressed: { target: HTMLElement; place: DOMRect } | null = null;
let touched = false;

function pointerDown(event: PointerEvent): void {
  touched = event.pointerType !== 'mouse';
}

function mouseDown(event: MouseEvent): void {
  pressed = null;
  const modified = event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
  if (touched || modified || event.button !== 0 || !(event.target instanceof Element)) return;

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

/** A field's re-check can move the button between mouse down and up; a release where it was still clicks it (sc-25852). */
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
