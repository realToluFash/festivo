import { useEffect, useState } from 'react';

export interface LinkRetry {
  retrying: boolean;
  again: () => void;
}

/** Reads a link again (sc-11488): `attempt` keys the read, and focus lands on the heading of what loads. */
export function useLinkRetry<V extends { kind: string }>(view: V): LinkRetry & { attempt: number } {
  const [attempt, setAttempt] = useState(0);
  const [askedFrom, setAskedFrom] = useState<V | null>(null);
  const retrying = askedFrom === view;
  const loaded = askedFrom != null && !retrying && view.kind !== 'unreachable';

  useEffect(() => {
    if (loaded) document.querySelector<HTMLElement>('#content h1')?.focus();
  }, [loaded]);

  return {
    attempt,
    retrying,
    again: () => {
      setAskedFrom(view);
      setAttempt((n) => n + 1);
    },
  };
}
