import { createContext, useContext } from 'react';

/** Back to You are not in an organisation, under a frame an account in no organisation opened from it: no tab bar, sidebar, search or bell then, as that page has none (sc-75471). Null anywhere else. */
export const WayBackToNone = createContext<(() => void) | null>(null);

export function useWayBackToNone(): (() => void) | null {
  return useContext(WayBackToNone);
}
