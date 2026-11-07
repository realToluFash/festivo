import {
  createContext,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { keepFocusIn } from './dialogFocus.ts';
import { useMatches } from './phoneWidth.ts';

interface Layers {
  stack: readonly string[];
  push: (id: string) => void;
  pop: (id: string) => void;
  host: HTMLElement | null;
}

export const LayersContext = createContext<Layers>({
  stack: [],
  push() {},
  pop() {},
  host: null,
});

/** A desk page's dialogs: the stack they take turns on, and the host they draw in. */
export function useDeskLayers(): {
  layers: Layers;
  covered: boolean;
  setHost: (host: HTMLElement | null) => void;
} {
  const [stack, setStack] = useState<readonly string[]>([]);
  const push = useCallback(
    (id: string) => setStack((now) => [...now.filter((one) => one !== id), id]),
    [],
  );
  const pop = useCallback((id: string) => setStack((now) => now.filter((one) => one !== id)), []);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const layers = useMemo(() => ({ stack, push, pop, host }), [stack, push, pop, host]);

  return { layers, covered: stack.length > 0, setHost };
}

/** A dialog takes the top of the stack while it is open: everything under it is inert. */
export function useLayer(): boolean {
  const id = useId();
  const { stack, push, pop } = useContext(LayersContext);

  useLayoutEffect(() => {
    push(id);

    return () => pop(id);
  }, [id, push, pop]);

  return stack.length > 0 && stack.at(-1) !== id;
}

/** Focus goes in and comes back to the opener, or to the page's title when the opener has gone; only the top layer hears Escape and Tab. */
export function useDeskDialog(
  dialog: RefObject<HTMLElement | null>,
  first: RefObject<HTMLElement | null>,
  onDismiss: () => void,
  locked = false,
): boolean {
  const covered = useLayer();

  useLayoutEffect(() => {
    if (covered) return;

    const keys = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !locked) {
        event.preventDefault();
        onDismiss();
      }
      if (event.key === 'Tab' && dialog.current != null) keepFocusIn(dialog.current, event);
    };

    document.addEventListener('keydown', keys);

    return () => document.removeEventListener('keydown', keys);
  }, [covered, dialog, locked, onDismiss]);

  const opener = useRef<Element | null>(null);
  const open = useRef(false);

  useLayoutEffect(() => {
    opener.current ??= document.activeElement;
    open.current = true;
    const back = (tries: number): void => {
      const to = opener.current;
      if (open.current) return;
      const lost = document.activeElement == null || document.activeElement === document.body;
      if (!(to instanceof HTMLElement) || !to.isConnected) {
        if (lost) document.querySelector<HTMLElement>('.desk-main h1')?.focus();
      } else if (to.closest('[inert]') == null) to.focus();
      else if (tries > 0) window.requestAnimationFrame(() => back(tries - 1));
    };

    return () => {
      open.current = false;
      window.setTimeout(() => back(5), 0);
    };
  }, []);

  const entered = useRef(false);

  useEffect(() => {
    if (covered || entered.current) return;
    entered.current = true;
    (first.current ?? dialog.current)?.focus();
  }, [covered, dialog, first]);

  return covered;
}

/** Focus once the closing layer's inert has lifted from the page, waiting a few frames at most. */
export function focusWhenFree(target: () => HTMLElement | null): void {
  const attempt = (tries: number): void => {
    const to = target();
    if (to?.isConnected === true && to.closest('[inert]') == null) to.focus();
    else if (tries > 0) window.requestAnimationFrame(() => attempt(tries - 1));
  };

  window.setTimeout(() => attempt(5), 0);
}

/** From 1536, Members' list and the picked person sit side by side. */
export function useDeskSplit(): boolean {
  return useMatches('(width >= 96rem)');
}
