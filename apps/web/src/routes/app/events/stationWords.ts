import type { StaffStations, StationRef } from '@soirely/api-client';
import type { TFunction } from 'i18next';

/** A section is named with its table count; a place by its name alone. */
export function stationLabel(
  station: Pick<StationRef, 'name' | 'kind' | 'tables'>,
  t: TFunction,
): string {
  return station.kind === 'section'
    ? t('stations.sectionTables', { name: station.name, count: station.tables.length })
    : station.name;
}

/** The Station picker's two groups, as Stations lists them; a group with no stations is left out. */
export function stationGroups(
  { places, sections }: StaffStations,
  t: TFunction,
): { label: string; options: { value: string; label: string }[] }[] {
  return [
    {
      label: t('stations.places'),
      options: places.map((one) => ({ value: one.id, label: one.name })),
    },
    {
      label: t('stations.sections'),
      options: sections.map((one) => ({
        value: one.id,
        label: stationLabel({ ...one, kind: 'section' }, t),
      })),
    },
  ].filter((group) => group.options.length > 0);
}
