import { say } from '../seating/SeatingWords.ts';

/** sc-60684: the door names each person's own seat, in sc-4022's words, from the plan as it is now. */
export type Seat =
  | { kind: 'table'; table: string; section: string | null }
  | { kind: 'row'; row: string; n: number; section: string | null }
  | { kind: 'single'; seat: string; section: string | null };

/** Whether anyone on the event has a taken seat: until then the door shows no seat line at all. */
export type Seating = 'seated' | 'none';

export const NO_SEAT = 'No seat yet';

export const seatingOf = (value: string | undefined): Seating =>
  value === 'none' ? 'none' : 'seated';

/** The host's own names, never translated; a seat in no section drops " · {section}". */
export function seatWords(seat: Seat): string {
  if (seat.kind === 'row') {
    return seat.section == null
      ? `Row ${seat.row}, seat ${seat.n}`
      : say.rowSeat(seat.row, seat.n, seat.section);
  }
  const place = seat.kind === 'table' ? seat.table : seat.seat;
  return seat.section == null ? place : `${place} · ${seat.section}`;
}

const table = (name: string, section: string | null = null): Seat => ({
  kind: 'table',
  table: name,
  section,
});

/** Taken seats on the wedding's plan, by door key. Anyone absent reads No seat yet: a walk-in, a held
 * companion (Adanna, Folasade's guest), a seat freed by Not coming (Camille), an Auto-seat proposal
 * not accepted (Lucía), and the not yet invited. */
const SEATS: Readonly<Record<string, Seat>> = {
  musa: table('Table 2', 'Garden side'),
  'musa.0': table('Table 2', 'Garden side'),
  amaka: table('Table 5', 'Stage side'),
  emeka: { kind: 'single', seat: 'Seat 12', section: 'By the bar' },
  folasade: { kind: 'row', row: 'C', n: 14, section: 'Upper balcony east' },
  ines: table('Table 4', 'Garden side'),
  'ines.0': table('Table 4', 'Garden side'),
  joaquin: table('Table 8', 'By the bar'),
  kwame: table('Table 7'),
  marta: table('Table 6', 'Garden side'),
  ngozi: table('Table 5', 'Stage side'),
  sophie: table('Table 3', 'Stage side'),
  'sophie.0': table('Table 3', 'Stage side'),
};

/** The line under a person's name at the door, or null when the event has nobody seated yet. */
export function seatLineOf(key: string, seating: Seating): string | null {
  if (seating === 'none') return null;
  const seat = SEATS[key];
  return seat == null ? NO_SEAT : seatWords(seat);
}
