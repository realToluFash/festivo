import { type ReactNode, createContext, useContext } from 'react';

/** What the shell hands a page that has no band above it: the bell for its title row, "Now working in…" for under its title, and the offline box for above it. */
export interface DeskTop {
  bell: ReactNode;
  said: ReactNode;
  offline: ReactNode;
}

export const DeskTopContext = createContext<DeskTop>({ bell: null, said: null, offline: null });

export function useDeskTop(): DeskTop {
  return useContext(DeskTopContext);
}

/** The pages that sit in their own card at a desk, with no band above them, and say they are offline in the amber box above their title (sc-39471). */
export function isBandless(pathname: string): boolean {
  return (
    pathname === '/app/events' ||
    pathname === '/app/calendar' ||
    ['/app/settings', '/app/account'].some(
      (place) => pathname === place || pathname.startsWith(`${place}/`),
    )
  );
}
