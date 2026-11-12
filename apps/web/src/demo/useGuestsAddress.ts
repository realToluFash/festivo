import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { type Choice, choiceOf } from './guests.ts';

export const SEARCH_SETTLES_MS = 300;

/** The keys the list keeps in the address; a change to them is not a new page. */
export const VIEW_KEYS = ['filter', 'q'] as const;

export function pageKey(params: URLSearchParams): string {
  const page = new URLSearchParams(params);

  for (const key of VIEW_KEYS) page.delete(key);

  return page.toString();
}

export interface ListView {
  choice: Choice;
  q: string;
}

/** sc-3772: the menu's choice and the search live in the address, each change a step Back undoes; the search is written once typing settles. `base` is what the state opens on with neither key. */
export function useGuestsAddress(base: ListView) {
  const [params, setParams] = useSearchParams();
  const choice = choiceOf(params.get('filter')) ?? base.choice;
  const addressQ = params.get('q') ?? base.q;
  const [q, setTyped] = useState(addressQ);
  const written = useRef(addressQ);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (addressQ === written.current) return;
    written.current = addressQ;
    setTyped(addressQ);
  }, [addressQ]);

  useEffect(
    () => () => {
      if (timer.current != null) clearTimeout(timer.current);
    },
    [],
  );

  function write(next: Partial<ListView>): void {
    if (timer.current != null) clearTimeout(timer.current);
    timer.current = null;
    if (next.q !== undefined) written.current = next.q;
    setParams((was) => {
      const at = new URLSearchParams(was);

      if (next.choice !== undefined) {
        if (next.choice === base.choice) at.delete('filter');
        else at.set('filter', next.choice);
      }
      if (next.q !== undefined) {
        if (next.q === base.q) at.delete('q');
        else at.set('q', next.q);
      }

      return at;
    });
  }

  function type(next: string): void {
    setTyped(next);
    if (timer.current != null) clearTimeout(timer.current);
    timer.current = setTimeout(() => write({ q: next }), SEARCH_SETTLES_MS);
  }

  return {
    choice,
    q,
    setChoice: (next: Choice) => write({ choice: next }),
    setQ: type,
    clear: () => {
      setTyped('');
      write({ choice: 'all', q: '' });
    },
  };
}
