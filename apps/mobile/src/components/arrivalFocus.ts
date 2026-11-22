import { useNavigation } from 'expo-router';
import type { NativeStackNavigationProp } from 'expo-router/native-stack';
import { type RefObject, useEffect, useState } from 'react';
import { Platform, type TextInputInstance } from 'react-native';

import { focusWaitsForArrival } from '../kit/keyboard.ts';

export const FOCUS_WAITS = focusWaitsForArrival(Platform.OS);

// A screen that opens with no slide never ends a transition.
const ARRIVAL_FALLBACK_MS = 1000;

type Navigation = NativeStackNavigationProp<Record<string, object | undefined>>;

/** Runs `run` once this screen has slid in, unless it is left first; returns what stops the wait. */
export function onArrival(navigation: Navigation, run: () => void): () => void {
  const fallback = setTimeout(arrive, ARRIVAL_FALLBACK_MS);
  const listeners = [
    navigation.addListener('transitionEnd', (event) => {
      if (!event.data.closing) arrive();
    }),
    navigation.addListener('blur', () => unlisten()),
  ];

  function arrive(): void {
    unlisten();
    run();
  }

  function unlisten(): void {
    clearTimeout(fallback);
    listeners.forEach((remove) => remove());
  }

  return unlisten;
}

/** Focuses `field` once its screen has slid in, where the field opening the screen waits; `on` is read at mount, as autoFocus is. */
export function useFocusOnArrival(field: RefObject<TextInputInstance | null>, on: boolean): void {
  const navigation = useNavigation<Navigation>();
  const [atMount] = useState(on);

  useEffect(() => {
    if (!atMount || !FOCUS_WAITS) return undefined;

    return onArrival(navigation, () => field.current?.focus());
  }, [atMount, field, navigation]);
}
