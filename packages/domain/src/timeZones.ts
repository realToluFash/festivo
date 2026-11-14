import { zoneCity } from './regions.ts';

export interface ZoneRow {
  id: string;
  /** In the reader's language, from CLDR (sc-986); `ianaCity` is IANA's own spelling, which search also finds. */
  city: string;
  ianaCity?: string;
  /** tzdata's `backward` links to the zone (Calcutta, Zaporozhye, GB), which search finds. */
  aliases?: readonly string[];
  /** The one link that is a name the city once had, CLDR's own key for the zone (sc-1562). */
  formerName?: string | null;
  country: string;
  offset: string;
}

/** The account's zone as its card shows it: waiting while the list that names it is on its way (sc-27219). */
export type ZoneValue =
  { kind: 'unset' } | { kind: 'waiting' } | { kind: 'shown'; name: string; id: string | null };

/** With no row for the zone once the list has come or failed, IANA's city stands in, and an id that is only a city shows once. */
export function zoneValue(timezone: string | null, zones: readonly ZoneRow[] | null): ZoneValue {
  if (timezone == null) return { kind: 'unset' };

  const row = zones?.find((zone) => zone.id === timezone);
  if (row != null) return { kind: 'shown', name: zoneLabel(row), id: shownId(timezone) };
  if (zones == null) return { kind: 'waiting' };

  const city = zoneCity(timezone);

  return { kind: 'shown', name: city, id: city === timezone ? null : shownId(timezone) };
}

function shownId(timezone: string): string {
  return timezone.replace(/_/g, ' ');
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

  return zones.filter(
    (zone) =>
      ownNameMatches(zone, wanted) ||
      (zone.aliases ?? []).some((alias) => folded(alias).includes(wanted)),
  );
}

/** The former name a row was found by, to show as "was Calcutta"; null when its own name, country, offset or another alias matched. */
export function formerName(zone: ZoneRow, query: string): string | null {
  const wanted = folded(query);
  if (
    wanted === '' ||
    offsetQuery(query.toLowerCase().trim()) !== null ||
    ownNameMatches(zone, wanted)
  ) {
    return null;
  }

  const former = zone.formerName ?? null;

  return former !== null && folded(former).includes(wanted) ? former : null;
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
