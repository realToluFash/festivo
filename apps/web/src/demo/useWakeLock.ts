import { useEffect } from 'react';

export function wantsLock(inView: boolean, visible: boolean): boolean {
  return inView && visible;
}

/** Holds a screen wake lock while `target` is at least partly on screen and the page is shown. */
export function useWakeLock(target: HTMLElement | null): void {
  useEffect(() => {
    if (target == null || !('wakeLock' in navigator) || typeof IntersectionObserver === 'undefined')
      return;

    const { wakeLock } = navigator;
    let inView = false;
    let held: WakeLockSentinel | null = null;
    let asking = false;
    let gone = false;
    const wanted = () => !gone && wantsLock(inView, document.visibilityState === 'visible');

    const settle = (): void => {
      if (wanted() && held == null && !asking) {
        asking = true;
        wakeLock.request('screen').then(
          (sentinel) => {
            asking = false;
            if (!wanted()) {
              void sentinel.release();
              return;
            }
            held = sentinel;
            // The browser lets the lock go by itself when the page is hidden.
            sentinel.addEventListener('release', () => {
              if (held === sentinel) held = null;
            });
          },
          () => {
            asking = false;
          },
        );
      } else if (!wanted() && held != null) {
        const was = held;
        held = null;
        void was.release();
      }
    };

    const seen = new IntersectionObserver((entries) => {
      inView = entries.at(-1)?.isIntersecting ?? false;
      settle();
    });
    seen.observe(target);
    document.addEventListener('visibilitychange', settle);

    return () => {
      gone = true;
      seen.disconnect();
      document.removeEventListener('visibilitychange', settle);
      settle();
    };
  }, [target]);
}
