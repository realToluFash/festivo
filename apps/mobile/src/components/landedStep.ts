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

/** The step in front, or null when none with a foot is showing. */
export function landedStep(): LandedStep | null {
  return steps.at(-1) ?? null;
}

export function useLandedStep(): LandedStep | null {
  return useSyncExternalStore(subscribe, landedStep);
}
