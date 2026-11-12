import { useSyncExternalStore } from 'react';

/** Where a step's foot sits in the window once the step has landed: across it, which the landing toast keeps to on a tablet (sc-37519), and its top while docked, which the toast rests on, or null while it has moved into the page (sc-37983). */
export interface StepFoot {
  x: number;
  width: number;
  top: number | null;
}

/** A screen the landing toast can be said over: Home, or a step, which has landed once it has slid in, with its foot if it has one. */
export interface LandedScreen {
  id: number;
  home: boolean;
  landed: boolean;
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

function sameFoot(was: StepFoot | null, foot: StepFoot | null): boolean {
  if (was == null || foot == null) return was === foot;

  return was.x === foot.x && was.width === foot.width && was.top === foot.top;
}

function shown(home: boolean): { id: number; left(): void } {
  const id = ++ids;
  changed([...screens, { id, home, landed: home, foot: null }]);

  return { id, left: () => changed(screens.filter((screen) => screen.id !== id)) };
}

/** A step is showing; the one mounted last is the one in front. Returns how it says it has landed and where its foot sits, null with no foot, and how it leaves. */
export function stepShown(): { placed(foot: StepFoot | null): void; left(): void } {
  const { id, left } = shown(false);

  return {
    placed: (foot) => {
      const was = screens.find((screen) => screen.id === id);
      if (was == null || (was.landed && sameFoot(was.foot, foot))) return;
      changed(
        screens.map((screen) => (screen.id === id ? { ...screen, landed: true, foot } : screen)),
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
