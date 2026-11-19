import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

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
