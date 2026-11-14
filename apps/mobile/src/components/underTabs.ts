import { createContext, useContext } from 'react';

const UnderTabs = createContext(0);

export const UnderTabsProvider = UnderTabs.Provider;

/** How far the tab bar reaches over a list that runs under it; 0 where the frame keeps the list above the bar (sc-39471). */
export function useUnderTabs(): number {
  return useContext(UnderTabs);
}
