import { useEffect, useState } from 'react';

import type { Load } from './RolesSample.ts';

const RETRY_MS = 1200;

/** Loading and failing stay put for a link to show them; Try again loads after a moment. */
export function useLoad(start: Load): { load: Load; retry: () => void } {
  const [load, setLoad] = useState<Load>(start);

  useEffect(() => {
    if (load !== 'retrying') return;
    const timer = setTimeout(() => setLoad('loaded'), RETRY_MS);

    return () => clearTimeout(timer);
  }, [load]);

  return { load, retry: () => setLoad('retrying') };
}
