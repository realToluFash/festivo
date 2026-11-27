import {
  ApiError,
  type KeptServiceTap,
  type KitchenStationsRead,
  type ServiceCourseItem,
  type ServiceFlags,
  type ServicePlate,
  type ServiceRead,
  type ServiceTray,
} from '@soirely/api-client';
import {
  type ItemMark,
  type ItemState,
  type ServicePhase,
  type TapExpected,
  type TapRefusal,
  UNDO_MINUTES,
  formatTimeOfDay,
  heldUpMinutes,
  refusalKey,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import { blockName } from './blockName.ts';

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
  tables: Map<string, string | null>;
  blocks: Map<string, string[]>;
  courses: Map<string, string>;
  trays: Map<string, ServiceTray>;
}

function seen(reads: readonly ServiceRead[]): Seen {
  const out: Seen = {
    plates: new Map(),
    seats: new Map(),
    tables: new Map(),
    blocks: new Map(),
    courses: new Map(),
    trays: new Map(),
  };

  for (const read of reads) {
    out.courses.set(read.course.id, read.course.name);
    for (const table of read.tables) {
      out.tables.set(table.key, table.name);
      out.blocks.set(table.key, table.seats);
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

function trayName(t: TFunction, key: string, all: Seen): string {
  const name = all.tables.get(key);
  if (name != null) return name;
  const seats = all.blocks.get(key) ?? [];

  return seats.length === 0 ? key : blockName(t, { name: null, seats });
}

/** @param fired every fired course's read, in the menu's order; the last is the latest fired */
export function stationView(
  station: string,
  fired: readonly ServiceRead[],
  now: Date,
  t: TFunction,
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
        heldUp: waiting > 0 ? heldUpMinutes(item, now) : null,
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
      table: trayName(t, tray.table, all),
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

/** The last pick is the account's, on this device, for the event (sc-95382, Decided 26 Nov): another account signing in here has picked none. */
export const pickedKey = (accountId: string, eventId: string) =>
  `soirely.station.${accountId}.${eventId}`;

export interface PickStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export function rememberPick(
  store: PickStore,
  accountId: string,
  eventId: string,
  station: string,
): Promise<void> {
  return store.setItem(pickedKey(accountId, eventId), station);
}

export function readPick(
  store: PickStore,
  accountId: string,
  eventId: string,
): Promise<string | null> {
  return store.getItem(pickedKey(accountId, eventId)).catch(() => null);
}

/** A mark this device made, open to Undo: the tap it was kept as, and the item by its course and key, since an item has no id until its first mark reaches the server. */
export interface StationMark {
  courseId: string;
  key: string;
  was: ItemState;
  /** The state the mark left, which its undo expects to find. */
  to: ItemState;
  tapKey: string;
  /** By the corrected clock, as the window is measured. */
  at: number;
}

export function undoOpen(mark: StationMark, now: Date): boolean {
  const since = now.getTime() - mark.at;

  return since >= 0 && since < UNDO_MINUTES * 60_000;
}

/** When each mark's Undo closes, for the clock that redraws the station as it does. */
export function undoCloses(marks: Iterable<StationMark>): number[] {
  return Array.from(marks, (mark) => mark.at + UNDO_MINUTES * 60_000);
}

export type UndoPlan =
  | { kind: 'drop'; tapKey: string }
  | { kind: 'send'; subject: string; expected: TapExpected }
  | { kind: 'unknown' };

export function undoPlan(
  mark: StationMark,
  kept: readonly KeptServiceTap[],
  reads: readonly ServiceRead[],
): UndoPlan {
  if (kept.some((tap) => tap.key === mark.tapKey)) return { kind: 'drop', tapKey: mark.tapKey };
  const id = reads
    .find((read) => read.course.id === mark.courseId)
    ?.items.find((item) => item.key === mark.key)?.id;

  return id == null
    ? { kind: 'unknown' }
    : {
        kind: 'send',
        subject: id,
        expected: { item: mark.to, of: { courseId: mark.courseId, item: mark.key } },
      };
}

/** The marks still open to Undo once these taps were refused as Not sent: a refused mark never landed, so there is nothing to undo. */
export function withoutRefused<K>(
  marks: ReadonlyMap<K, StationMark>,
  refused: readonly { tap: { key: string } }[],
): Map<K, StationMark> {
  const keys = new Set(refused.map((one) => one.tap.key));

  return new Map([...marks].filter(([, mark]) => !keys.has(mark.tapKey)));
}

/** What the undo line says was marked: the state the mark left, so a new time while Preparing reads Preparing. */
export function undoWords(mark: StationMark): 'station.undoPreparing' | 'station.undoReady' {
  return mark.to === 'preparing' ? 'station.undoPreparing' : 'station.undoReady';
}

/** The row's as of, in the Offline band's own form and, unless a zone is given, the device's zone (sc-97945). */
export function stationAsOf(at: Date | number | string, locale: string, timeZone?: string): string {
  return formatTimeOfDay(new Date(at), locale, timeZone);
}

export function notSentLine(t: TFunction, line: TapRefusal, reads: readonly ServiceRead[]): string {
  const key = refusalKey(line);
  if (key == null) return line.kind === 'other' ? line.title : '';
  const item =
    line.kind === 'itemNow'
      ? (reads.flatMap((read) => read.items).find((one) => one.key === line.item)?.name ??
        t('station.chefsChoice'))
      : '';

  return t(key, {
    item,
    by: 'by' in line ? (line.by ?? '') : '',
    who: 'table' in line ? line.table : '',
    name: line.kind === 'trayNotYours' ? line.name : '',
    count: UNDO_MINUTES,
  });
}

/** The card a refused read shows: a 403 naming the floor sends a floor worker there, any other 403 is no access. */
export function refusedAccess(error: unknown): 'floor' | 'none' | null {
  if (!(error instanceof ApiError) || error.status !== 403) return null;
  return error.problem.worksAt === 'floor' ? 'floor' : 'none';
}

export type TopicMessage =
  { kind: 'heartbeat' } | { kind: 'phase'; phase: ServicePhase } | { kind: 'data' };

/** Anything on the service topic that is not a heartbeat or a phase, a station change among them, is data to re-read. */
export function topicMessage(data: string | null): TopicMessage {
  let message: unknown = null;
  try {
    message = data == null ? null : JSON.parse(data);
  } catch {
    message = null;
  }
  const type =
    typeof message === 'object' && message != null
      ? (message as { type?: unknown; phase?: unknown })
      : {};
  if (type.type === 'heartbeat') return { kind: 'heartbeat' };
  if (type.type === 'phase' && typeof type.phase === 'string') {
    return { kind: 'phase', phase: type.phase as ServicePhase };
  }
  return { kind: 'data' };
}
