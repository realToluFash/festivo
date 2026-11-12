import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';

import { type ViewInAddress, choiceOf } from './guests.ts';

export const SEARCH_SETTLES_MS = 300;

/** The keys the list keeps in the address; a change to them is not a new page. */
export const VIEW_KEYS = ['filter', 'q'] as const;

export function pageKey(params: URLSearchParams): string {
  const page = new URLSearchParams(params);

  for (const key of VIEW_KEYS) page.delete(key);

  return page.toString();
}

/** sc-3772: the menu's choice and the search live in the address, each change a step Back undoes; the search is written once typing settles, with the next choice if that comes first, and dropped if Back or Forward moves the address under it. `base` is what the state opens on with neither key. */
export function useGuestsAddress(base: ViewInAddress) {
  const [params, setParams] = useSearchParams();
  const { key } = useLocation();
  const choice = choiceOf(params.get('filter')) ?? base.choice;
  const addressQ = params.get('q') ?? base.q;
  const [q, setTyped] = useState(addressQ);
  const written = useRef(addressQ);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancel(): void {
    if (timer.current != null) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
  }

  useEffect(() => {
    const waiting = pending.current != null;

    cancel();
    if (!waiting && addressQ === written.current) return;
    written.current = addressQ;
    setTyped(addressQ);
  }, [key, addressQ]);

  useEffect(() => cancel, []);

  function write(next: Partial<ViewInAddress>): void {
    const nextQ = next.q ?? pending.current ?? undefined;

    cancel();
    if (nextQ !== undefined) written.current = nextQ;
    setParams((was) => {
      const at = new URLSearchParams(was);

      if (next.choice !== undefined) {
        if (next.choice === base.choice) at.delete('filter');
        else at.set('filter', next.choice);
      }
      if (nextQ !== undefined) {
        if (nextQ === base.q) at.delete('q');
        else at.set('q', nextQ);
      }

      return at;
    });
  }

  function type(next: string): void {
    setTyped(next);
    if (timer.current != null) clearTimeout(timer.current);
    pending.current = next;
    timer.current = setTimeout(() => write({ q: next }), SEARCH_SETTLES_MS);
  }

  return {
    choice,
    q,
    setChoice: (next: ViewInAddress['choice']) => write({ choice: next }),
    setQ: type,
    clear: () => {
      setTyped('');
      write({ choice: 'all', q: '' });
    },
  };
}
