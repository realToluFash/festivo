import { createContext, useContext } from 'react';

/** Shows a part that answers a tap while something else is in front of it (sc-11053). */
export const ComeForward = createContext<() => void>(() => {});

export function useComeForward(): () => void {
  return useContext(ComeForward);
}
