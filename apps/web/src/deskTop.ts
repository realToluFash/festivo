import { type ReactNode, createContext, useContext } from 'react';

/** What the shell hands a page at a desk, where no band is above it: the bell for its top, and for a page that places them itself, "Now working in…" for under its title and, for above it, the offline box and the sign-in rules' notices. */
export interface DeskTop {
  bell: ReactNode;
  said: ReactNode;
  above: ReactNode;
}

export const DeskTopContext = createContext<DeskTop>({ bell: null, said: null, above: null });

export function useDeskTop(): DeskTop {
  return useContext(DeskTopContext);
}

/** The pages that place the offline box and the sign-in rules' notices above their title and "Now working in…" under it (sc-39471); every other page has both from the shell, above its top. */
export function placesItsNotices(pathname: string): boolean {
  return (
    pathname === '/app/events' ||
    pathname === '/app/calendar' ||
    ['/app/settings', '/app/account'].some(
      (place) => pathname === place || pathname.startsWith(`${place}/`),
    )
  );
}

/** The pages that fit a phone's window under the shell's bar, the bell in their own top (sc-57468); every other page has the band there. */
export function fitsPhone(pathname: string): boolean {
  return pathname === '/app' || pathname === '/app/events' || pathname === '/app/calendar';
}
