import { useGlobalSearchParams, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { noteWhere } from './where.ts';
import { rereadAccount, rereadOrganisations } from './signedIn.ts';
import { cameToForeground } from './updateRequired.ts';

/** Each move after launch, to another screen or back to the front, reads the organisations again (sc-28178); back at the front, the account too. */
export function useRereadOnMoves(): void {
  const pathname = usePathname();
  const query = new URLSearchParams(
    Object.entries(useGlobalSearchParams()).flatMap(([key, value]) =>
      (Array.isArray(value) ? value : [value]).map((one): [string, string] => [key, String(one)]),
    ),
  ).toString();
  const arrivedAt = useRef(pathname);

  useEffect(() => {
    noteWhere(pathname, query);
    if (arrivedAt.current === pathname) return;

    arrivedAt.current = pathname;
    void rereadOrganisations();
  }, [pathname, query]);

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
