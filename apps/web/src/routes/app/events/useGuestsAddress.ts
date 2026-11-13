import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';

import { type Choice, choiceOf } from './guestView.ts';

export const SEARCH_SETTLES_MS = 300;

/** The menu's choice and the search live in the address, each change a step Back undoes (sc-3772); the search is written once typing settles, and dropped if Back or Forward moves the address under it. */
export function useGuestsAddress() {
  const [params, setParams] = useSearchParams();
  const { key } = useLocation();
  const choice = choiceOf(params.get('filter'));
  const addressQ = params.get('q') ?? '';
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

  function write(next: { choice?: Choice; q?: string }): void {
    const nextQ = next.q ?? pending.current ?? undefined;

    cancel();
    if (nextQ !== undefined) written.current = nextQ;
    setParams((was) => {
      const at = new URLSearchParams(was);

      if (next.choice !== undefined) {
        if (next.choice === 'all') at.delete('filter');
        else at.set('filter', next.choice);
      }
      if (nextQ !== undefined) {
        if (nextQ === '') at.delete('q');
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
    setChoice: (next: Choice) => write({ choice: next }),
    setQ: type,
    clear: () => {
      setTyped('');
      write({ choice: 'all', q: '' });
    },
  };
}
