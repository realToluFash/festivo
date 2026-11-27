import { ApiError, type KitchenStationsRead, type MyNight } from '@soirely/api-client';
import { type EventPhase, answeredWithin, wallDay } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { openingStation } from './kitchenStation.ts';

/** Kitchen station on Overview (sc-95382): from 00:00 in the event's zone on its first day until it is Finished, which an event called off already is. */
export function stationRowShows(
  event: { startsAt: string; timeZone: string },
  phase: EventPhase,
  now: Date,
): boolean {
  return (
    phase !== 'finished' && wallDay(now, event.timeZone) >= wallDay(event.startsAt, event.timeZone)
  );
}

/** Where the station's screen will open, by its own rule, and the course fired last. */
export function stationRowLine(
  t: TFunction,
  stations: KitchenStationsRead,
  picked: string | null,
): string {
  const id = openingStation(stations, picked);
  const station = stations.stations.find((one) => one.id === id)?.name;

  if (station == null) return t('station.wayIn.pick');

  const latest = stations.fired.reduce<KitchenStationsRead['fired'][number] | null>(
    (last, one) =>
      last == null || Date.parse(one.firedAt) >= Date.parse(last.firedAt) ? one : last,
    null,
  );

  return latest == null ? station : t('station.wayIn.line', { station, course: latest.name });
}

export type StationRowRead = { line: string; at: string; stale: boolean } | null;

/** One read of the row: given up after NO_ANSWER_MS, as the page's band is, so offline shows "as of". */
export function readStationRow(
  t: TFunction,
  stations: Promise<KitchenStationsRead>,
  picked: Promise<string | null>,
  now: () => Date = () => new Date(),
): Promise<NonNullable<StationRowRead>> {
  return answeredWithin(
    Promise.all([stations, picked]),
    () => new Error('The kitchen stations read went unanswered.'),
  ).then(([read, pick]) => ({
    line: stationRowLine(t, read, pick),
    at: now().toISOString(),
    stale: false,
  }));
}

/** A 403 or 404: the read is not theirs, and asking again would be refused again. */
export function refused(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 403 || error.status === 404);
}

/** A refusal takes the row away; anything else keeps its line, as of when it was read. */
export function afterFailedRead(was: StationRowRead, error: unknown): StationRowRead {
  if (refused(error)) return null;

  return was == null ? was : { ...was, stale: true };
}

/** Reads the row now and every `every` ms, handing `seen` each outcome; a refusal ends the polling with the row, since asking again would be refused again. Returns what stops it. */
export function pollStationRow(
  read: () => Promise<NonNullable<StationRowRead>>,
  every: number,
  seen: (next: (was: StationRowRead) => StationRowRead) => void,
): () => void {
  let current = true;
  let timer: ReturnType<typeof setInterval> | null = null;
  const stop = () => {
    current = false;
    if (timer != null) clearInterval(timer);
  };
  const load = () =>
    read().then(
      (fresh) => current && seen(() => fresh),
      (error: unknown) => {
        if (!current) return;
        if (refused(error)) stop();
        seen((was) => afterFailedRead(was, error));
      },
    );
  void load();
  timer = setInterval(() => void load(), every);

  return stop;
}

/** Open {station} on Your night: their own kitchen station, when their access opens it; null shows no button. */
export function openStationOf(night: MyNight): string | null {
  return night.dishes ? night.station : null;
}
