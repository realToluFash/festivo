import type {
  KitchenStationsRead,
  ServiceCourseItem,
  ServiceFlags,
  ServicePlate,
  ServiceRead,
  ServiceTray,
} from '@soirely/api-client';
import { type ItemMark, heldUpMinutes } from '@soirely/domain';

export interface StationItemLine {
  courseId: string;
  course: string | null;
  key: string;
  /** Null on Chef's choice. */
  name: string | null;
  /** Plates still to get it here: not marked On at this stop, among orders at To serve or Dishing and owed plates. */
  toDish: number;
  waiting: number;
  item: ServiceCourseItem;
  heldUp: number | null;
}

export interface FacedItem {
  key: string;
  name: string | null;
  course: string | null;
  mark: ItemMark | null;
  preparing: boolean;
}

export interface FacedPlate {
  position: number;
  plateId: string;
  seat: string;
  variant: string | null;
  flags: ServiceFlags;
  flagged: boolean;
  items: FacedItem[];
}

export interface StationTray {
  id: string;
  table: string;
  waiter: string;
  plates: number;
  flagged: number;
  needs: { key: string; name: string | null; course: string | null; count: number }[];
  startedAt: string;
  hereSince: string | null;
}

export interface StationView {
  fired: boolean;
  latest: string | null;
  left: StationItemLine[];
  heading: StationTray[];
  here: { tray: StationTray; faced: FacedPlate[] }[];
}

export const NO_FLAGS: ServiceFlags = {
  allergens: [],
  allergenOther: null,
  diet: [],
  dietOther: null,
};

export function isFlagged(flags: ServiceFlags): boolean {
  return (
    flags.allergens.length > 0 ||
    flags.diet.length > 0 ||
    (flags.allergenOther ?? '') !== '' ||
    (flags.dietOther ?? '') !== ''
  );
}

const time = (iso: string | null): number => (iso == null ? Number.NaN : Date.parse(iso));

function travelling(tray: ServiceTray): boolean {
  return !tray.done && !tray.steps.some((one) => one.step === 'takeToTable');
}

function startedAt(tray: ServiceTray): string {
  return tray.steps.find((one) => one.step === 'start')?.at ?? tray.steps[0]?.at ?? '';
}

/** When the tray became here, or null: at the first stop as it starts; elsewhere once every plate is marked at each stop before, or at the first mark made here. */
export function hereSince(tray: ServiceTray, station: string): string | null {
  const index = tray.stops.findIndex((stop) => stop.id === station);

  if (index < 0) return null;
  if (index === 0) return startedAt(tray);
  const here = tray.stops[index]!.marks.flatMap((one) =>
    one.mark == null || one.at == null ? [] : [time(one.at)],
  );
  const before = tray.stops.slice(0, index).flatMap((stop) => stop.marks);
  const allBefore = before.every((one) => one.mark != null);
  const doneBefore = allBefore
    ? Math.max(
        time(startedAt(tray)),
        ...before.map((one) => time(one.at)).filter((at) => !Number.isNaN(at)),
      )
    : Number.NaN;
  const firstHere = here.length > 0 ? Math.min(...here) : Number.NaN;
  const at = [doneBefore, firstHere].filter((one) => !Number.isNaN(one));

  return at.length === 0 ? null : new Date(Math.min(...at)).toISOString();
}

interface Seen {
  plates: Map<string, ServicePlate>;
  seats: Map<string, { seat: string; flags: ServiceFlags }>;
  tables: Map<string, string>;
  courses: Map<string, string>;
  trays: Map<string, ServiceTray>;
}

function seen(reads: readonly ServiceRead[]): Seen {
  const out: Seen = {
    plates: new Map(),
    seats: new Map(),
    tables: new Map(),
    courses: new Map(),
    trays: new Map(),
  };

  for (const read of reads) {
    out.courses.set(read.course.id, read.course.name);
    for (const table of read.tables) {
      out.tables.set(table.key, table.name);
      for (const plate of table.plates) out.plates.set(plate.id, plate);
      for (const guest of table.guests) {
        out.seats.set(guest.id, { seat: guest.seat, flags: guest.flags });
        if (guest.order == null) continue;
        out.plates.set(guest.order.id, guest.order);
        for (const owed of guest.order.owed) out.plates.set(owed.id, owed);
      }
    }
    for (const tray of read.trays) {
      const had = out.trays.get(tray.id);
      out.trays.set(tray.id, had == null || had.courseId !== read.course.id ? tray : had);
    }
  }

  return out;
}

const onThePlate = (plate: ServicePlate) =>
  plate.items.filter((item) => !plate.toFollow.includes(item.key));

function markHere(
  trays: Map<string, ServiceTray>,
  plate: ServicePlate,
  station: string,
  key: string,
): ItemMark | null {
  const tray = plate.trayId == null ? null : trays.get(plate.trayId);
  const stop = tray?.stops.find((one) => one.id === station);

  return stop?.marks.find((one) => one.plateId === plate.id && one.item === key)?.mark ?? null;
}

