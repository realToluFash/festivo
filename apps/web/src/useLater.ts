import { useEffect, useRef } from 'react';

/** One timer per part, cleared when the part goes. */
export function useLater(): (ms: number, then: () => void) => void {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (ms, then) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(then, ms);
  };
}
