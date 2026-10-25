import { type ReactNode, type RefObject, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sheetPadding } from '../kit/sheet.ts';
import { useLayout } from '../layout/useLayout.ts';
import { tokens } from '../theme/tokens.ts';
import { keyboardTopNow, watchKeyboardTop } from './keyboardWatch.ts';
import { SETTLED_MS } from './Screen.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';

/** The app's one dialog frame (sc-8606): a bottom sheet on a phone, a centred card on a tablet. */
export function Sheet({
  open,
  onClose,
  scrimLabel,
  opener,
  testID,
  children,
}: {
  open: boolean;
  /** System back; the sheet's own buttons close it themselves. */
  onClose: () => void;
  /** Given, a tap on the scrim closes the sheet, and a screen reader names it so. */
  scrimLabel?: string;
  /** Where screen reader focus goes back to once the sheet has gone. */
  opener?: RefObject<View | null>;
  testID?: string;
  children: ReactNode;
}) {
  const { kind } = useLayout();
  const insets = useSafeAreaInsets();
  const phone = kind === 'phone';
  // On an Android phone the card itself runs under the keys; everywhere else the avoiding view lifts it.
  const underKeys = phone && Platform.OS === 'android';
  const keysUp = useKeysUp();
  const [windowHeight, setWindowHeight] = useState<number | null>(null);
  const keysTop = useKeyboardTop();
  const measured = underKeys && windowHeight != null && keysTop != null;
  const keysCover = !keysUp ? null : measured ? windowHeight - keysTop : 0;
  const padding = sheetPadding({ phone, keysCover, insets });
  useFocusBack(open, opener);

  return (
    <Modal
      visible={open}
      transparent
      animationType={phone ? 'slide' : 'fade'}
      // An iOS modal is portrait-only by default, and a rotation under it measures the keys sideways.
      supportedOrientations={['portrait', 'landscape']}
      // Android's modal window stops at the system bars unless told otherwise, leaving them undimmed.
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {/* A modal is its own window, so neither platform resizes it for the keyboard. */}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior="padding"
        enabled={!underKeys}
        onLayout={(event) => setWindowHeight(event.nativeEvent.layout.height)}
      >
        <View
          style={[
            styles.scrim,
            phone ? styles.scrimPhone : styles.scrimTablet,
            {
              paddingTop: padding.scrimTop,
              paddingLeft: padding.scrimLeft,
              paddingRight: padding.scrimRight,
            },
          ]}
        >
          {scrimLabel != null && (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={scrimLabel}
            />
          )}
          <View
            style={[
              styles.frame,
              phone ? styles.framePhone : styles.frameTablet,
              { paddingBottom: padding.frameBottom },
            ]}
            accessibilityViewIsModal
            testID={testID}
          >
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** The keyboard's top edge in the sheet's window, or null while the keys are down. */
function useKeyboardTop(): number | null {
  const [top, setTop] = useState(() => keyboardTopNow(0));

  useEffect(() => watchKeyboardTop(() => 0, setTop), []);

  return top;
}

/** Hands screen reader focus back to `opener` once a sheet that was open has slid away (WCAG 2.4.3). */
function useFocusBack(open: boolean, opener: RefObject<View | null> | undefined): void {
  const wasOpen = useRef(open);

  useEffect(() => {
    const closed = wasOpen.current && !open;
    wasOpen.current = open;
    if (!closed || opener == null) return;

    const focus = setTimeout(() => moveScreenReaderFocus(opener.current), SETTLED_MS);

    return () => clearTimeout(focus);
  }, [open, opener]);
}

/** Whether the keyboard is up, changing when the avoiding view starts to move. */
export function useKeysUp(): boolean {
  const [up, setUp] = useState(() => keyboardTopNow(0) != null);

  useEffect(() => {
    // iOS's avoiding view pads on the Will events and Android's on the Did ones.
    const ios = Platform.OS === 'ios';
    const shown = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () =>
      setUp(true),
    );
    const hidden = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setUp(false),
    );

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return up;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { flex: 1 },
  scrimPhone: { justifyContent: 'flex-end', backgroundColor: tokens.scrimSheet },
  scrimTablet: {
    justifyContent: 'center',
    padding: tokens.spaceXxl,
    backgroundColor: tokens.scrimDialog,
  },
  frame: {
    flexShrink: 1,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  framePhone: {
    borderBottomWidth: 0,
    borderTopLeftRadius: tokens.radiusSheet,
    borderTopRightRadius: tokens.radiusSheet,
  },
  frameTablet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 480,
    borderRadius: tokens.radiusCardPhone,
  },
});
