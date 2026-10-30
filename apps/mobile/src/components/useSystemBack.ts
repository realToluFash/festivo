import { useFocusEffect } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';

import { swipedBack } from '../kit/systemBack.ts';

/** While the screen is in front and `active`, Android's Back runs `onBack` instead of leaving the screen. */
export function useSystemBack(active: boolean, onBack: () => void): void {
  const latest = useRef(onBack);

  useEffect(() => {
    latest.current = onBack;
  });

  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      const listener = BackHandler.addEventListener('hardwareBackPress', () => {
        latest.current();
        return true;
      });

      return () => listener.remove();
    }, [active]),
  );
}

/** While `active`, the iOS edge swipe runs `onBack` instead of popping the screen; any other way out still leaves (sc-22871). */
export function useSwipeBack(active: boolean, onBack: () => void): void {
  usePreventRemove(Platform.OS === 'ios' && active, ({ data, repeat }) => {
    if (swipedBack(data.action)) onBack();
    else repeat();
  });
}
