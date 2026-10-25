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

type Find = () => HTMLElement | null | undefined;

/** Call `land(find)` as a step closes; focus goes to what `find` returns at the first render that has it. */
export function useFocusOnceShown(): (find: Find) => void {
  const pending = useRef<Find | null>(null);
  const [, setRequests] = useState(0);

  useLayoutEffect(() => {
    const target = pending.current?.();
    if (target == null) return;

    pending.current = null;
    focusStep(target);
  });

  return useCallback((find: Find) => {
    pending.current = find;
    setRequests((count) => count + 1);
  }, []);
}

/** The next notice's words, or else the page's heading: what a person reads on to once `notice` closes. */
export function afterNotice(notice: HTMLElement | null): HTMLElement | null {
  if (notice == null) return null;

  const next = Array.from(document.querySelectorAll<HTMLElement>('[data-notice-lead], h1')).find(
    (candidate) =>
      !notice.contains(candidate) &&
      (notice.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
  );

  if (next != null && !next.hasAttribute('tabindex')) next.tabIndex = -1;

  return next ?? null;
}
