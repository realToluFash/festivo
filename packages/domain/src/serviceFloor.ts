import type { ServicePhase } from './serviceFreshness.ts';
import type {
  HeldChoice,
  ItemState,
  NoOrderReason,
  OwedReason,
  PlateStage,
  SentBackReason,
} from './serviceStages.ts';

/** A course's service read (sc-4005), as much of it as Floor reads. */
export interface ServicePlateRead {
  id: string;
  guestId: string;
  courseId: string;
  isOrder: boolean;
  stage: PlateStage;
  items: { key: string; name: string | null; state: ItemState }[];
  trayId: string | null;
  owedReason: OwedReason | null;
  sentBack: { reason: SentBackReason; at: string; by: string | null }[];
}

export interface ServiceOrderRead extends ServicePlateRead {
  held: boolean;
  holding: string[];
  choice: HeldChoice | null;
  owed: ServicePlateRead[];
}

export interface ServiceGuestRead {
  id: string;
  seat: number | string;
  name: string | null;
  flags: {
    allergens: string[];
    allergenOther: string | null;
    diet: string[];
    dietOther: string | null;
  };
  order: ServiceOrderRead | null;
  noOrder: NoOrderReason | null;
}

export interface ServiceTableRead {
  key: string;
  kind: 'table' | 'row' | 'seats';
  name: string;
  seats: number;
  section: { id: string; name: string } | null;
  people: { id: string; name: string }[];
  firedAt: string | null;
  guests: ServiceGuestRead[];
}

export interface ServiceTrayRead {
  id: string;
  courseId: string;
  table: string;
  waiter: { id: string; name: string };
  plates: string[];
  done: boolean;
}

export interface ServiceCourseRead {
  phase?: ServicePhase;
  course: { id: string; name: string };
  items: { key: string; name: string | null; state: ItemState; readyIn: number | null }[];
  tables: ServiceTableRead[];
  trays: ServiceTrayRead[];
}

export interface FloorRead {
  event: string;
  courses: ServiceCourseRead[];
  yours: { id: string; name: string }[];
  floorLead: string | null;
  manage: boolean;
}

export interface FloorGuest extends ServiceGuestRead {
  owed: ServicePlateRead[];
}

export interface FloorTray {
  id: string;
  waiter: string;
  plates: number;
  stage: PlateStage | null;
}

export const FLOOR_WORDS = [
  'toServe',
  'onATray',
  'waitingOnTheKitchen',
  'notHereYet',
  'notFiredYet',
  'served',
] as const;

export type FloorWord = (typeof FLOOR_WORDS)[number];

const ON_A_TRAY: readonly PlateStage[] = ['dishing', 'checked', 'onItsWay'];

export interface FloorTable {
  key: string;
  kind: ServiceTableRead['kind'];
  name: string;
  covers: number;
  section: { id: string; name: string } | null;
  people: { id: string; name: string }[];
  word: FloorWord;
  /** The latest course fired for the table, named only when it is not the room's. */
  earlierCourse: string | null;
  served: number;
  ordered: number;
  guests: FloorGuest[];
  /** Flagged guests with a plate not yet served, in any fired course, each once. */
  flagged: FloorGuest[];
  trays: FloorTray[];
  courseId: string;
  mayWrite: boolean;
}

export type FloorGroup =
  | { kind: 'yours'; section: { id: string; name: string }; tables: FloorTable[] }
  | { kind: 'noSection'; lead: string | null }
  | { kind: 'other'; tables: FloorTable[] };

function plates(guest: ServiceGuestRead): ServicePlateRead[] {
  return guest.order == null ? [] : [guest.order, ...guest.order.owed];
}

export function owesSentBack(guest: FloorGuest): boolean {
  return guest.owed.some(
    (plate) =>
      plate.courseId === guest.order?.courseId &&
      plate.owedReason === 'sentBack' &&
      plate.stage !== 'served',
  );
}

export function hasFlags(guest: ServiceGuestRead): boolean {
  const { allergens, allergenOther, diet, dietOther } = guest.flags;

  return allergens.length > 0 || diet.length > 0 || allergenOther != null || dietOther != null;
}

export function floorWord(fired: readonly ServiceTableRead[], any: ServiceTableRead): FloorWord {
  const guests = fired.flatMap((table) => table.guests);
  const held = (guest: ServiceGuestRead) => guest.order?.held === true;

  if (guests.some((g) => !held(g) && plates(g).some((p) => p.stage === 'toServe')))
    return 'toServe';
  if (guests.some((g) => plates(g).some((p) => ON_A_TRAY.includes(p.stage)))) return 'onATray';
  if (guests.some(held)) return 'waitingOnTheKitchen';
  if (any.guests.every((g) => g.noOrder === 'notHereYet')) return 'notHereYet';
  if (fired.length === 0) return 'notFiredYet';
  return 'served';
}

const KIND_ORDER: Record<ServiceTableRead['kind'], number> = { table: 0, row: 1, seats: 2 };

/** Tables by name with numbers compared by value, then rows, then blocks of single seats (sc-36033); never the order received. */
export function inFloorOrder<T extends { kind: ServiceTableRead['kind']; name: string }>(
  tables: readonly T[],
  locale: string,
): T[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });

  return [...tables].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || collator.compare(a.name, b.name),
  );
}

/** The room's current course: the latest in menu order fired at any table. */
export function roomCourse(floor: FloorRead): ServiceCourseRead | null {
  return (
    [...floor.courses].reverse().find((one) => one.tables.some((t) => t.firedAt != null)) ?? null
  );
}

export function mayWriteAt(floor: FloorRead, table: ServiceTableRead): boolean {
  return (
    floor.manage ||
    table.people.length === 0 ||
    floor.yours.some((one) => one.id === table.section?.id)
  );
}

