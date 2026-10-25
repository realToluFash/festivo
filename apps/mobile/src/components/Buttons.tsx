import type { Ref } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { tokens } from '../theme/tokens.ts';
import { CONTROL_TEXT_SIZE } from './Field.tsx';
import { Text } from './Text.tsx';

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
  ref?: Ref<View>;
  testID: string;
}) {
  const inactive = busy || off;

  return (
    <Pressable
      ref={ref}
      style={[styles.primary, busy && styles.primaryBusy, off && styles.primaryOff]}
      onPress={onPress}
      disabled={inactive}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      testID={testID}
    >
      <Text
        size={CONTROL_TEXT_SIZE}
        weight="semibold"
        style={off ? styles.secondaryInk : styles.onAccent}
      >
        {label}
      </Text>
    </Pressable>
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
  /** Under a primary button, as wide and as tall as it. */
  stacked?: boolean;
  /** When the visible label leans on its row, as "Unlink" does beside "Google". */
  accessibilityLabel?: string;
  ref?: Ref<View>;
  testID: string;
}) {
  return (
    <Pressable
      ref={ref}
      style={[styles.secondary, stacked && styles.secondaryStacked, off && styles.secondaryOff]}
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
        style={off ? styles.secondaryInk : styles.ink}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A link-weight action with a 44px hit area, for "Keep my current number" and the like. */
export function QuietButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable style={styles.quiet} onPress={onPress} accessibilityRole="button" testID={testID}>
      <Text size={tokens.typeButton.size} weight="semibold" style={styles.accent}>
        {label}
      </Text>
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
}: {
  question?: string;
  action: string;
  onPress: () => void;
  role?: 'button' | 'link';
  testID: string;
  after?: string;
}) {
  return (
    <View style={styles.footnote}>
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
    height: tokens.sizeHitPhonePrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXxl,
    borderRadius: tokens.sizeHitPhonePrimary / 2,
    backgroundColor: tokens.colorAccent,
  },
  primaryBusy: { backgroundColor: tokens.colorAccentHover },
  primaryOff: { backgroundColor: tokens.colorBorder },
  secondary: {
    alignSelf: 'flex-start',
    height: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceXl,
    borderRadius: tokens.sizeHit / 2,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  secondaryStacked: {
    alignSelf: 'stretch',
    alignItems: 'center',
    height: tokens.sizeHitPhonePrimary,
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
  footnoteAction: { minHeight: tokens.sizeHit, justifyContent: 'center' },
  onAccent: { color: tokens.colorInkOnDark },
  ink: { color: tokens.colorInk },
  secondaryInk: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
});
