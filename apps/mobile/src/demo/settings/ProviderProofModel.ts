/** Where Confirm it's you stands for an account that signs in with Google or Apple (sc-22601). */
export type ProviderStage = 'trip' | 'busy' | 'code';

/** How long the sample's Google or Apple stays open, so the faded button can be seen. */
export const TRIP_MS = 1400;

/** Too many tries, as the API's `until` gives it: the demo's limit ends this long after the state opens. */
export const LIMIT_MS = 45_000;

/** The header's verb on the screen: none before the trip, since only the provider's own button may open it. */
export function headerVerbShown(stage: ProviderStage): boolean {
  return stage === 'code';
}

/** Where the trip lands: the code step with two-factor on, else proved. */
export function afterTrip(twoFactor: boolean): 'code' | 'proved' {
  return twoFactor ? 'code' : 'proved';
}

/** A limit holds until its `until`, to the millisecond; the notice names the minute. */
export function stillLimited(until: number | null, now: number): boolean {
  return until != null && now < until;
}

/** The notice's time, 24-hour, to the minute. */
export function limitTime(until: number): string {
  const at = new Date(until);

  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}
