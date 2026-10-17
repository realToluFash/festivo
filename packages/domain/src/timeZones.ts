export interface ZoneRow {
  id: string;
  /** In the reader's language, from CLDR (sc-986); `ianaCity` is IANA's own spelling, which search also finds. */
  city: string;
  ianaCity?: string;
  /** tzdata's `backward` links to the zone, such as Calcutta for Kolkata. */
  formerNames?: readonly string[];
  country: string;
  offset: string;
}

/** "Lagos (UTC+01:00)", as Settings > Account labels every zone (sc-868). */
export function zoneLabel(zone: ZoneRow): string {
  return `${zone.city} (UTC${zone.offset})`;
}

/** Accents, case and the punctuation CLDR's cities carry (Saint-Jean, St. John’s) never decide a match. */
function folded(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-.'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function ownNameMatches(zone: ZoneRow, wanted: string): boolean {
  return (
    [zone.city, zone.ianaCity ?? '', zone.country, zone.id.replace(/_/g, ' ')].some((text) =>
      folded(text).includes(wanted),
    ) || folded(zoneLabel(zone)).startsWith(wanted)
  );
}

/** An offset query matches by offset alone ("+5" the hour, "+5:30" exactly); text matches a label only from its start. */
export function matchingZones<Z extends ZoneRow>(zones: readonly Z[], query: string): Z[] {
  const wanted = folded(query);
  if (wanted === '') return [...zones];

  const offset = offsetQuery(query.toLowerCase().trim());
  if (offset !== null) {
    const prefix = `${offset.sign}${offset.hours}:${offset.minutes ?? ''}`;

    return zones.filter((zone) =>
      offset.minutes === null ? zone.offset.startsWith(prefix) : zone.offset === prefix,
    );
  }

  return zones.filter((zone) => ownNameMatches(zone, wanted) || formerName(zone, query) != null);
}

/** The former name a row was found by, to show as "was Calcutta"; null when its own name, country or offset matched. */
export function formerName(zone: ZoneRow, query: string): string | null {
  const wanted = folded(query);
  if (
    wanted === '' ||
    offsetQuery(query.toLowerCase().trim()) !== null ||
    ownNameMatches(zone, wanted)
  ) {
    return null;
  }

  return (zone.formerNames ?? []).find((name) => folded(name).includes(wanted)) ?? null;
}

/** The zone a typed text names exactly, by its label or either spelling of its city; never by a former name. */
export function exactZone<Z extends ZoneRow>(zones: readonly Z[], typed: string): Z | null {
  const wanted = folded(typed);

  return (
    zones.find(
      (zone) =>
        folded(zoneLabel(zone)) === wanted ||
        folded(zone.city) === wanted ||
        folded(zone.ianaCity ?? '') === wanted,
    ) ?? null
  );
}
