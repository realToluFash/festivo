export interface ZoneRow {
  id: string;
  city: string;
  country: string;
  offset: string;
}

/** "Lagos (UTC+01:00)", as Settings > Account labels every zone (sc-868). */
export function zoneLabel(zone: ZoneRow): string {
  return `${zone.city} (UTC${zone.offset})`;
}

function folded(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** By city, country, zone name or offset ("utc+01", "+01:00"); every zone for an empty search. */
export function matchingZones<Z extends ZoneRow>(zones: readonly Z[], query: string): Z[] {
  const wanted = folded(query);
  if (wanted === '') return [...zones];

  const compact = wanted.replace(/\s/g, '');

  return zones.filter(
    (zone) =>
      [zone.city, zone.country, zone.id.replace(/_/g, ' '), zoneLabel(zone)].some((text) =>
        folded(text).includes(wanted),
      ) || `utc${zone.offset}`.startsWith(compact.startsWith('utc') ? compact : `utc${compact}`),
  );
}

/** The zone a typed text names exactly, by its label or its city, so a typed "Lagos" saves without a pick. */
export function exactZone<Z extends ZoneRow>(zones: readonly Z[], typed: string): Z | null {
  const wanted = folded(typed);

  return (
    zones.find((zone) => folded(zoneLabel(zone)) === wanted || folded(zone.city) === wanted) ?? null
  );
}
