import { useSyncExternalStore } from 'react';

/** The width `styles.css` lays out as a phone at and under. */
export const PHONE_WIDTH = '(width <= 40rem)';

export function usePhoneWidth(): boolean {
  return useSyncExternalStore(
    (changed) => {
      const query = window.matchMedia(PHONE_WIDTH);
      query.addEventListener('change', changed);

      return () => query.removeEventListener('change', changed);
    },
    () => window.matchMedia(PHONE_WIDTH).matches,
  );
}