/** @param fired every fired course's read, in the menu's order; the last is the latest fired */
export function stationView(
  station: string,
  fired: readonly ServiceRead[],
  now: Date,
): StationView {
  const latest = fired.at(-1) ?? null;

  if (latest == null) return { fired: false, latest: null, left: [], heading: [], here: [] };
  const all = seen(fired);
  const courseLabel = (courseId: string) =>
    courseId === latest.course.id ? null : (all.courses.get(courseId) ?? null);

  const left: StationItemLine[] = [];
  for (const read of [latest, ...fired.slice(0, -1)]) {
    const isLatest = read === latest;
    for (const item of read.items) {
      if (item.station?.id !== station) continue;
      let toDish = 0;
      let waiting = 0;
      for (const table of read.tables) {
        for (const guest of table.guests) {
          const order = guest.order;
          if (order == null) continue;
          if (order.held && order.holding.includes(item.key)) waiting += 1;
          for (const plate of [order, ...order.owed]) {
            if (plate.stage !== 'toServe' && plate.stage !== 'dishing') continue;
            if (!onThePlate(plate).some((one) => one.key === item.key)) continue;
            if (markHere(all.trays, plate, station, item.key) !== 'on') toDish += 1;
          }
        }
      }
      if (!isLatest && toDish === 0) continue;
      left.push({
        courseId: read.course.id,
        course: isLatest ? null : read.course.name,
        key: item.key,
        name: item.name,
        toDish,
        waiting,
        item,
        heldUp: heldUpMinutes(item, now),
      });
    }
  }

  const preparing = new Set(
    fired.flatMap((read) =>
      read.items
        .filter((item) => item.state === 'preparing')
        .map((item) => `${read.course.id}|${item.key}`),
    ),
  );

  const heading: StationTray[] = [];
  const here: { tray: StationTray; faced: FacedPlate[] }[] = [];

  for (const tray of all.trays.values()) {
    if (!travelling(tray)) continue;
    const stop = tray.stops.find((one) => one.id === station);
    if (stop == null || stop.marks.length === 0) continue;
    if (stop.marks.every((one) => one.mark != null)) continue;

    const plates = tray.plates.flatMap((id) => {
      const plate = all.plates.get(id);
      return plate == null ? [] : [plate];
    });
    const flagsOf = (plate: ServicePlate) => all.seats.get(plate.guestId)?.flags ?? NO_FLAGS;
    const needs = new Map<string, StationTray['needs'][number]>();
    for (const mark of stop.marks) {
      if (mark.mark != null) continue;
      const plate = all.plates.get(mark.plateId);
      const named = plate?.items.find((one) => one.key === mark.item);
      const id = `${plate?.courseId ?? ''}|${mark.item}`;
      const had = needs.get(id);
      if (had != null) had.count += 1;
      else
        needs.set(id, {
          key: mark.item,
          name: named?.name ?? null,
          course: plate == null ? null : courseLabel(plate.courseId),
          count: 1,
        });
    }
    const since = hereSince(tray, station);
    const read: StationTray = {
      id: tray.id,
      table: all.tables.get(tray.table) ?? tray.table,
      waiter: tray.waiter.name,
      plates: plates.length,
      flagged: plates.filter((plate) => isFlagged(flagsOf(plate))).length,
      needs: [...needs.values()],
      startedAt: startedAt(tray),
      hereSince: since,
    };

    if (since == null) {
      heading.push(read);
      continue;
    }

    const faced = [...plates].reverse().map((plate, index): FacedPlate => {
      const flags = flagsOf(plate);
      const mine = stop.marks.filter((one) => one.plateId === plate.id);
      return {
        position: index + 1,
        plateId: plate.id,
        seat: all.seats.get(plate.guestId)?.seat ?? '',
        variant: plate.variant,
        flags,
        flagged: isFlagged(flags),
        items: mine.map((one) => ({
          key: one.item,
          name: plate.items.find((item) => item.key === one.item)?.name ?? null,
          course: courseLabel(plate.courseId),
          mark: one.mark,
          preparing: preparing.has(`${plate.courseId}|${one.item}`),
        })),
      };
    });
    here.push({ tray: read, faced });
  }

  heading.sort((a, b) => time(a.startedAt) - time(b.startedAt));
  here.sort((a, b) => time(a.tray.hereSince) - time(b.tray.hereSince));

  return { fired: true, latest: latest.course.name, left, heading, here };
}

/** Where a station's screen opens (sc-4015): the roster's station always; on none, the last one picked on this device for the event if it is still a kitchen station; else the list. */
export function openingStation(
  stations: KitchenStationsRead,
  picked: string | null,
): string | null {
  if (stations.yours != null && stations.stations.some((one) => one.id === stations.yours))
    return stations.yours;
  if (picked != null && stations.stations.some((one) => one.id === picked)) return picked;

  return null;
}
