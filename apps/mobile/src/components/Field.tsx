import {
  createContext,
  type ReactNode,
  type Ref,
  type RefObject,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputInstance,
  type TextInputProps,
  useWindowDimensions,
  View,
  type ViewInstance,
} from 'react-native';

import {
  codeProps,
  FIELD_DEFAULTS,
  fieldName,
  fieldText,
  keyTyped,
  nextGiven,
  nextPin,
  type Typing,
  valueHanded,
} from '../kit/fields.ts';
import { inputFaced } from '../theme/fonts.ts';
import { tokens } from '../theme/tokens.ts';
import { fieldChecked, fieldFocused, fieldLeft } from './focusedField.ts';
import { useReadOut } from './ReadOut.tsx';
import { useFocusOnAnswer } from './Screen.tsx';
import { moveScreenReaderFocus } from './screenReaderFocus.ts';
import { Text, type TextHandle } from './Text.tsx';
import { useMarkSide } from './markSide.ts';

/** 16 is the smallest size iOS Safari will not zoom into on focus. */
export const CONTROL_TEXT_SIZE = 16;

const FieldLabel = createContext<string | undefined>(undefined);

/** The nativeID of the label of the Field a control sits in, which names the control on Android. */
export function useFieldLabel(): string | undefined {
  return useContext(FieldLabel);
}

