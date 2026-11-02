import { useState } from 'react';

export interface LinkRetry {
  retrying: boolean;
  again: () => void;
}

/** Reads a link again (sc-11488) through `read`; it is retrying until the view the read began from changes. */
export function useLinkRetry<V>(view: V, read: () => void): LinkRetry {
  const [askedFrom, setAskedFrom] = useState<V | null>(null);

  return {
    retrying: askedFrom === view,
    again: () => {
      setAskedFrom(view);
      read();
    },
  };
}
