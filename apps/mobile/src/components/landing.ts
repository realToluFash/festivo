/** Long enough for TalkBack's focus to reach the opener after a close; the Description saw Cancel's ring up to about 1.2 s after one (sc-104673). */
export const LANDING_MS = 1500;

/** Which picker is the only thing TalkBack may reach: the one a list has just closed on Android. Opening another list ends it. */
export function landingAfter<Which>(
  landing: Which | null,
  list: Which | null,
  was: Which | null,
  android: boolean,
): Which | null {
  if (list != null) return null;
  return was != null && android ? was : landing;
}

/** Ends the window once TalkBack has had its time. It must always end, or Cancel and the fields stay out of reach. */
export function endLandingSoon(end: () => void): () => void {
  const timer = setTimeout(end, LANDING_MS);

  return () => clearTimeout(timer);
}
