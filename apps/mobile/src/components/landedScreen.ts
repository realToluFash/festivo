import { useSyncExternalStore } from 'react';

/** Where a step's column sits across the window once the step has landed, foot or no foot, which the landing toast keeps to on a tablet (sc-37519, sc-42562). */
export interface StepColumn {
  x: number;
  width: number;
}

/** A step's foot: its top in the window while docked, which the landing toast rests on, or null while it has moved into the page (sc-37983). */
export interface StepFoot {
  top: number | null;
}

/** Where a landed step's column and foot sit, its foot null with none. */
export interface StepPlace {
  column: StepColumn;
  foot: StepFoot | null;
}

/** A screen the landing toast can be said over: Home, or a step, which has landed once it has slid in, with its column and its foot if it has one. */
export interface LandedScreen {
  id: number;
  home: boolean;
  landed: boolean;
  column: StepColumn | null;
  foot: StepFoot | null;
}

let screens: readonly LandedScreen[] = [];
let ids = 0;
const listeners = new Set<() => void>();

function changed(next: readonly LandedScreen[]): void {
  screens = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

function samePlace(was: LandedScreen, place: StepPlace): boolean {
  const column = was.column;
  if (column == null || column.x !== place.column.x || column.width !== place.column.width) {
    return false;
  }
  if (was.foot == null || place.foot == null) return was.foot === place.foot;

  return was.foot.top === place.foot.top;
}

function shown(home: boolean): { id: number; left(): void } {
  const id = ++ids;
  changed([...screens, { id, home, landed: home, column: null, foot: null }]);

  return { id, left: () => changed(screens.filter((screen) => screen.id !== id)) };
}

/** A step is showing; the one mounted last is the one in front. Returns how it says it has landed and where its column and foot sit, and how it leaves. */
export function stepShown(): { placed(place: StepPlace): void; left(): void } {
  const { id, left } = shown(false);

  return {
    placed: (place) => {
      const was = screens.find((screen) => screen.id === id);
      if (was == null || (was.landed && samePlace(was, place))) return;
      changed(
        screens.map((screen) =>
          screen.id === id ? { ...screen, landed: true, ...place } : screen,
        ),
      );
    },
    left,
  };
}

/** Home is showing, landed as it is drawn. Returns how it leaves. */
export function homeShown(): () => void {
  return shown(true).left;
}

/** How many screens have been shown so far, to pass as `after`. */
export function shownSoFar(): number {
  return ids;
}

/** The screen in front, or null when none is showing, or the one in front was shown no later than the `after`th. */
export function landedScreen(after = 0): LandedScreen | null {
  const front = screens.at(-1);

  return front != null && front.id > after ? front : null;
}

export function useLandedScreen(after = 0): LandedScreen | null {
  return useSyncExternalStore(subscribe, () => landedScreen(after));
}
