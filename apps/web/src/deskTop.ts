import { type ReactNode, createContext, useContext } from 'react';

/** What the shell hands a page that has no band above it: the bell for its title row, and "Now working in…" for under its title. */
export interface DeskTop {
  bell: ReactNode;
  said: ReactNode;
}

export const DeskTopContext = createContext<DeskTop>({ bell: null, said: null });

export function useDeskTop(): DeskTop {
  return useContext(DeskTopContext);
}

/** The pages that sit in their own card at a desk, with no band above them (sc-39471). */
export function isBandless(pathname: string): boolean {
  return (
    pathname === '/app/events' ||
    pathname === '/app/calendar' ||
    ['/app/settings', '/app/account'].some(
      (place) => pathname === place || pathname.startsWith(`${place}/`),
    )
  );
}
