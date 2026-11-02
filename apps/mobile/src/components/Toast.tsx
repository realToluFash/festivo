import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet, View } from 'react-native';

import { glide } from '../motion.ts';
import { useReducedMotion } from '../reducedMotion.ts';
import { tokens } from '../theme/tokens.ts';
import { useReadOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';

/** With a screen reader on it stays until closed, and it waits while touched, so nobody loses Undo reaching for it. */
export function Toast({
  words,
  onUndo,
  onClose,
}: {
  words: string;
  onUndo?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [shown] = useState(() => new Animated.Value(0));
  const [rise] = useState(() => new Animated.Value(tokens.motionRise));
  const held = useRef(false);
  const close = useRef(onClose);

  useReadOut(words);

  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (reduced) rise.setValue(0);
    const run = Animated.parallel([
      glide(shown, 1, tokens.motionBase),
      glide(rise, 0, tokens.motionBase),
    ]);
    run.start();
    return () => run.stop();
  }, [reduced, rise, shown]);

  useEffect(() => {
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (on) held.current = true;
    });
    let left = tokens.toastLifetime;
    const tick = 250;
    const timer = setInterval(() => {
      if (held.current) return;
      left -= tick;
      if (left <= 0) close.current();
    }, tick);

    return () => clearInterval(timer);
  }, []);

  return (
    <Animated.View
      style={[styles.toast, { opacity: shown, transform: [{ translateY: rise }] }]}
      onTouchStart={() => {
        held.current = true;
      }}
      onTouchEnd={() => {
        held.current = false;
      }}
    >
      <View style={styles.words}>
        <Text size={tokens.typeBodyPhone.size} style={styles.onDark}>
          {words}
        </Text>
      </View>
      {onUndo != null && (
        <Pressable
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          accessibilityRole="button"
          onPress={() => {
            onUndo();
            onClose();
          }}
        >
          <Text
            size={tokens.typeButton.size}
            weight="semibold"
            style={[styles.onDark, styles.undo]}
          >
            {t('toast.undo')}
          </Text>
        </Pressable>
      )}
      <Pressable
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t('toast.close')}
        onPress={onClose}
      >
        <Text size={tokens.typeButton.size} style={styles.onDark} accessible={false}>
          ×
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    paddingVertical: tokens.spaceXs,
    paddingLeft: tokens.spaceXl,
    paddingRight: tokens.spaceXs,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInk,
    ...(Platform.OS === 'ios'
      ? tokens.elevationNative.toast.ios
      : tokens.elevationNative.toast.android),
  },
  words: { flex: 1, minWidth: 0 },
  onDark: { color: tokens.colorInkOnDark },
  undo: { textDecorationLine: 'underline' },
  action: {
    minWidth: tokens.sizeHit,
    minHeight: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusPill,
  },
  pressed: { opacity: tokens.opacityPressed },
});
