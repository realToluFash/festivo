import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { rereadOrganisations } from './signedIn.ts';
import { cameToForeground } from './updateRequired.ts';

/** Each move after launch, to another screen or back to the front, reads the organisations again (sc-28178). */
export function useRereadOnMoves(): void {
  const pathname = usePathname();
  const arrivedAt = useRef(pathname);

  useEffect(() => {
    if (arrivedAt.current === pathname) return;

    arrivedAt.current = pathname;
    void rereadOrganisations();
  }, [pathname]);

  useEffect(() => {
    let last = AppState.currentState;
    const listener = AppState.addEventListener('change', (next) => {
      if (cameToForeground(last, next)) void rereadOrganisations();
      last = next;
    });

    return () => listener.remove();
  }, []);
}
