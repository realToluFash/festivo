import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';

import { type ViewInAddress, filterOf } from './guests.ts';

export const SEARCH_SETTLES_MS = 300;

/** The keys the list keeps in the address; a change to them is not a new page. */
export const VIEW_KEYS = ['filter', 'q', 'since'] as const;

export function pageKey(params: URLSearchParams): string {
  const page = new URLSearchParams(params);

  for (const key of VIEW_KEYS) page.delete(key);

  return page.toString();
}

/** sc-3772: the menu's choice and the search live in the address (sc-4331: with the last look Changed since you looked counts from), each change a step Back undoes; the search is written once typing settles, with the next choice if that comes first, and dropped if Back or Forward moves the address under it. `base` is what the state opens on with neither key. */
export function useGuestsAddress(base: ViewInAddress) {
  const [params, setParams] = useSearchParams();
  const { key } = useLocation();
  const choice = filterOf(params.get('filter')) ?? base.choice;
  const since = choice === 'changed' ? (params.get('since') ?? base.since) : null;
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
        at.delete('since');
        if (next.choice === 'changed' && next.since != null) at.set('since', next.since);
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
    since,
    setChoice: (next: ViewInAddress['choice'], from: string | null = null) =>
      write({ choice: next, since: from }),
    setQ: type,
    clear: () => {
      setTyped('');
      write({ choice: 'all', q: '' });
    },
  };
}
