import { type RefObject, useCallback, useLayoutEffect, useRef, useState } from 'react';

import { lessMotion } from './leaving.ts';

/** Focus moves to where a step begins, and the page scrolls only as far as it must to show `whole` entire. */
export function focusStep(target: HTMLElement | null, whole: HTMLElement | null = target): void {
  if (target == null) return;

  target.focus({ preventScroll: true });
  whole?.scrollIntoView?.({
    block: 'nearest',
    inline: 'nearest',
    behavior: lessMotion() ? 'auto' : 'smooth',
  });
}

/** Call `arrive()` with the state change a click's answer brings; once it renders, focus lands on the ref. */
export function useStepFocus<T extends HTMLElement = HTMLHeadingElement>({
  onlyIfLost = false,
}: { onlyIfLost?: boolean } = {}): [RefObject<T | null>, () => void] {
  const ref = useRef<T>(null);
  const [arrivals, setArrivals] = useState(0);

  useLayoutEffect(() => {
    if (arrivals === 0) return;
    const held = document.activeElement;
    if (onlyIfLost && held != null && held !== document.body) return;

    focusStep(ref.current);
  }, [arrivals, onlyIfLost]);

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

  return next == null ? null : landOnNotice(next);
}

/** Marks `el` as where focus lands for a notice, until focus leaves it; the caller moves focus there. */
export function landOnNotice(el: HTMLElement): HTMLElement {
  if (!el.hasAttribute('tabindex')) el.tabIndex = -1;
  el.setAttribute('data-notice-landing', '');
  el.addEventListener('blur', () => el.removeAttribute('data-notice-landing'), { once: true });

  return el;
}
