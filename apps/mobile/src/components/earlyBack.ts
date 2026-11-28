import { useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

let shutPicker: (() => boolean) | null = null;

/** For a window under a picker: true when an open picker took this Back as its own. */
export function pickerTookBack(): boolean {
  return shutPicker?.() ?? false;
}

// Android can deliver one early Back twice, the second copy to the window beneath, seen 0.3 s after the first had shut the picker (sc-44486).
export const SECOND_DELIVERY_MS = 600;

/** `close` answers Back, on the screen beneath and in a window under it. If a Back came before `opened`, the hold, once released, still takes and drops Back until `SECOND_DELIVERY_MS` after the first such Back; any other release ends the hold at once. */
export function holdBack(close: () => void): { opened: () => void; release: () => void } {
  let released = false;
  let open = false;
  let earlyAt: number | null = null;
  const dropLeft = () => (earlyAt == null ? 0 : earlyAt + SECOND_DELIVERY_MS - Date.now());
  // The clock is read too: a busy JS thread can hand over a Back before the timer that was due.
  const take = () => {
    if (released && dropLeft() <= 0) {
      end();
      return false;
    }
    if (!released) {
      if (!open) earlyAt ??= Date.now();
      close();
    }
    return true;
  };
  shutPicker = take;
  const listener = BackHandler.addEventListener('hardwareBackPress', take);

  const end = () => {
    listener.remove();
    if (shutPicker === take) shutPicker = null;
  };

  return {
    opened: () => {
      open = true;
    },
    release: () => {
      if (released) return;
      released = true;
      if (dropLeft() > 0) setTimeout(end, dropLeft());
      else end();
    },
  };
}

/**
 * `opened` turns true once the picker has finished opening. Call what this returns in the tap that opens a picker. Until the picker's window or sheet is drawn, Android gives Back to what is beneath, which asked to leave (sc-44486), so the hold starts at the tap, not at a render or an effect.
 */
export function useEarlyBack(open: boolean, opened: boolean, close: () => void): () => void {
  const latest = useRef(close);
  const hold = useRef<ReturnType<typeof holdBack> | null>(null);
  // A Back can shut the picker before its opening renders, leaving `open` unchanged, so each tap is counted too.
  const [taps, setTaps] = useState(0);

  useEffect(() => {
    latest.current = close;
  });

  useEffect(() => {
    if (opened) hold.current?.opened();
  }, [opened]);

  useEffect(() => {
    if (open) return;
    hold.current?.release();
    hold.current = null;
  }, [open, taps]);

  useEffect(() => () => hold.current?.release(), []);

  return () => {
    hold.current?.release();
    hold.current = holdBack(() => latest.current());
    setTaps((was) => was + 1);
  };
}
