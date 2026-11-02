import { useEffect, useState } from 'react';

/** False until `ms` have passed since mount, then true. */
export function useShownAfter(ms: number): boolean {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setShown(true), ms);

    return () => clearTimeout(id);
  }, [ms]);

  return shown;
}
