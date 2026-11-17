import { type RoomScreen } from '@soirely/api-client';
import { formatWallClock, isSupported, narrowLocale, wallOfZoned } from '@soirely/domain';

/** The slow ask that catches an overrun with no press and a replaced link the signal missed (Decided, 21 Oct). */
export const ASK_AGAIN_MS = 60_000;

/** A screen that has never heard asks this often until it does. */
export const FIRST_ASK_RETRY_MS = 10_000;

/** The screen link's own `?lang=` first, then the event's organisation's locale. */
export function screenLanguage(asked: string | null, screen: RoomScreen): string | null {
  if (asked != null && isSupported(asked)) return narrowLocale(asked);

  return screen.kind === 'replaced' ? null : narrowLocale(screen.locale);
}

/** Every time on the room screen is on the 24-hour clock, in the event's zone, in every locale (Reversed, 15 Nov 2026). */
export function screenTime(rfc3339: string, locale: string): string {
  return formatWallClock(wallOfZoned(rfc3339), locale);
}
