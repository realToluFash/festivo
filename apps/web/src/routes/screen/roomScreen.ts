import { type RoomScreen } from '@soirely/api-client';
import { formatWallClock, isSupported, narrowLocale, wallOfZoned } from '@soirely/domain';

/** A screen asks this often, so it knows within 10 seconds when Soirely is out of its reach (sc-62588). */
export const ASK_EVERY_MS = 2_000;

/** A screen whose last ask failed asks again this soon, so a short drop ends before Times as of shows. */
export const ASK_AGAIN_FAILING_MS = 1_000;

/** An ask with no answer by now has failed, as on a network cut beyond the browser. */
export const ASK_TIMEOUT_MS = 4_000;

/** Asks failing this long, from the first failed one's sending, show Times as of; a shorter drop shows nothing. */
export const OUT_OF_TOUCH_MS = 7_500;

/** The screen link's own `?lang=` first, then the event's organisation's locale. */
export function screenLanguage(asked: string | null, screen: RoomScreen): string | null {
  if (asked != null && isSupported(asked)) return narrowLocale(asked);

  return screen.kind === 'replaced' ? null : narrowLocale(screen.locale);
}

/** Every time on the room screen is on the 24-hour clock, in the event's zone, in every locale (Reversed, 15 Nov 2026). */
export function screenTime(rfc3339: string, locale: string): string {
  return formatWallClock(wallOfZoned(rfc3339), locale);
}
