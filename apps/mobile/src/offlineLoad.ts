import { keepsWhatLoaded } from '@soirely/domain';

/** What a failed load leaves on screen: what loaded stays, under the band, only when Soirely never answered (sc-22586). */
export function afterFailedLoad<L extends { kind: string }>(
  before: L,
  error: unknown,
  failed: L,
): L {
  return before.kind === 'loaded' && keepsWhatLoaded(error) ? before : failed;
}

/** What a load leaves on a form that already shows: neither an answer nor a failure replaces it or the tag it saves against (Decided, 2 Nov, sc-27086). */
export function formAfterLoad<L extends object>(before: L, read: L): L {
  return 'event' in before ? before : read;
}

/** The minute the band dates a form by: when it first showed, or last took Show the latest; a load that answers once it shows leaves it, as it leaves the form (Decided, 2 Nov, the band's time on Edit details). */
export function formShownAt(was: Date | null, change: 'loaded' | 'latest', now: Date): Date {
  return change === 'loaded' && was != null ? was : now;
}

/** Whether the band speaks now, and the unanswered count it has said: once as it appears, again after an unanswered Try again, and only from the screen in front, which says a band that came up while it was behind as it returns (sc-27086). */
export function bandReadOut(
  said: number | null,
  band: { showing: boolean; unanswered: number; inFront: boolean },
): { said: number | null; speaks: boolean } {
  if (!band.showing) return { said: null, speaks: false };
  if (!band.inFront || said === band.unanswered) return { said, speaks: false };

  return { said: band.unanswered, speaks: true };
}
