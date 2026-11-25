import { type Href, router } from 'expo-router';

import { leaveThen } from '../src/leaveHeld.ts';
import { linkedPath } from '../src/linkedPath.ts';

/** A link that opens a screen while a form holds a change asks that form's discard ask first (sc-82245). */
export function redirectSystemPath({
  path,
  initial,
}: {
  path: string;
  initial: boolean;
}): string | null | Promise<string | null> {
  if (initial) return path;

  let now: string | null | undefined;
  const later = new Promise<string | null>((resolve) => {
    leaveThen(
      (discarding) => {
        if (!discarding) {
          now = path;
          resolve(path);
          return;
        }
        router.dismissTo(linkedPath(path) as Href);
        resolve(null);
      },
      () => resolve(null),
    );
  });

  return now ?? later;
}