/** A label, the control, its error under it, then any help: the order every form uses. */
export function Field({
  label,
  pill,
  labelAction,
  error,
  errorActions,
  errorAnswer,
  help,
  helpAnswer,
  helpInHint = false,
  children,
  ref,
}: {
  label: string;
  pill?: string | undefined;
  labelAction?: FieldAction | undefined;
  error?: string | null | undefined;
  errorActions?: readonly FieldAction[] | undefined;
  /** What a tap set for the error to answer it, where the tap's button went: the error takes focus in place of being read out (sc-11173). */
  errorAnswer?: unknown;
  help?: string | readonly string[] | undefined;
  /** What a tap set for the help to answer it, where the tap's button went: its first line takes focus (sc-11173). */
  helpAnswer?: unknown;
  /** The control says the help as its hint, so the lines are not a stop of their own. */
  helpInHint?: boolean;
  children: ReactNode;
  /** The whole Field, which a client check failing on its picker brings into view. */
  ref?: RefObject<ViewInstance | null> | undefined;
}) {
  const own = useRef<ViewInstance>(null);
  const field = ref ?? own;
  const labelID = useId();
  const { read: helpRead } = useFocusOnAnswer<TextHandle>(helpAnswer);
  useEffect(() => {
    const mounted = field.current;

    return () => fieldLeft(mounted);
  }, [field]);

  // A control's focus and blur bubble up to here.
  return (
    <View
      ref={field}
      onFocus={() => fieldFocused(field.current)}
      onBlur={() => fieldLeft(field.current)}
      style={styles.field}
    >
      <View style={styles.labelRow}>
        <Text size={tokens.typeButton.size} weight="semibold" nativeID={labelID}>
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
      <FieldLabel value={labelID}>{children}</FieldLabel>
      {error != null && <FieldError message={error} actions={errorActions} answer={errorAnswer} />}
      {(typeof help === 'string' ? [help] : (help ?? [])).map((line, index) => (
        <Text
          key={line}
          ref={index === 0 ? helpRead : undefined}
          size={tokens.typeSmall.size}
          style={styles.secondary}
          accessible={helpInHint ? false : undefined}
          importantForAccessibility={helpInHint ? 'no' : undefined}
        >
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
  answer,
}: {
  message: string;
  actions?: readonly FieldAction[] | undefined;
  /** The error answers a tap whose button went, so it takes focus in place of being read out. */
  answer?: unknown;
}) {
  const markSide = useMarkSide(tokens.sizeMark);
  useReadOut(answer === undefined ? message : null);
  const { shown, read } = useFocusOnAnswer<TextHandle>(answer);

  return (
    <View ref={shown} style={styles.fieldError}>
      <View
        style={[styles.mark, markSide]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text size={tokens.typePill.size} weight="bold" style={styles.broken} accessible={false}>
          {tokens.marks.broken.glyph}
        </Text>
      </View>
      <View style={styles.grow}>
        <Text ref={read} size={tokens.typeBodyPhone.size} style={styles.broken}>
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
  submitting?: boolean;
  ref?: Ref<TextInputInstance> | undefined;
};

/** Held while a submit runs: focused and the keyboard up, which `editable={false}` would drop, but nothing typed is taken. */
export function useHeld(
  held: boolean,
  value: string | undefined,
  defaultValue: string | undefined,
  onChangeText: ((text: string) => void) | undefined,
): Pick<TextInputProps, 'value' | 'defaultValue' | 'onChangeText'> {
  const [typing, setTyping] = useState<Typing>({
    typed: value ?? defaultValue ?? '',
    pinned: Platform.OS === 'android' ? value : undefined,
    given: undefined,
  });
  const { fontScale } = useWindowDimensions();
  const [scale, setScale] = useState(fontScale);
  const handed = nextGiven(Platform.OS, value, typing);
  const { typed, pinned, given } = handed;
  const field = {
    held,
    value: valueHanded(Platform.OS, value, given),
    defaultValue,
    typed,
    pinned,
  };
  const next = nextPin(field, fontScale, scale);

  if (next.scale !== scale) setScale(next.scale);
  if (handed !== typing || next.pinned !== pinned) setTyping({ ...handed, pinned: next.pinned });

  if (held) return { ...fieldText(field), onChangeText: undefined };

  return {
    ...fieldText(field),
    onChangeText: (text) => {
      setTyping((last) => keyTyped(last, text));
      onChangeText?.(text);
    },
  };
}

/** To the field a server refusal names: the keyboard moves there if it was up, and a server refusal never raises it. */
export function focusRefused(field: RefObject<TextInputInstance | null>): void {
  if (Keyboard.isVisible()) {
    field.current?.focus();
    return;
  }

  moveScreenReaderFocus(field.current);
}

/** To the field a client check names, with the keyboard up on it and the field brought into view above it. */
export function focusChecked(field: RefObject<TextInputInstance | null>): void {
  const input = field.current;
  if (input == null) return;
  const focused = input.isFocused();
  // Android's back gesture hides the keys and leaves the field focused, and focus() skips a focused field.
  if (focused && !Keyboard.isVisible()) input.blur();
  fieldChecked(focused && Keyboard.isVisible());
  input.focus();
}

/** At a submit the client checks passed: keys hidden over a focused field stay hidden while it runs and after it. */
export function keysStayDown(): void {
  // A header tap on an iPhone hides the keys and leaves the field focused, and iOS raises them again as the held field changes.
  if (!Keyboard.isVisible()) TextInput.State.currentlyFocusedInput()?.blur();
}

export function TextField({
  wrong = false,
  submitting = false,
  style,
  ref,
  value,
  onChangeText,
  ...rest
}: TextFieldProps) {
  const holding = useHeld(submitting, value, rest.defaultValue, onChangeText);
  const labelID = useFieldLabel();

  return (
    <TextInput
      {...FIELD_DEFAULTS}
      {...rest}
      {...fieldName(Platform.OS, rest.accessibilityLabel, {
        labelID,
        placeholder: rest.placeholder,
      })}
      {...holding}
      ref={ref}
      style={inputFaced([styles.input, wrong && styles.wrong, style])}
      aria-invalid={wrong}
    />
  );
}

export type CodeFieldProps = TextFieldProps & {
  takesRecoveryCode?: boolean;
};

export function CodeField({
  wrong = false,
  submitting = false,
  takesRecoveryCode = false,
  style,
  ref,
  value,
  onChangeText,
  ...rest
}: CodeFieldProps) {
  const holding = useHeld(submitting, value, rest.defaultValue, onChangeText);
  const labelID = useFieldLabel();

  return (
    <TextInput
      {...codeProps(takesRecoveryCode)}
      autoComplete="sms-otp"
      {...rest}
      {...fieldName(Platform.OS, rest.accessibilityLabel, {
        labelID,
        placeholder: rest.placeholder,
      })}
      {...holding}
      ref={ref}
      style={inputFaced([styles.code, wrong && styles.wrong, style])}
      aria-invalid={wrong}
    />
  );
}

export const fieldStyles = StyleSheet.create({
  input: {
    minHeight: tokens.sizeHitPhonePrimary,
    paddingHorizontal: tokens.spaceLg,
    paddingVertical: tokens.spaceSm,
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
  labelRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.spaceSm },
  pill: {
    minHeight: tokens.sizePill,
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
  action: { flexShrink: 1, minHeight: tokens.sizeHit, justifyContent: 'center' },
  trailing: { marginLeft: 'auto' },
  input: fieldStyles.input,
  wrong: fieldStyles.wrong,
  code: {
    minHeight: tokens.sizeHitPhoneHero,
    paddingHorizontal: tokens.spaceLg,
    paddingVertical: tokens.spaceSm,
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
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.radiusPill,
    borderWidth: 1.5,
    borderColor: tokens.marks.broken.ring,
    backgroundColor: tokens.marks.broken.fill,
  },
  fieldError: { flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spaceSm },
});
