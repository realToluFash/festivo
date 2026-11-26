import type { CheckIn, OutsideEvent } from '@soirely/api-client';
import type { Translate } from '@soirely/domain';

import { api } from '../../api.ts';

/** Where check-in's back link leads, and the event and job under its heading (sc-28230). */
export interface DoorWay {
  to: string;
  words: string;
  line: string;
}

/** A shift on the event leads back to the shift page; a door code alone to "You're in for…"; anybody else has no way back. Decided by what the person holds, never by where they came from. */
export async function doorWayOf(
  eventId: string,
  outside: readonly OutsideEvent[] | undefined,
  t: Translate,
): Promise<DoorWay | null> {
  try {
    const night = await api.myNight(eventId);

    return {
      to: shiftAddress(eventId),
      words: t('checkIn.yourShift'),
      line: night.job == null ? night.event.name : `${night.event.name} · ${night.job}`,
    };
  } catch {
    const held = outside?.find((one) => one.id === eventId);
    if (held == null) return null;

    return {
      to: youreInAddress(eventId),
      words: held.name,
      line: held.jobLabel == null ? held.name : `${held.name} · ${held.jobLabel}`,
    };
  }
}

export function doorAddress(eventId: string): string {
  return `/door/${encodeURIComponent(eventId)}`;
}

export function shiftAddress(eventId: string): string {
  return `/night/${encodeURIComponent(eventId)}`;
}

export function youreInAddress(eventId: string): string {
  return `/d/in/${encodeURIComponent(eventId)}`;
}

function arrivals(checkIn: CheckIn): Map<string, string | null> {
  const seen = new Map<string, string | null>();
  for (const guest of checkIn.guests) {
    seen.set(guest.id, guest.arrival?.at ?? null);
    for (const one of guest.companions) seen.set(one.id, one.arrival?.at ?? null);
  }

  return seen;
}

/** Whoever arrived between two reads: on another device, since the screen's own arrivals replace the list they answer with. */
export function freshRows(was: CheckIn, now: CheckIn): string[] {
  const before = arrivals(was);

  return [...arrivals(now)].flatMap(([id, at]) =>
    at != null && before.get(id) == null ? [id] : [],
  );
}
