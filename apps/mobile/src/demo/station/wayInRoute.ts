import { type StationId, type StationState } from './stationModel.ts';
import { KS } from './wayIn.ts';

export interface StationOpening {
  station: StationId | null;
  you: string;
}

const PICKER = 'Ada Nnaji';

const OPENINGS: Readonly<Record<string, StationOpening>> = {
  fryer: { station: 'fryer', you: 'Gbenga Salami' },
  grill: { station: 'grill', you: 'Tayo Bamidele' },
  pass: { station: 'pass', you: 'Ronke Alade' },
  'picked-grill': { station: 'grill', you: PICKER },
  none: { station: null, you: PICKER },
};

export function stationIdOf(raw: string | undefined): StationOpening | null {
  return raw == null ? null : (OPENINGS[raw] ?? null);
}

export function openedOn(s: StationState, on: StationOpening | null): StationState {
  return on == null ? s : { ...s, station: on.station, you: on.you };
}

export function wayBackOf(raw: string | undefined): string | null {
  if (raw === 'overview') return KS.overview;

  return raw === 'night' ? KS.yourNight : null;
}
