import { type Ref, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { tokens } from '../theme/tokens.ts';
import { CONTROL_TEXT_SIZE } from './Field.tsx';
import { Text } from './Text.tsx';

const PressFade = Animated.createAnimatedComponent(Pressable);

/** A pressed button drops to `opacityPressed` and comes back, in `motionFast`, on the native driver. */
function usePressFade() {
  const [opacity] = useState(() => new Animated.Value(1));
  const to = (value: number) => () =>
    Animated.timing(opacity, {
      toValue: value,
      duration: tokens.motionFast,
      useNativeDriver: true,
    }).start();

  return { opacity, onPressIn: to(tokens.opacityPressed), onPressOut: to(1) };
}

/** Loading changes the words, never a bare spinner; `off` is for a lock the person is told about. */
export function PrimaryButton({
  label,
  onPress,
  busy = false,
  off = false,
  accessibilityLabel,
  ref,
  testID,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  off?: boolean;
  accessibilityLabel?: string;
  ref?: Ref<ViewInstance> | undefined;
  testID: string;
}) {
  const inactive = busy || off;
  const fade = usePressFade();

  return (
    <PressFade
      ref={ref}
      style={[styles.primary, off && styles.primaryOff, { opacity: fade.opacity }]}
      onPressIn={inactive ? undefined : fade.onPressIn}
      onPressOut={fade.onPressOut}
      onPress={busy ? undefined : onPress}
      // A disabled button lets a tap through to the scroll view under it, which drops the keys mid-request.
      // Pressable lets any non-null disabled overwrite accessibilityState.disabled, so busy leaves it unset.
      disabled={off || undefined}
      // Android names an unlabelled busy view "busy" alone, and keeps that name once it is idle.
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      testID={testID}
    >
      <Text
        size={CONTROL_TEXT_SIZE}
        weight="semibold"
        style={[styles.label, off ? styles.secondaryInk : styles.onAccent]}
      >
        {label}
      </Text>
    </PressFade>
  );
}

export function SecondaryButton({
  label,
  onPress,
  off = false,
  stacked = false,
  accessibilityLabel,
  ref,
  testID,
}: {
  label: string;
  onPress: () => void;
  off?: boolean;
  /** Full width at the primary button's height, whether under a primary or alone. */
  stacked?: boolean;
  /** When the visible label leans on its row, as "Unlink" does beside "Google". */
  accessibilityLabel?: string;
  ref?: Ref<ViewInstance> | undefined;
  testID: string;
}) {
  const fade = usePressFade();

  return (
    <PressFade
      ref={ref}
      style={[
        styles.secondary,
        stacked && styles.secondaryStacked,
        off && styles.secondaryOff,
        { opacity: fade.opacity },
      ]}
      onPressIn={off ? undefined : fade.onPressIn}
      onPressOut={fade.onPressOut}
      onPress={onPress}
      disabled={off}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      testID={testID}
    >
      <Text
        size={tokens.typeButton.size}
        weight="semibold"
        style={[styles.label, off ? styles.secondaryInk : styles.ink]}
      >
        {label}
      </Text>
    </PressFade>
  );
}

/** Never red, and named for what it ends: "Sign out…" opens a confirm, "Sign it out" confirms. */
export function DestructiveButton({
  label,
  onPress,
  busy = false,
  off = false,
  accessibilityLabel,
  ref,
  testID,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  off?: boolean;
  accessibilityLabel?: string;
  ref?: Ref<ViewInstance> | undefined;
  testID: string;
}) {
  const inactive = busy || off;
  const fade = usePressFade();

  return (
    <PressFade
      ref={ref}
      style={[
        styles.secondary,
        styles.secondaryStacked,
        off && styles.secondaryOff,
        { opacity: fade.opacity },
      ]}
      onPressIn={inactive ? undefined : fade.onPressIn}
      onPressOut={fade.onPressOut}
      onPress={busy ? undefined : onPress}
      disabled={off || undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      testID={testID}
    >
      <Text
        size={CONTROL_TEXT_SIZE}
        weight="semibold"
        style={[styles.label, off ? styles.secondaryInk : styles.ink]}
      >
        {label}
      </Text>
    </PressFade>
  );
}

/** A link-weight action with a 44px hit area, for "Keep my current number" and the like. */
export function QuietButton({
  label,
  onPress,
  off = false,
  ref,
  testID,
}: {
  label: string;
  onPress: () => void;
  off?: boolean;
  ref?: Ref<ViewInstance> | undefined;
  testID: string;
}) {
  return (
    <Pressable
      ref={ref}
      style={styles.quiet}
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      testID={testID}
    >
      <Text
        size={tokens.typeButton.size}
        weight="semibold"
        style={off ? styles.secondaryInk : styles.accent}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Another way through a step, such as Use a recovery code: a bordered row with a chevron. */
export function RowButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
    >
      <Text size={tokens.typeRowTitle.size} weight="semibold" style={styles.rowLabel}>
        {label}
      </Text>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="m9 18 6-6-6-6"
          stroke={tokens.colorInkSecondary}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}

/** "New here? Create an account": the question, the action, and anything said after it. */
export function Footnote({
  question,
  action,
  onPress,
  role = 'button',
  testID,
  after,
  centred = false,
}: {
  question?: string;
  action: string;
  onPress: () => void;
  role?: 'button' | 'link';
  testID: string;
  after?: string;
  /** The card's last line, centred with no rule above it, as getting back in draws it. */
  centred?: boolean;
}) {
  return (
    <View style={[styles.footnote, centred && styles.footnoteCentred]}>
      {question != null && (
        <Text size={tokens.typeBodyPhone.size} style={styles.secondaryInk}>
          {question}
        </Text>
      )}
      <Pressable
        style={styles.footnoteAction}
        onPress={onPress}
        accessibilityRole={role}
        testID={testID}
      >
        <Text size={tokens.typeBodyPhone.size} weight="semibold" style={styles.accent}>
          {action}
        </Text>
      </Pressable>
      {after != null && (
        <Text size={tokens.typeBodyPhone.size} style={styles.secondaryInk}>
          {after}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  primary: {
    minHeight: tokens.sizeHitPhonePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXxl,
    paddingVertical: tokens.spaceXs,
    borderRadius: tokens.sizeHitPhonePrimary / 2,
    backgroundColor: tokens.colorAccentHover,
  },
  primaryOff: { backgroundColor: tokens.colorBorder },
  secondary: {
    alignSelf: 'flex-start',
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXl,
    paddingVertical: tokens.spaceXs,
    borderRadius: tokens.sizeHit / 2,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  secondaryStacked: {
    alignSelf: 'stretch',
    alignItems: 'center',
    minHeight: tokens.sizeHitPhonePrimary,
    borderRadius: tokens.sizeHitPhonePrimary / 2,
  },
  secondaryOff: { backgroundColor: tokens.colorInset, borderColor: tokens.colorBorder },
  quiet: { minHeight: tokens.sizeHit, alignItems: 'center', justifyContent: 'center' },
  footnote: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceXs,
    paddingTop: tokens.spaceLg,
    borderTopWidth: 1,
    borderTopColor: tokens.colorInsetBorder,
  },
  footnoteCentred: { justifyContent: 'center', paddingTop: 0, borderTopWidth: 0 },
  footnoteAction: { minHeight: tokens.sizeHit, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    minHeight: tokens.sizeHitPhoneHero,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorCard,
  },
  rowPressed: { backgroundColor: tokens.colorInset },
  rowLabel: { flex: 1, color: tokens.colorInk },
  label: { textAlign: 'center' },
  onAccent: { color: tokens.colorInkOnDark },
  ink: { color: tokens.colorInk },
  secondaryInk: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
});
