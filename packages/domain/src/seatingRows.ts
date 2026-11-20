import { CHAIR_RADIUS_CM } from './seatingTables.ts';

/** Where a row's seats sit (sc-4003); the API's FloorGeometry holds the same tab for the floor a row takes. */

export interface RowLayout {
  seats: number;
  spacingCm: number;
}

export interface PlacedSeat {
  seat: number;
  x: number;
  y: number;
}

export const ROW_TAB_CM = 52;

/** Before the row turns, facing the top of the room: seat 1 on the left of a guest sitting in it, so its number stays with it as the row turns. */
export function rowSeatsOf(row: RowLayout): PlacedSeat[] {
  return Array.from({ length: row.seats }, (_, index) => ({
    seat: index + 1,
    x: (-(row.seats - 1) / 2 + index) * row.spacingCm,
    y: 0,
  }));
}

export function rowExtent(row: RowLayout): [number, number] {
  return [((row.seats - 1) / 2) * row.spacingCm + CHAIR_RADIUS_CM + ROW_TAB_CM, CHAIR_RADIUS_CM];
}

/** Where the label's tab sits, before turning: just past seat 1. */
export function rowTabAt(row: RowLayout): [number, number] {
  return [(-(row.seats - 1) / 2) * row.spacingCm - ROW_TAB_CM, 0];
}
