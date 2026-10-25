import { type ReactNode, useEffect, useState } from 'react';
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
import { keyboardTopNow } from './keyboardWatch.ts';

/** The app's one dialog frame (sc-8606): a bottom sheet on a phone, a centred card on a tablet. */
export function Sheet({
  open,
  onClose,
  scrimLabel,
  testID,
  children,
}: {
  open: boolean;
  /** System back; the sheet's own buttons close it themselves. */
  onClose: () => void;
  /** Given, a tap on the scrim closes the sheet, and a screen reader names it so. */
  scrimLabel?: string;
  testID?: string;
  children: ReactNode;
}) {
  const { kind, height } = useLayout();
  const insets = useSafeAreaInsets();
  const phone = kind === 'phone';
  const keysUp = useKeysUp();
  const typing = phone && keysUp;
  const padding = sheetPadding({ phone, typing, insets });

  return (
    <Modal
      visible={open}
      transparent
      animationType={phone ? 'slide' : 'fade'}
      // An iOS modal is portrait-only by default, and a rotation under it measures the keys sideways.
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={onClose}
    >
      {/* Padding on both platforms: a modal is its own window, so neither resizes for the keyboard. */}
      <KeyboardAvoidingView style={styles.fill} behavior="padding">
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
            {/* The avoiding view's padding can stop a pixel or two short of where Android draws the keys (sc-9472). */}
            {phone && <View style={[styles.skirt, { height }]} pointerEvents="none" />}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
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
  skirt: {
    position: 'absolute',
    top: '100%',
    left: -1,
    right: -1,
    backgroundColor: tokens.colorCard,
  },
});
