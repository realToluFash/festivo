import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { rereadAccount, rereadOrganisations } from './signedIn.ts';
import { cameToForeground } from './updateRequired.ts';

/** Each move after launch, to another screen or back to the front, reads the organisations again (sc-28178); back at the front, the account too. */
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
      if (cameToForeground(last, next)) {
        void rereadOrganisations();
        // The person's colours, if another device changed them (sc-30441).
        void rereadAccount().catch(() => {});
      }
      last = next;
    });

    return () => listener.remove();
  }, []);
}