export function floorTables(floor: FloorRead): FloorTable[] {
  const room = roomCourse(floor);
  const first = floor.courses[0];
  if (first == null) return [];

  return first.tables.map((any) => {
    const reads = floor.courses.map((course) => ({
      course,
      table: course.tables.find((t) => t.key === any.key) ?? any,
    }));
    const fired = reads.filter(({ table }) => table.firedAt != null);
    const latest = fired.at(-1) ??
      reads.find((r) => r.course === room) ?? { course: first, table: any };
    const ordered = latest.table.guests.filter((g) => g.order != null);
    const word = floorWord(
      fired.map(({ table }) => table),
      any,
    );

    const theirs = fired.flatMap(({ table }) => table.guests);
    const guests = latest.table.guests.map((guest) => ({
      ...guest,
      owed: theirs.filter((g) => g.id === guest.id).flatMap((g) => g.order?.owed ?? []),
    }));
    const unserved = new Set(
      theirs.filter((g) => plates(g).some((p) => p.stage !== 'served')).map((g) => g.id),
    );
    const seated = reads.flatMap(({ course }) => course.tables.flatMap((t) => t.guests));
    const trays = new Map(
      reads.flatMap(({ course }) =>
        course.trays
          .filter((tray) => tray.table === any.key && !tray.done)
          .map((tray) => [tray.id, tray] as const),
      ),
    );

    return {
      key: any.key,
      kind: any.kind,
      name: any.name,
      covers: any.guests.length,
      section: any.section,
      people: any.people,
      word,
      earlierCourse:
        fired.length > 0 && room != null && latest.course.course.id !== room.course.id
          ? latest.course.course.name
          : null,
      served: ordered.filter((g) => g.order?.stage === 'served').length,
      // A table with no course fired counts its guests, so it reads "0 of 10 served", never "0 of 0" (Design).
      ordered: fired.length === 0 ? any.guests.length : ordered.length,
      guests,
      flagged: guests.filter((g) => hasFlags(g) && unserved.has(g.id)),
      trays: [...trays.values()].map((tray) => ({
        id: tray.id,
        waiter: tray.waiter.name,
        plates: tray.plates.length,
        stage: seated.flatMap(plates).find((plate) => plate.trayId === tray.id)?.stage ?? null,
      })),
      courseId: latest.course.course.id,
      mayWrite: mayWriteAt(floor, any),
    };
  });
}

export function floorGroups(floor: FloorRead, locale: string): FloorGroup[] {
  const tables = inFloorOrder(floorTables(floor), locale);
  const yours = floor.yours.map((section) => ({
    kind: 'yours' as const,
    section,
    tables: tables.filter((t) => t.section?.id === section.id),
  }));
  const other = tables.filter((t) => !floor.yours.some((s) => s.id === t.section?.id));
  const head: FloorGroup[] =
    yours.length > 0 ? yours : floor.manage ? [] : [{ kind: 'noSection', lead: floor.floorLead }];

  return [...head, { kind: 'other', tables: other }];
}

export interface FloorKeptTap {
  key: string;
  kind: string;
  path: string;
  body: object;
  tappedAt: string;
}

function onPlate(
  floor: FloorRead,
  id: string,
  change: (order: ServiceOrderRead, plate: ServicePlateRead) => ServiceOrderRead,
): FloorRead {
  return {
    ...floor,
    courses: floor.courses.map((course) => ({
      ...course,
      tables: course.tables.map((table) => ({
        ...table,
        guests: table.guests.map((guest) => {
          const order = guest.order;
          const plate = order == null ? null : [order, ...order.owed].find((one) => one.id === id);

          return order == null || plate == null ? guest : { ...guest, order: change(order, plate) };
        }),
      })),
    })),
  };
}

/** What the device holds with its kept choices and sent-back plates shown as made (sc-4028); a kept Undo takes the kept step it reverses back off. */
export function withKeptTaps(floor: FloorRead, kept: readonly FloorKeptTap[]): FloorRead {
  // ponytail: an Undo of a step the server already has is shown once it is sent; the read doesn't say what that step replaced.
  const standing: FloorKeptTap[] = [];

  for (const tap of kept) {
    if (tap.kind !== 'undo') {
      standing.push(tap);
      continue;
    }

    const { subject } = tap.body as { subject: string };
    const at = standing.map((one) => one.path.split('/')[2]).lastIndexOf(subject);

    if (at >= 0) standing.splice(at, 1);
  }

  return standing.reduce((read, tap) => {
    const id = tap.path.split('/')[2] ?? '';

    if (tap.kind === 'choice') {
      const { choice } = tap.body as { choice: HeldChoice };

      return onPlate(read, id, (order) => ({ ...order, choice }));
    }

    if (tap.kind !== 'sendBack') return read;
    const { reason } = tap.body as { reason: SentBackReason };

    return onPlate(read, id, (order, plate) => ({
      ...order,
      owed: [
        ...order.owed,
        {
          ...plate,
          id: tap.key,
          isOrder: false,
          stage: 'toServe',
          trayId: null,
          owedReason: 'sentBack',
          sentBack: [{ reason, at: tap.tappedAt, by: null }],
        },
      ],
    }));
  }, floor);
}

export function sectionsMoved(was: readonly string[], now: FloorRead['yours']): string[] | null {
  const same = was.length === now.length && now.every((one) => was.includes(one.id));

  return same ? null : now.map((one) => one.name);
}

export function withCourse(floor: FloorRead, read: ServiceCourseRead): FloorRead {
  return {
    ...floor,
    courses: floor.courses.map((one) => (one.course.id === read.course.id ? read : one)),
  };
}
