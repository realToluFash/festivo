import type { StationRef } from '@soirely/api-client';
import type { TFunction } from 'i18next';

/** A section is named with its table count; a place by its name alone. */
export function stationLabel(
  station: Pick<StationRef, 'name' | 'kind' | 'tables'>,
  t: TFunction,
): string {
  return station.kind === 'section'
    ? t('stations.sectionTables', { name: station.name, count: station.tables })
    : station.name;
}
