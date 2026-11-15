import { SEATING_LIMITS, type SeatingPlan } from '@soirely/api-client';

/** From 25% a table shows its chairs, and from 75% each chair is a 44 target for a pointer (the demo's zoom levels). */
export const CHAIRS_FROM_SCALE = 0.25;
export const POINTER_CHAIRS_FROM_SCALE = 0.75;

export function sectionOf(plan: SeatingPlan, item: { sectionId: string | null }) {
  return plan.sections.find((one) => one.id === item.sectionId) ?? null;
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
