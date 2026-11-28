const FOOT = 10;
const CAP = 96;
const GUTTER = 24;

/** Fixed, not absolute: Today's hero clips what overflows it. Moved in from the left edge where the bell sits too far left for the popover's width. */
export function placeUnder(bell: HTMLElement, pop: HTMLElement): void {
  const at = bell.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(bell).getPropertyValue('--spaceSm')) || 8;
  const top = at.bottom + gap;
  const height = Math.min(window.innerHeight - CAP, window.innerHeight - top - FOOT);
  const viewport = document.documentElement.clientWidth;
  const right = Math.min(viewport - at.right, viewport - GUTTER - pop.offsetWidth);

  pop.style.setProperty('position', 'fixed');
  pop.style.setProperty('top', `${top}px`);
  pop.style.setProperty('right', `${right}px`);
  pop.style.setProperty('max-height', `${height}px`);
}
