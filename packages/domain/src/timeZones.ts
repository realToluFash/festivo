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

/** "utc+1", "+5:30" or "gmt−3" as a sign, hours and maybe minutes; null for any other text. */
function offsetQuery(
  query: string,
): { sign: string; hours: string; minutes: string | null } | null {
  const match = /^(?:utc|gmt)?([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(
    query.replace(/\s/g, '').replace(/\u2212/g, '-'),
  );
  if (match === null) return null;

  return { sign: match[1]!, hours: match[2]!.padStart(2, '0'), minutes: match[3] ?? null };
}

/** An offset query matches by offset alone ("+5" the hour, "+5:30" exactly); text never the label's offset. */
export function matchingZones<Z extends ZoneRow>(zones: readonly Z[], query: string): Z[] {
  const wanted = folded(query);
  if (wanted === '') return [...zones];

  const offset = offsetQuery(wanted);
  if (offset !== null) {
    const prefix = `${offset.sign}${offset.hours}:${offset.minutes ?? ''}`;

    return zones.filter((zone) =>
      offset.minutes === null ? zone.offset.startsWith(prefix) : zone.offset === prefix,
    );
  }

  return zones.filter((zone) =>
    [zone.city, zone.country, zone.id.replace(/_/g, ' ')].some((text) =>
      folded(text).includes(wanted),
    ),
  );
}

/** The zone a typed text names exactly, by its label or its city, so a typed "Lagos" saves without a pick. */
export function exactZone<Z extends ZoneRow>(zones: readonly Z[], typed: string): Z | null {
  const wanted = folded(typed);

  return (
    zones.find((zone) => folded(zoneLabel(zone)) === wanted || folded(zone.city) === wanted) ?? null
  );
}
