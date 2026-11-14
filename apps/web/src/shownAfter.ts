import { useEffect, useState } from 'react';

/** Under a second a person's flow is not broken, and a loading state that flashes up and away is noise. */
export const SKELETON_AFTER_MS = 1000;

export function useShownAfter(ms: number): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setShown(true), ms);

    return () => window.clearTimeout(id);
  }, [ms]);

  return shown;
}
