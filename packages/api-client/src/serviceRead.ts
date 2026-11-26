import {
  ITEM_MARKS,
  ITEM_STATES,
  type ItemMark,
  type ItemState,
  PLATE_STAGES,
  type PlateStage,
  SERVICE_PHASES,
  type ServicePhase,
} from '@soirely/domain';

export interface ServiceFlags {
  allergens: string[];
  allergenOther: string | null;
  diet: string[];
  dietOther: string | null;
}

export interface ServicePlateItem {
  key: string;
  /** Null on Chef's choice. */
  name: string | null;
  state: ItemState;
}

export interface ServicePlate {
  id: string;
  guestId: string;
  courseId: string;
  isOrder: boolean;
  stage: PlateStage;
  items: ServicePlateItem[];
  variant: string | null;
  toFollow: string[];
  trayId: string | null;
  owedReason: string | null;
  owedAt: string | null;
}

export interface ServiceGuest {
  id: string;
  seat: string;
  flags: ServiceFlags;
  order: (ServicePlate & { owed: ServicePlate[]; held: boolean; holding: string[] }) | null;
}

export interface ServiceTable {
  key: string;
  kind: string;
  name: string;
  firedAt: string | null;
  guests: ServiceGuest[];
  plates: ServicePlate[];
}

export interface ServiceCourseItem {
  /** Null until it is first marked; what an undo names. */
  id: string | null;
  key: string;
  name: string | null;
  station: { id: string; name: string } | null;
  state: ItemState;
  readyIn: number | null;
  changedAt: string | null;
  changedBy: string | null;
  preparingSince: string | null;
}

export interface ServiceTrayMark {
  plateId: string;
  item: string;
  mark: ItemMark | null;
  at: string | null;
}

export interface ServiceTray {
  id: string;
  courseId: string;
  table: string;
  waiter: { id: string; name: string };
  plates: string[];
  stops: { id: string; name: string; marks: ServiceTrayMark[] }[];
  steps: { step: string; at: string; by: string }[];
  done: boolean;
}

export interface ServiceRead {
  course: { id: string; name: string };
  items: ServiceCourseItem[];
  tables: ServiceTable[];
  trays: ServiceTray[];
  phase: ServicePhase | null;
}

export interface KitchenStationsRead {
  /** The event's name, since working the pass reads no event. */
  event: string;
  /** The reader's name, as the roster has it when they are on it. */
  you: string;
  stations: {
    id: string;
    name: string;
    /** `you` marks the reader's own entry, by the roster rather than by name. */
    people: { id: string; name: string; you: boolean }[];
  }[];
  /** The station the reader is on, by the roster; null on none. */
  yours: string | null;
  fired: { id: string; name: string; firedAt: string }[];
}

type Raw = Record<string, unknown>;

const isRecord = (value: unknown): value is Raw =>
  typeof value === 'object' && value != null && !Array.isArray(value);

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const number = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const texts = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string') : [];

function oneOf<T extends string>(list: readonly T[], value: unknown): T | null {
  return (list as readonly unknown[]).includes(value) ? (value as T) : null;
}

function each<T>(value: unknown, parse: (raw: Raw) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const out: T[] = [];

  for (const one of value) {
    const parsed = isRecord(one) ? parse(one) : null;

    if (parsed == null) return null;
    out.push(parsed);
  }

  return out;
}

function asFlags(raw: unknown): ServiceFlags {
  const flags = isRecord(raw) ? raw : {};

  return {
    allergens: texts(flags.allergens),
    allergenOther: text(flags.allergenOther),
    diet: texts(flags.diet),
    dietOther: text(flags.dietOther),
  };
}

function asPlate(raw: Raw): ServicePlate | null {
  const id = text(raw.id);
  const guestId = text(raw.guestId);
  const courseId = text(raw.courseId);
  const stage = oneOf(PLATE_STAGES, raw.stage);
  const items = each(raw.items, (item): ServicePlateItem | null => {
    const key = text(item.key);
    const state = oneOf(ITEM_STATES, item.state);

    return key == null || state == null ? null : { key, name: text(item.name), state };
  });

  if (id == null || guestId == null || courseId == null || stage == null || items == null)
    return null;

  return {
    id,
    guestId,
    courseId,
    isOrder: raw.isOrder === true,
    stage,
    items,
    variant: text(raw.variant),
    toFollow: texts(raw.toFollow),
    trayId: text(raw.trayId),
    owedReason: text(raw.owedReason),
    owedAt: text(raw.owedAt),
  };
}

