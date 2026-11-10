import { useSyncExternalStore } from 'react';

/** Where a step's foot sits across the window, which the landing toast keeps to on a tablet (sc-37519). */
export interface StepColumn {
  x: number;
  width: number;
}

export interface LandedStep {
  id: number;
  column: StepColumn | null;
}

let steps: readonly LandedStep[] = [];
let ids = 0;
const listeners = new Set<() => void>();

function changed(next: readonly LandedStep[]): void {
  steps = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

/** A step with a foot is showing; the one mounted last is the one in front. Returns how it says where its foot sits, and how it leaves. */
export function stepShown(): { placed(column: StepColumn): void; left(): void } {
  const id = ++ids;
  changed([...steps, { id, column: null }]);

  return {
    placed: (column) => {
      const was = steps.find((step) => step.id === id);
      if (was == null || (was.column?.x === column.x && was.column.width === column.width)) return;
      changed(steps.map((step) => (step.id === id ? { id, column } : step)));
    },
    left: () => changed(steps.filter((step) => step.id !== id)),
  };
}

/** How many steps have been shown so far, to pass as `after`. */
export function stepsSoFar(): number {
  return ids;
}

/** The step in front, or null when none with a foot is showing, or the one in front was shown no later than the `after`th. */
export function landedStep(after = 0): LandedStep | null {
  const front = steps.at(-1);

  return front != null && front.id > after ? front : null;
}

export function useLandedStep(after = 0): LandedStep | null {
  return useSyncExternalStore(subscribe, () => landedStep(after));
}
