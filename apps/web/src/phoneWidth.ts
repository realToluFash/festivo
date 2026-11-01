import { useSyncExternalStore } from 'react';

/** The width `styles.css` lays out as a phone at and under. */
export const PHONE_WIDTH = '(width <= 40rem)';

/** The width `styles.css` sets two columns side by side from: 1280 × 800 and up. */
export const WIDE_WIDTH = '(width >= 64rem)';

export function usePhoneWidth(): boolean {
  return useMatches(PHONE_WIDTH);
}

export function useWideWidth(): boolean {
  return useMatches(WIDE_WIDTH);
}

function useMatches(media: string): boolean {
  return useSyncExternalStore(
    (changed) => {
      const query = window.matchMedia(media);
      query.addEventListener('change', changed);

      return () => query.removeEventListener('change', changed);
    },
    () => window.matchMedia(media).matches,
  );
}
