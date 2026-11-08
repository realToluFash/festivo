import { useSyncExternalStore } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { boldTextModule } from '../../modules/bold-text/index.ts';

let phone = false;
let held: boolean | null = null;
let listening = false;
const listeners = new Set<() => void>();

function changed(): void {
  for (const listener of listeners) listener();
}

function phoneSays(on: boolean): void {
  if (on === phone) return;
  phone = on;
  changed();
}

function listen(): void {
  if (listening) return;
  listening = true;
  if (Platform.OS === 'ios') AccessibilityInfo.addEventListener('boldTextChanged', phoneSays);
  else boldTextModule?.addListener('onChange', ({ on }) => phoneSays(on));
}

/** Read once behind the splash, so the first screen is drawn in the faces the phone asks for. */
export async function loadBoldText(): Promise<void> {
  listen();
  if (Platform.OS === 'ios') phoneSays(await AccessibilityInfo.isBoldTextEnabled());
  else phoneSays(boldTextModule?.isOn() ?? false);
}

/** The design demo's switch stands in for the phone's setting while it is shown; null gives the phone's back. */
export function holdBoldText(on: boolean | null): void {
  held = on;
  changed();
}

export function boldTextOn(): boolean {
  return held ?? phone;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

/** The phone's Bold text, followed as it changes while the app is open. */
export function useBoldText(): boolean {
  return useSyncExternalStore(subscribe, boldTextOn);
}
