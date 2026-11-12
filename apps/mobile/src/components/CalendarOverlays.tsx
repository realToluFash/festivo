import { type ReactNode, type RefObject, useEffect, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewInstance,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { TURNS_WITH_THE_APP } from '../layout/orientations.ts';
import { glide } from '../motion.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { tokens } from '../theme/tokens.ts';
import { useModalOpen } from '../updateRequired.ts';
import { SilentWindowName, useFocusBack, useWindowTurn } from './Sheet.tsx';

/** An iPad's dialog as the boards draw it: centred, 560 or 600 wide, radius 28, over the dialog scrim; it fades in and out. */
export function CentredDialog({
  open,
  onClose,
  opener,
  width,
  margin = tokens.space6xl,
  testID,
  children,
}: {
  open: boolean;
  onClose: () => void;
  opener: RefObject<ViewInstance | null>;
  width: number;
  /** How far it is held from the window's top and bottom. */
  margin?: number;
  testID?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const window = useWindowDimensions();
  const [present, setPresent] = useState(open);
  const [fade] = useState(() => new Animated.Value(0));
  const { shown, gone } = useWindowTurn(useModalOpen(present));

  useFocusBack(open, opener);
  if (open && !present) setPresent(true);

  useEffect(() => {
    if (!present) return;
    const run = glide(fade, open ? 1 : 0, open ? tokens.motionBase : tokens.motionFast);
    run.start(({ finished }) => finished && !open && setPresent(false));

    return () => run.stop();
  }, [open, present, fade]);

  return (
    <Modal
      visible={shown}
      transparent
      animationType="none"
      supportedOrientations={TURNS_WITH_THE_APP}
      statusBarTranslucent
      onRequestClose={onClose}
      onDismiss={gone}
    >
      {Platform.OS === 'android' && <SilentWindowName />}
      <View style={[styles.scrim, { paddingVertical: margin }]}>
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.dim, { opacity: fade }]}
          pointerEvents="none"
        />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('calendar.close')}
        />
        <Animated.View
          style={[
            styles.card,
            { width: Math.min(width, window.width - 2 * tokens.spaceXxl), opacity: fade },
          ]}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          testID={testID}
        >
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Main's panel beside the weeks on its side: 340 wide, radius 24, a Line ring; it fades in over motionBase. */
export function SidePanel({
  open,
  opener,
  testID,
  children,
}: {
  open: boolean;
  opener: RefObject<ViewInstance | null>;
  testID?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [fade] = useState(() => new Animated.Value(reduced ? 1 : 0));

  useFocusBack(open, opener);

  useEffect(() => {
    if (!open) return;
    if (reduced) {
      fade.setValue(1);
      return;
    }
    fade.setValue(0);
    const run = glide(fade, 1, tokens.motionBase);
    run.start();

    return () => run.stop();
  }, [open, reduced, fade]);

  if (!open) return null;

  return (
    <Animated.View style={[styles.panel, { opacity: fade }]} testID={testID}>
      <ScrollView
        style={styles.hug}
        contentContainerStyle={styles.panelBody}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}

export const SIDE_PANEL = 340;
export const SIDE_GAP = tokens.space3xl;

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { backgroundColor: tokens.scrimDialog },
  card: {
    flexShrink: 1,
    maxHeight: '100%',
    borderRadius: tokens.radiusSheet,
    backgroundColor: tokens.colorCard,
    overflow: 'hidden',
    ...tokens.elevationNative.popover.ios,
    elevation: tokens.elevationNative.popover.android.elevation,
  },
  body: { padding: tokens.space4xl },
  panel: {
    width: SIDE_PANEL,
    flexShrink: 1,
    alignSelf: 'flex-start',
    maxHeight: '100%',
    borderRadius: tokens.space3xl,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
    overflow: 'hidden',
  },
  hug: { flexGrow: 0 },
  panelBody: { padding: tokens.spaceXl },
});
