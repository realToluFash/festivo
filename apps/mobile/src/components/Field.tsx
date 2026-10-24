import { type ReactNode, type Ref, type RefObject, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { codeProps, FIELD_DEFAULTS } from '../kit/fields.ts';
import { faced } from '../theme/fonts.ts';
import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

/** 16 is the smallest size iOS Safari will not zoom into on focus. */
export const CONTROL_TEXT_SIZE = 16;

/** A label, the control, its error under it, then any help: the order every form uses. */
export function Field({
  label,
  pill,
  labelAction,
  error,
  errorActions,
  help,
  children,
}: {
  label: string;
  pill?: string | undefined;
  labelAction?: FieldAction | undefined;
  error?: string | null | undefined;
  errorActions?: readonly FieldAction[] | undefined;
  help?: string | readonly string[] | undefined;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text size={tokens.typeButton.size} weight="semibold">
          {label}
        </Text>
        {pill != null && (
          <View style={styles.pill}>
            <Text size={tokens.typePill.size} weight="semibold" style={styles.secondary}>
              {pill}
            </Text>
          </View>
        )}
        {labelAction != null && (
          <Pressable
            style={[styles.action, styles.trailing]}
            onPress={labelAction.onPress}
            accessibilityRole="link"
            testID={labelAction.testID}
          >
            <Text size={tokens.typeSmall.size} weight="semibold" style={styles.accent}>
              {labelAction.label}
            </Text>
          </Pressable>
        )}
      </View>
      {children}
      {error != null && <FieldError message={error} actions={errorActions} />}
      {(typeof help === 'string' ? [help] : (help ?? [])).map((line) => (
        <Text key={line} size={tokens.typeSmall.size} style={styles.secondary}>
          {line}
        </Text>
      ))}
    </View>
  );
}

export interface FieldAction {
  label: string;
  onPress: () => void;
  testID: string;
}

/** The red mark and its sentence, and any way out of the refusal under it. */
export function FieldError({
  message,
  actions = [],
}: {
  message: string;
  actions?: readonly FieldAction[] | undefined;
}) {
  return (
    <View style={styles.fieldError} accessibilityLiveRegion="polite">
      <View style={styles.mark}>
        <Text size={tokens.typePill.size} weight="bold" style={styles.broken}>
          {tokens.marks.broken.glyph}
        </Text>
      </View>
      <View style={styles.grow}>
        <Text size={tokens.typeBodyPhone.size} style={styles.broken}>
          {message}
        </Text>
        {actions.length > 0 && (
          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable
                key={action.testID}
                style={styles.action}
                onPress={action.onPress}
                accessibilityRole="link"
                testID={action.testID}
              >
                <Text size={tokens.typeBodyPhone.size} weight="semibold" style={styles.accent}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export type TextFieldProps = TextInputProps & {
  wrong?: boolean;
  held?: boolean;
  ref?: Ref<TextInput> | undefined;
};

/** Held while a submit runs: focused and the keyboard up, which `editable={false}` would drop, but nothing typed is taken. */
export function useHeld(
  held: boolean,
  value: string | undefined,
  onChangeText: ((text: string) => void) | undefined,
): Pick<TextInputProps, 'value' | 'onChangeText'> {
  const [typed, setTyped] = useState(value ?? '');

  if (held) return { value: value ?? typed, onChangeText: undefined };

  return {
    onChangeText: (text) => {
      if (value === undefined) setTyped(text);
      onChangeText?.(text);
    },
  };
}

/** To the field a refusal names: the keyboard moves there if it was up, and a refusal never raises it. */
export function focusRefused(field: RefObject<TextInput | null>): void {
  if (TextInput.State.currentlyFocusedInput() != null) {
    field.current?.focus();
    return;
  }

  const node = findNodeHandle(field.current);
  if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
}

export function TextField({
  wrong = false,
  held = false,
  style,
  ref,
  value,
  onChangeText,
  ...rest
}: TextFieldProps) {
  const holding = useHeld(held, value, onChangeText);

  return (
    <TextInput
      {...FIELD_DEFAULTS}
      {...rest}
      value={value}
      {...holding}
      ref={ref}
      style={faced([styles.input, wrong && styles.wrong, style])}
      aria-invalid={wrong}
    />
  );
}

export type CodeFieldProps = TextFieldProps & {
  takesRecoveryCode?: boolean;
};

export function CodeField({
  wrong = false,
  held = false,
  takesRecoveryCode = false,
  style,
  ref,
  value,
  onChangeText,
  ...rest
}: CodeFieldProps) {
  const holding = useHeld(held, value, onChangeText);

  return (
    <TextInput
      {...codeProps(takesRecoveryCode)}
      autoComplete="sms-otp"
      {...rest}
      value={value}
      {...holding}
      ref={ref}
      style={faced([styles.code, wrong && styles.wrong, style])}
      aria-invalid={wrong}
    />
  );
}

export const fieldStyles = StyleSheet.create({
  input: {
    height: tokens.sizeHitPhonePrimary,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    borderRadius: tokens.radiusField,
    backgroundColor: tokens.colorCard,
    color: tokens.colorInk,
    fontSize: CONTROL_TEXT_SIZE,
  },
  wrong: { borderColor: tokens.colorBroken },
});

const styles = StyleSheet.create({
  field: { gap: tokens.spaceXs },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  pill: {
    height: tokens.sizePill,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceMd,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorInset,
  },
  secondary: { color: tokens.colorInkSecondary },
  broken: { color: tokens.colorBrokenText },
  grow: { flex: 1, gap: tokens.spaceHair },
  accent: { color: tokens.colorAccentText },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: tokens.spaceXl },
  action: { minHeight: tokens.sizeHit, justifyContent: 'center' },
  trailing: { marginLeft: 'auto' },
  input: fieldStyles.input,
  wrong: fieldStyles.wrong,
  code: {
    height: tokens.sizeHitPhoneHero,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorCard,
    color: tokens.colorInk,
    fontSize: tokens.typeTitleDialog.size,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
  },
  mark: {
    width: tokens.sizeMark,
    height: tokens.sizeMark,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.sizeMark / 2,
    borderWidth: 1.5,
    borderColor: tokens.marks.broken.ring,
    backgroundColor: tokens.marks.broken.fill,
  },
  fieldError: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
});
