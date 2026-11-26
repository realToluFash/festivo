import type { KitchenStationsRead, MyNight } from '@soirely/api-client';
import { type EventPhase, wallDay } from '@soirely/domain';
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

/** Open {station} on Your night: their own kitchen station, when their access opens it; null shows no button. */
export function openStationOf(night: MyNight): string | null {
  return night.dishes ? night.station : null;
}
