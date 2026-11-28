import { useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

let shutPicker: (() => void) | null = null;

/** For a window under a picker: true when an open picker took this Back as its own. */
export function pickerTookBack(): boolean {
  if (shutPicker == null) return false;
  shutPicker();
  return true;
}

// Android can deliver one early Back twice, the second copy to the window beneath, seen 0.3 s after the first had shut the picker (sc-44486).
export const SECOND_DELIVERY_MS = 600;

/** `close` answers Back, on the screen beneath and in a window under it. Once released, a Back is still taken, and dropped, for `SECOND_DELIVERY_MS`. */
export function holdBack(close: () => void): () => void {
  let released = false;
  const shut = () => {
    if (!released) close();
  };
  shutPicker = shut;
  const listener = BackHandler.addEventListener('hardwareBackPress', () => {
    shut();
    return true;
  });

  return () => {
    if (released) return;
    released = true;
    setTimeout(() => {
      listener.remove();
      if (shutPicker === shut) shutPicker = null;
    }, SECOND_DELIVERY_MS);
  };
}

/**
 * Call what this returns in the tap that opens a picker. Until the picker's window or sheet is drawn, Android gives Back to what is beneath, which asked to leave (sc-44486), so the hold starts at the tap, not at a render or an effect.
 */
export function useEarlyBack(open: boolean, close: () => void): () => void {
  const latest = useRef(close);
  const release = useRef<(() => void) | null>(null);
  // A Back can shut the picker before its opening renders, leaving `open` unchanged, so each tap is counted too.
  const [taps, setTaps] = useState(0);

  useEffect(() => {
    latest.current = close;
  });

  useEffect(() => {
    if (open) return;
    release.current?.();
    release.current = null;
  }, [open, taps]);

  useEffect(() => () => release.current?.(), []);

  return () => {
    release.current?.();
    release.current = holdBack(() => latest.current());
    setTaps((was) => was + 1);
  };
}
