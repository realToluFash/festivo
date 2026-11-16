import { SEATING_LIMITS, type SeatingPlan } from '@soirely/api-client';

/** 100% draws 1 m of room as 50 px; from 50% a table shows its chairs, and from 150% each chair is a 44 target for a pointer. */
export const AT_100 = 0.5;
export const CHAIRS_FROM_SCALE = 0.25;
export const POINTER_CHAIRS_FROM_SCALE = 0.75;
export const ZOOMS: readonly number[] = [25, 40, 50, 75, 100, 150, 200, 300, 400];
export const SMALLEST_SCALE = 0.25 * AT_100;
export const LARGEST_SCALE = 4 * AT_100;
export const SMALL_MAP_FROM_SCALE = 2 * AT_100;

export function percentOf(s: number): number {
  return Math.round((s / AT_100) * 100);
}

export function sectionOf(plan: SeatingPlan, item: { sectionId: string | null }) {
  return plan.sections.find((one) => one.id === item.sectionId) ?? null;
}

export function usableSeats(item: { seats: number; unusableSeats: readonly number[] }): number {
  return item.seats - item.unusableSeats.length;
}

export function f(value: number): number {
  return Math.round(value * 10) / 10;
}

export function turned([x, y]: [number, number], degrees: number): [number, number] {
  const a = (degrees * Math.PI) / 180;

  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

export function rotations() {
  return Array.from({ length: 360 / SEATING_LIMITS.rotationStep }, (_, index) => ({
    value: String(index * SEATING_LIMITS.rotationStep),
    word: `${index * SEATING_LIMITS.rotationStep}°`,
  }));
}

export function readCount(text: string): number | null {
  const typed = text.trim();

  return /^\d+$/u.test(typed) ? Number(typed) : null;
}
