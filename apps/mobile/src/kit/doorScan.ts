import type { Arrival, CheckIn, CheckInCompanion, CheckInGuest } from '@soirely/api-client';

/** An arrival recorded on this device while it had no connection, sent with its time once it has one (sc-1301). */
export interface WaitingArrival {
  guestId: string;
  at: string;
  by: string | null;
}

/** What a scan brings up: the guest with their companions, or one answer for any code the list does not hold, whichever of the three it was. */
export type ScanRead =
  | {
      kind: 'guest';
      guest: CheckInGuest;
      companions: CheckInCompanion[];
      arrived: Arrival | null;
      notComingSince: string | null;
    }
  | { kind: 'notOnList' };

/** A check-in code is 43 base64url characters; anything else a camera reads (a link, a door code) is not one. */
export function isCheckInCode(read: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/u.test(read);
}

/** The list holds each code's SHA-256 in hex, never the code, so the scanned code's digest finds the guest. */
export function scanned(checkIn: CheckIn, digest: string): ScanRead {
  const guest = checkIn.guests.find((one) => one.code != null && one.code === digest);
  if (guest == null) return { kind: 'notOnList' };

  return {
    kind: 'guest',
    guest,
    companions: guest.companions,
    arrived: guest.arrival,
    notComingSince: guest.reply === 'notComing' ? guest.repliedAt : null,
  };
}

/** The list as this device shows it: each waiting arrival marked arrived, counted once, so an offline door reads as an online one would. */
export function withWaiting(checkIn: CheckIn, waiting: readonly WaitingArrival[]): CheckIn {
  if (waiting.length === 0) return checkIn;
  const of = new Map(waiting.map((one) => [one.guestId, one]));
  let added = 0;
  const marked = <T extends { id: string; arrival: Arrival | null }>(person: T): T => {
    const mine = of.get(person.id);
    if (mine == null || person.arrival != null) return person;
    added += 1;

    return { ...person, arrival: { at: mine.at, by: mine.by } };
  };
  const guests = checkIn.guests.map((guest) => ({
    ...marked(guest),
    companions: guest.companions.map(marked),
  }));

  return {
    ...checkIn,
    guests,
    count: { ...checkIn.count, attended: checkIn.count.attended + added },
  };
}

/** Recorded once: a second Arrived for someone already waiting keeps the first, earlier time. */
export function waitFor(
  waiting: readonly WaitingArrival[],
  arrival: WaitingArrival,
): WaitingArrival[] {
  return waiting.some((one) => one.guestId === arrival.guestId)
    ? [...waiting]
    : [...waiting, arrival];
}

export function unwait(waiting: readonly WaitingArrival[], guestId: string): WaitingArrival[] {
  return waiting.filter((one) => one.guestId !== guestId);
}

/** Sends each waiting arrival in the order recorded. One the API refuses for good (the guest removed, the door shut at that time) is dropped; a failed connection stops, keeping it and the rest. */
export async function sendWaiting(
  waiting: readonly WaitingArrival[],
  send: (arrival: WaitingArrival) => Promise<CheckIn>,
  refusedForGood: (error: unknown) => boolean,
): Promise<{ left: WaitingArrival[]; checkIn: CheckIn | null }> {
  let checkIn: CheckIn | null = null;
  for (const [at, arrival] of waiting.entries()) {
    try {
      checkIn = await send(arrival);
    } catch (error) {
      if (!refusedForGood(error)) return { left: waiting.slice(at), checkIn };
    }
  }

  return { left: [], checkIn };
}
