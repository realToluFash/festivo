/** Who's here (sc-3918): who has clocked in on the event tonight, read from clock-ins alone. Every time is an instant in the event's offset (ISO 8601). */

export interface WhosHereStation {
  id: string;
  name: string;
}

export interface WhosHereRow {
  id: string;
  name: string;
  job: string | null;
  station: WhosHereStation | null;
  shiftStartsAt: string;
  shiftEndsAt: string;
  clockedInAt: string | null;
  /** E.164; null with none, and after the 30-day erasure. */
  phone: string | null;
  canAddMobile: boolean;
  coveredBy: string | null;
  movedFrom: { station: string; at: string } | null;
  /** Their station has nobody clocked in. */
  nobodyHere: boolean;
}

export type WalkOnEnd = 'shift' | 'event' | 'day';

export interface WhosHereJob {
  id: string;
  name: string;
  walkOnEndsAt: string;
  walkOnEnd: WalkOnEnd;
}

export interface WhosHereViewer {
  /** A station lead's own station; null for the whole event's view. */
  station: WhosHereStation | null;
  canCover: boolean;
  canAddWalkOn: boolean;
}

export interface WhosHere {
  now: string;
  timeZone: string;
  countryCode: string | null;
  ended: boolean;
  viewer: WhosHereViewer;
  notHere: WhosHereRow[];
  here: WhosHereRow[];
  didntClockIn: WhosHereRow[];
  stations: { id: string; name: string; people: string[] }[];
  doorStations: WhosHereStation[];
  jobs: WhosHereJob[];
}

export interface TypedMobile {
  countryCode: string;
  number: string;
}

export interface WalkOnTyped {
  fullName: string;
  mobile: TypedMobile | null;
  job: string;
  station: string | null;
}

export interface WalkOnAdded {
  staff: { id: string; name: string };
  /** The link to copy, with a number; null without one. */
  url: string | null;
  phone: string | null;
}

export interface MobileAdded {
  url: string;
  phone: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value != null && !Array.isArray(value);

const textOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

function asStation(raw: unknown): WhosHereStation | null {
  return isRecord(raw) && typeof raw.id === 'string' && typeof raw.name === 'string'
    ? { id: raw.id, name: raw.name }
    : null;
}

function asRow(raw: unknown): WhosHereRow | null {
  if (!isRecord(raw)) return null;
  const station = raw.station === null ? null : asStation(raw.station);
  const moved = raw.movedFrom;
  const movedFrom =
    moved === null
      ? null
      : isRecord(moved) && typeof moved.station === 'string' && typeof moved.at === 'string'
        ? { station: moved.station, at: moved.at }
        : undefined;

  if (
    typeof raw.id !== 'string' ||
    typeof raw.name !== 'string' ||
    !textOrNull(raw.job) ||
    (raw.station !== null && station == null) ||
    typeof raw.shiftStartsAt !== 'string' ||
    typeof raw.shiftEndsAt !== 'string' ||
    !textOrNull(raw.clockedInAt) ||
    !textOrNull(raw.phone) ||
    typeof raw.canAddMobile !== 'boolean' ||
    !textOrNull(raw.coveredBy) ||
    movedFrom === undefined ||
    typeof raw.nobodyHere !== 'boolean'
  )
    return null;

  return {
    id: raw.id,
    name: raw.name,
    job: raw.job,
    station,
    shiftStartsAt: raw.shiftStartsAt,
    shiftEndsAt: raw.shiftEndsAt,
    clockedInAt: raw.clockedInAt,
    phone: raw.phone,
    canAddMobile: raw.canAddMobile,
    coveredBy: raw.coveredBy,
    movedFrom,
    nobodyHere: raw.nobodyHere,
  };
}

function rowsOf(raw: unknown): WhosHereRow[] | null {
  if (!Array.isArray(raw)) return null;
  const rows = raw.map(asRow);

  return rows.every((row) => row != null) ? (rows as WhosHereRow[]) : null;
}

function asJob(raw: unknown): WhosHereJob | null {
  return isRecord(raw) &&
    typeof raw.id === 'string' &&
    typeof raw.name === 'string' &&
    typeof raw.walkOnEndsAt === 'string' &&
    (raw.walkOnEnd === 'shift' || raw.walkOnEnd === 'event' || raw.walkOnEnd === 'day')
    ? { id: raw.id, name: raw.name, walkOnEndsAt: raw.walkOnEndsAt, walkOnEnd: raw.walkOnEnd }
    : null;
}

export function asWhosHere(raw: unknown): WhosHere | null {
  if (!isRecord(raw) || !isRecord(raw.viewer)) return null;
  const { viewer } = raw;
  const viewerStation = viewer.station === null ? null : asStation(viewer.station);
  const notHere = rowsOf(raw.notHere);
  const here = rowsOf(raw.here);
  const didntClockIn = rowsOf(raw.didntClockIn);
  const stations = Array.isArray(raw.stations)
    ? raw.stations.map((one: unknown) =>
        isRecord(one) &&
        typeof one.id === 'string' &&
        typeof one.name === 'string' &&
        Array.isArray(one.people) &&
        one.people.every((name: unknown) => typeof name === 'string')
          ? { id: one.id, name: one.name, people: one.people as string[] }
          : null,
      )
    : null;
  const doorStations = Array.isArray(raw.doorStations) ? raw.doorStations.map(asStation) : null;
  const jobs = Array.isArray(raw.jobs) ? raw.jobs.map(asJob) : null;

  if (
    typeof raw.now !== 'string' ||
    typeof raw.timeZone !== 'string' ||
    !textOrNull(raw.countryCode) ||
    typeof raw.ended !== 'boolean' ||
    (viewer.station !== null && viewerStation == null) ||
    typeof viewer.canCover !== 'boolean' ||
    typeof viewer.canAddWalkOn !== 'boolean' ||
    notHere == null ||
    here == null ||
    didntClockIn == null ||
    stations == null ||
    !stations.every((one) => one != null) ||
    doorStations == null ||
    !doorStations.every((one) => one != null) ||
    jobs == null ||
    !jobs.every((one) => one != null)
  )
    return null;

  return {
    now: raw.now,
    timeZone: raw.timeZone,
    countryCode: raw.countryCode,
    ended: raw.ended,
    viewer: {
      station: viewerStation,
      canCover: viewer.canCover,
      canAddWalkOn: viewer.canAddWalkOn,
    },
    notHere,
    here,
    didntClockIn,
    stations: stations as WhosHere['stations'],
    doorStations: doorStations as WhosHereStation[],
    jobs: jobs as WhosHereJob[],
  };
}

export function asWalkOnAdded(raw: unknown): WalkOnAdded | null {
  return isRecord(raw) &&
    isRecord(raw.staff) &&
    typeof raw.staff.id === 'string' &&
    typeof raw.staff.name === 'string' &&
    textOrNull(raw.url) &&
    textOrNull(raw.phone)
    ? { staff: { id: raw.staff.id, name: raw.staff.name }, url: raw.url, phone: raw.phone }
    : null;
}

export function asMobileAdded(raw: unknown): MobileAdded | null {
  return isRecord(raw) && typeof raw.url === 'string' && typeof raw.phone === 'string'
    ? { url: raw.url, phone: raw.phone }
    : null;
}
