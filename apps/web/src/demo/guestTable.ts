import type { Visit } from './guest.ts';
import type { DemoLink } from './settings.ts';

export type Seat =
  | { kind: 'table'; table: string; section: string | null }
  | { kind: 'row'; row: string; seat: number; section: string | null };

/** The guest page's seating field, which the API sends only while the tables are shared. */
export interface GuestSeating {
  /** A taken seat; a proposed one (sc-4019) is not sent. */
  seat: Seat | null;
  elsewhere: readonly { name: string | null; seat: Seat }[];
}

export const TABLE_WORDS = {
  yourTable: 'Your table',
  yourSeat: 'Your seat',
  yourGuest: 'Your guest',
  demoMove:
    'Demo only: the host moves this guest to another table while the page is open. The page shows it within 2 seconds.',
  move: 'Move to Table 6',
} as const;

export function placeOf(seat: Seat): string {
  const place = seat.kind === 'table' ? seat.table : `Row ${seat.row}, seat ${seat.seat}`;

  return seat.section == null ? place : `${place} · ${seat.section}`;
}

export function headingOf(seat: Seat): string {
  return seat.kind === 'table' ? TABLE_WORDS.yourTable : TABLE_WORDS.yourSeat;
}

export function companionLine(one: { name: string | null; seat: Seat }): string {
  const place =
    one.seat.kind === 'table' ? one.seat.table : placeOf({ ...one.seat, section: null });

  return `${one.name ?? TABLE_WORDS.yourGuest}: ${place}`;
}

/** Only a Coming guest with a taken seat sees the card; Not sure yet, Not coming and every guest before sharing see sc-1439's page as it is. */
export function shownSeat(visit: Pick<Visit, 'seating' | 'recorded'>): GuestSeating | null {
  const { seating, recorded } = visit;

  if (seating?.seat == null || recorded?.answer !== 'coming') return null;
  return seating;
}

export const TABLE_4: Seat = { kind: 'table', table: 'Table 4', section: 'Main hall' };
export const TABLE_6: Seat = { kind: 'table', table: 'Table 6', section: 'Main hall' };
const ROW_C: Seat = { kind: 'row', row: 'C', seat: 4, section: 'Balcony' };

const SEATED: GuestSeating = { seat: TABLE_4, elsewhere: [] };
const COMING = { recorded: { answer: 'coming', on: '2026-10-27' } } as const;
const RECORDED = { view: { kind: 'recorded', same: false } } as const;

export const GUEST_TABLE_STATES = {
  table: {
    name: 'Shared, Coming, at a table',
    starts: { ...COMING, ...RECORDED, seating: SEATED },
  },
  rowSeat: {
    name: 'Shared, Coming, a seat in a row',
    starts: { ...COMING, ...RECORDED, seating: { seat: ROW_C, elsewhere: [] } },
  },
  companionsElsewhere: {
    name: 'Shared, two companions at another table, one with no name',
    starts: {
      ...COMING,
      ...RECORDED,
      seating: {
        seat: TABLE_4,
        elsewhere: [
          { name: 'Kemi Okonkwo', seat: TABLE_6 },
          { name: null, seat: TABLE_6 },
        ],
      },
    },
  },
  moved: {
    name: 'Shared, the host moves the guest while the page is open',
    starts: { ...COMING, ...RECORDED, seating: SEATED, tableMoves: true },
  },
  notShared: {
    name: 'Not shared yet: no seating field, the page as sc-1439 draws it',
    starts: { ...COMING, ...RECORDED, seating: null },
  },
  unseated: {
    name: 'Shared, Coming, no seat: nothing about seating',
    starts: { ...COMING, ...RECORDED, seating: { seat: null, elsewhere: [] } },
  },
  proposed: {
    name: 'Shared, Coming, only a proposed seat: nothing about seating',
    starts: { ...COMING, ...RECORDED, seating: { seat: null, elsewhere: [] } },
  },
  maybe: {
    name: 'Shared, Not sure yet: nothing about seating',
    starts: { recorded: { answer: 'notSure', on: '2026-10-27' }, ...RECORDED, seating: SEATED },
  },
  notComing: {
    name: 'Shared, Not coming: nothing about seating',
    starts: { recorded: { answer: 'notComing', on: '2026-10-27' }, ...RECORDED, seating: SEATED },
  },
  onTheDay: {
    name: 'Shared, on the day: Your table between Where and The day',
    starts: {
      ...COMING,
      ...RECORDED,
      seating: SEATED,
      programme: 'days',
      day: 'onTheDay',
      now: '2026-11-05T09:00:00Z',
      replyBy: null,
    },
  },
} satisfies Record<string, { name: string; starts: Partial<Visit> }>;

export type GuestTableState = keyof typeof GUEST_TABLE_STATES;

const PREFIX = 'table';

/** The states sit under `?state=table…` so they never meet the other guest pages' names. */
export function guestTableStateOf(value: string | null): GuestTableState | null {
  if (value == null || !value.startsWith(PREFIX)) return null;
  const rest = value.slice(PREFIX.length);
  const key = rest === '' ? 'table' : `${rest.charAt(0).toLowerCase()}${rest.slice(1)}`;

  return Object.hasOwn(GUEST_TABLE_STATES, key) ? (key as GuestTableState) : null;
}

export function guestTableStarts(state: GuestTableState): Partial<Visit> {
  return GUEST_TABLE_STATES[state].starts as Partial<Visit>;
}

function param(state: GuestTableState): string {
  return state === 'table' ? PREFIX : `${PREFIX}${state.charAt(0).toUpperCase()}${state.slice(1)}`;
}

export const GUEST_TABLE_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Your table on the guest’s page (sc-4022)',
    states: (Object.keys(GUEST_TABLE_STATES) as GuestTableState[]).map((state) => ({
      to: `/demo/guest?state=${param(state)}`,
      name: GUEST_TABLE_STATES[state].name,
    })),
  },
];
