import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';

import { type Choice, choiceOf } from '@soirely/domain';

export const SEARCH_SETTLES_MS = 300;

/** The menu's choice, the search and the chips (sc-90684) live in the address, Changed since you looked with the time it counts from (sc-4331), each change a step Back undoes (sc-3772); the search is written once typing settles, and dropped if Back or Forward moves the address under it, but not when its own write lands after more typing. */
export function useGuestsAddress() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const changed = params.get('filter') === 'changed';
  const choice = choiceOf(changed ? null : params.get('filter'));
  const since = changed ? (params.get('since') ?? 'all') : null;
  const addressQ = params.get('q') ?? '';
  const groups = useMemo(() => params.getAll('group'), [params]);
  const dietary = params.get('dietary') === '1';
  const address = params.toString();
  const [q, setTyped] = useState(addressQ);
  const written = useRef(addressQ);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const landing = useRef<string | null>(null);

  function cancel(): void {
    if (timer.current != null) clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
  }

  useEffect(() => {
    const own = landing.current === address;
    landing.current = null;
    if (own) return;
    const waiting = pending.current != null;

    cancel();
    if (!waiting && addressQ === written.current) return;
    written.current = addressQ;
    setTyped(addressQ);
  }, [location, address, addressQ]);

  useEffect(() => cancel, []);

  function write(
    next: {
      choice?: Choice;
      since?: string;
      q?: string;
      group?: string;
      dietary?: boolean;
      noChips?: true;
    },
    replace = false,
  ): void {
    const nextQ = next.q ?? pending.current ?? undefined;

    cancel();
    if (nextQ !== undefined) written.current = nextQ;
    setParams(
      (was) => {
        const at = new URLSearchParams(was);

        if (next.since !== undefined) {
          at.set('filter', 'changed');
          at.set('since', next.since);
        } else if (next.choice !== undefined) {
          at.delete('since');
          if (next.choice === 'all') at.delete('filter');
          else at.set('filter', next.choice);
        }
        if (nextQ !== undefined) {
          if (nextQ === '') at.delete('q');
          else at.set('q', nextQ);
        }
        if (next.group !== undefined) {
          const before = at.getAll('group');
          const on = before.includes(next.group)
            ? before.filter((one) => one !== next.group)
            : [...before, next.group];

          at.delete('group');
          for (const one of on) at.append('group', one);
        }
        if (next.noChips) {
          at.delete('group');
          at.delete('dietary');
        }
        if (next.dietary !== undefined) {
          if (next.dietary) at.set('dietary', '1');
          else at.delete('dietary');
        }

        landing.current = at.toString();
        return at;
      },
      { replace },
    );
  }

  function type(next: string): void {
    setTyped(next);
    if (timer.current != null) clearTimeout(timer.current);
    pending.current = next;
    timer.current = setTimeout(() => write({ q: next }), SEARCH_SETTLES_MS);
  }

  return {
    choice,
    changed,
    since,
    q,
    setChoice: (next: Choice) => write({ choice: next }),
    setChanged: (from: string) => write({ since: from }),
    setQ: type,
    groups,
    dietary,
    toggleGroup: (group: string) => write({ group }),
    setDietary: (on: boolean) => write({ dietary: on }),
    dropGroup: (group: string) => {
      if (groups.includes(group)) write({ group }, true);
    },
    clear: () => {
      setTyped('');
      write({ choice: 'all', q: '', noChips: true });
    },
  };
}
