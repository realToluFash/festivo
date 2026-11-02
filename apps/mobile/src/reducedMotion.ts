import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** iOS Reduce Motion or Android Remove animations, followed as the person changes it. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let live = true;
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);

    void AccessibilityInfo.isReduceMotionEnabled().then((now) => {
      if (live) setReduced(now);
    });

    return () => {
      live = false;
      listener.remove();
    };
  }, []);

  return reduced;
}
