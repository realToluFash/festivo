import { type RefObject, useCallback, useLayoutEffect, useRef, useState } from 'react';

/** Focus moves to where a step begins, and the page scrolls only as far as it must to show it whole. */
export function focusStep(target: HTMLElement | null): void {
  if (target == null) return;

  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/** Call `arrive()` with the state change a click's answer brings; once it renders, focus lands on the ref. */
export function useStepFocus<T extends HTMLElement = HTMLHeadingElement>(): [
  RefObject<T | null>,
  () => void,
] {
  const ref = useRef<T>(null);
  const [arrivals, setArrivals] = useState(0);

  useLayoutEffect(() => {
    if (arrivals > 0) focusStep(ref.current);
  }, [arrivals]);

  const arrive = useCallback(() => setArrivals((count) => count + 1), []);

  return [ref, arrive];
}
