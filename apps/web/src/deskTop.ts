import { type ReactNode, createContext, useContext } from 'react';

/** What the shell hands a page at a desk, where no band is above it: the bell for its top, and for a page that places them itself, "Now working in…" for under its title and the offline box for above it. */
export interface DeskTop {
  bell: ReactNode;
  said: ReactNode;
  offline: ReactNode;
}

export const DeskTopContext = createContext<DeskTop>({ bell: null, said: null, offline: null });

export function useDeskTop(): DeskTop {
  return useContext(DeskTopContext);
}

/** The pages that place the offline box above their title and "Now working in…" under it (sc-39471); every other page has both from the shell, above its top. */
export function placesItsNotices(pathname: string): boolean {
  return (
    pathname === '/app/events' ||
    pathname === '/app/calendar' ||
    ['/app/settings', '/app/account'].some(
      (place) => pathname === place || pathname.startsWith(`${place}/`),
    )
  );
}
