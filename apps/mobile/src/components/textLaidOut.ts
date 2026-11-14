import { DeviceEventEmitter, Platform } from 'react-native';

import { TEXT_SCALE_LAID_OUT } from './textScaleLaidOutEvent.ts';

let layouts = 0;
let listening = false;
const listeners = new Set<() => void>();

function laidOut(): void {
  layouts += 1;
  for (const listener of listeners) listener();
}

/** Subscribes to the root's new-scale layouts, with one native listener kept for the app's life, so a layout during a remount is not missed. */
export function subscribeTextLaidOut(listener: () => void): () => void {
  if (Platform.OS !== 'android') return () => undefined;
  listeners.add(listener);
  if (!listening) DeviceEventEmitter.addListener(TEXT_SCALE_LAID_OUT, laidOut);
  listening = true;

  return () => {
    listeners.delete(listener);
  };
}

/** How many times the root view has been laid out at a new font scale since the app started. */
export function textLayoutsAtNewScale(): number {
  return layouts;
}