function asGuest(raw: Raw): ServiceGuest | null {
  const id = text(raw.id);
  const seat = text(raw.seat) ?? (number(raw.seat) == null ? null : String(raw.seat));

  if (id == null || seat == null) return null;
  let order: ServiceGuest['order'] = null;

  if (isRecord(raw.order)) {
    const plate = asPlate(raw.order);
    const owed = each(raw.order.owed ?? [], asPlate);

    if (plate == null || owed == null) return null;
    order = { ...plate, owed, held: raw.order.held === true, holding: texts(raw.order.holding) };
  }

  return { id, seat, flags: asFlags(raw.flags), order };
}

function asTable(raw: Raw): ServiceTable | null {
  const key = text(raw.key);
  const name = text(raw.name);
  const guests = each(raw.guests, asGuest);
  const plates = each(raw.plates ?? [], asPlate);

  if (key == null || name == null || guests == null || plates == null) return null;

  return { key, kind: text(raw.kind) ?? 'table', name, firedAt: text(raw.firedAt), guests, plates };
}

function asItem(raw: Raw): ServiceCourseItem | null {
  const key = text(raw.key);
  const state = oneOf(ITEM_STATES, raw.state);

  if (key == null || state == null) return null;
  const station = isRecord(raw.station) ? raw.station : null;
  const stationId = text(station?.id);
  const stationName = text(station?.name);

  return {
    id: text(raw.id),
    key,
    name: text(raw.name),
    station: stationId == null || stationName == null ? null : { id: stationId, name: stationName },
    state,
    readyIn: number(raw.readyIn),
    changedAt: text(raw.changedAt),
    changedBy: text(raw.changedBy),
    preparingSince: text(raw.preparingSince),
  };
}

function asTray(raw: Raw): ServiceTray | null {
  const id = text(raw.id);
  const courseId = text(raw.courseId);
  const table = text(raw.table);
  const waiter = isRecord(raw.waiter) ? raw.waiter : null;
  const waiterId = text(waiter?.id);
  const waiterName = text(waiter?.name);
  const stops = each(raw.stops, (stop) => {
    const stopId = text(stop.id);
    const stopName = text(stop.name);
    const marks = each(stop.marks, (mark): ServiceTrayMark | null => {
      const plateId = text(mark.plateId);
      const item = text(mark.item);

      return plateId == null || item == null
        ? null
        : { plateId, item, mark: oneOf(ITEM_MARKS, mark.mark), at: text(mark.at) };
    });

    return stopId == null || stopName == null || marks == null
      ? null
      : { id: stopId, name: stopName, marks };
  });
  const steps = each(raw.steps ?? [], (step) => {
    const name = text(step.step);
    const at = text(step.at);

    return name == null || at == null ? null : { step: name, at, by: text(step.by) ?? '' };
  });

  if (
    id == null ||
    courseId == null ||
    table == null ||
    waiterId == null ||
    waiterName == null ||
    stops == null ||
    steps == null
  )
    return null;

  return {
    id,
    courseId,
    table,
    waiter: { id: waiterId, name: waiterName },
    plates: texts(raw.plates),
    stops,
    steps,
    done: raw.done === true,
  };
}

export function asServiceRead(raw: unknown): ServiceRead | null {
  if (!isRecord(raw) || !isRecord(raw.course)) return null;
  const id = text(raw.course.id);
  const name = text(raw.course.name);
  const items = each(raw.items, asItem);
  const tables = each(raw.tables, asTable);
  const trays = each(raw.trays, asTray);

  if (id == null || name == null || items == null || tables == null || trays == null) return null;

  return { course: { id, name }, items, tables, trays, phase: oneOf(SERVICE_PHASES, raw.phase) };
}

export function asKitchenStationsRead(raw: unknown): KitchenStationsRead | null {
  if (!isRecord(raw)) return null;
  const stations = each(raw.stations, (one) => {
    const id = text(one.id);
    const name = text(one.name);
    const people = each(one.people ?? [], (person) => {
      const personId = text(person.id);
      const personName = text(person.name);

      return personId == null || personName == null
        ? null
        : { id: personId, name: personName, you: person.you === true };
    });

    return id == null || name == null || people == null ? null : { id, name, people };
  });
  const fired = each(raw.fired, (one) => {
    const id = text(one.id);
    const name = text(one.name);
    const firedAt = text(one.firedAt);

    return id == null || name == null || firedAt == null ? null : { id, name, firedAt };
  });

  const event = text(raw.event);
  const you = text(raw.you);
  if (stations == null || fired == null || event == null || you == null) return null;

  return { event, you, stations, yours: text(raw.yours), fired };
}
