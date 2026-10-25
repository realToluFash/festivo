import { type RefObject, createContext, useContext, useEffect, useRef, useState } from 'react';
import { type ScreenReaderTarget } from './screenReaderFocus.ts';

/** Shows a part that answers a tap while something else is in front of it (sc-11053). */
export const ComeForward = createContext<() => void>(() => {});

export function useComeForward(): () => void {
  return useContext(ComeForward);
}

/** What takes screen reader focus in place of a control on a part that is behind another, or null while it shows. */
export const FocusWhenBehind = createContext<() => ScreenReaderTarget | null>(() => null);

/** `opener`, or what stands in for it while its part is behind another as focus goes back (sc-11462). */
export function useOpenerInSight(
  opener: RefObject<ScreenReaderTarget | null>,
): RefObject<ScreenReaderTarget | null> {
  const whenBehind = useContext(FocusWhenBehind);
  const latest = useRef(whenBehind);
  useEffect(() => {
    latest.current = whenBehind;
  }, [whenBehind]);
  const [inSight] = useState<RefObject<ScreenReaderTarget | null>>(() => ({
    get current() {
      return latest.current() ?? opener.current;
    },
  }));

  return inSight;
}
