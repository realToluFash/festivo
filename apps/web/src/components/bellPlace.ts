const FOOT = 10;
const CAP = 96;

/** Fixed, not absolute: Today's hero clips what overflows it. */
export function placeUnder(bell: HTMLElement, pop: HTMLElement): void {
  const at = bell.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(bell).getPropertyValue('--spaceSm')) || 8;
  const top = at.bottom + gap;
  const height = Math.min(window.innerHeight - CAP, window.innerHeight - top - FOOT);

  pop.style.setProperty('position', 'fixed');
  pop.style.setProperty('top', `${top}px`);
  pop.style.setProperty('right', `${document.documentElement.clientWidth - at.right}px`);
  pop.style.setProperty('max-height', `${height}px`);
}
