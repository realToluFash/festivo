import { useSyncExternalStore } from 'react';

import { holdBoldText } from '../../theme/boldText.ts';

let on = false;
let open = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function changed(): void {
  for (const listener of listeners) listener();
}

export function setBoldText(next: boolean): void {
  on = next;
  holdBoldText(open ? on : null);
  changed();
}

export function openBoldTextBoard(startOn: boolean): void {
  open = true;
  setBoldText(startOn);
}

/** Back to the app's own faces for the rest of the demo. */
export function closeBoldTextBoard(): void {
  open = false;
  setBoldText(false);
}

export function useBoldTextSwitch(): boolean {
  return useSyncExternalStore(subscribe, () => on);
}

export function useBoldTextBoardOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open);
}
