import { type RefObject, useRef, useState } from 'react';
import { Platform, TextInput } from 'react-native';

import { blurNatively } from './keyboardWatch.ts';
import { useFocusOnAnswer } from './Screen.tsx';
import { type ScreenReaderTarget, useScreenReaderOn } from './screenReaderFocus.ts';

export interface PickerFocusBack {
  /** In the tap that opens the picker, with the picker that was tapped. */
  opening(opener: RefObject<ScreenReaderTarget | null>): void;
  /** In every close: a choice, Back, its own close, the dim, the escape. */
  closing(): void;
  /** The opener's key: a new one at each close under TalkBack on Android, where TalkBack takes a hover only once on a view that has had it, so a second close left its focus on the screen's first heading (qa4 #104048). */
  openerKey: number;
}

/** On Android, once a picker has closed and `away` says its menu or sheet is gone, TalkBack's focus goes back to the picker that opened it. Android hands it to whichever field holds input focus as a menu's window goes (sc-43908), and to the screen's first heading as a sheet over the screen goes (sc-103322). */
export function usePickerFocusBack(away: boolean): PickerFocusBack {
  const readerOn = useScreenReaderOn();
  const [closed, setClosed] = useState<object>();
  const [openerKey, setOpenerKey] = useState(0);
  const opener = useRef<RefObject<ScreenReaderTarget | null>>(null);
  const heldBehind = useRef<ReturnType<typeof TextInput.State.currentlyFocusedInput>>(null);
  const [target] = useState<RefObject<ScreenReaderTarget | null>>(() => ({
    get current() {
      return opener.current?.current ?? null;
    },
  }));
  useFocusOnAnswer(away ? closed : undefined, target);

  return {
    opening: (tapped) => {
      opener.current = tapped;
      if (Platform.OS === 'android' && readerOn)
        heldBehind.current = TextInput.State.currentlyFocusedInput();
      setClosed(undefined);
    },
    closing: () => {
      if (Platform.OS === 'android') setClosed({});
      if (Platform.OS === 'android' && readerOn) setOpenerKey(openerKey + 1);
      // A field still holding input focus is what TalkBack says first as the picker goes (sc-44356). Not at the tap, nor as the menu's window shows: its keyboard hide there had TalkBack say "keyboard hidden" as the menu opened (qa #50794, #52739). Natively, since the menu's search, once focused, is the field JS counts as focused.
      if (heldBehind.current != null) blurNatively(heldBehind.current);
      heldBehind.current = null;
    },
    openerKey,
  };
}
