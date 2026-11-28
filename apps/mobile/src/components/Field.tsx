import { useFocusEffect } from 'expo-router';
import {
  createContext,
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  AppState,
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
import { useTranslation } from 'react-i18next';

import {
  codeProps,
  fieldDefaults,
  fieldName,
  fieldText,
  handsHeld,
  keyTyped,
  nextGiven,
  nextPin,
  nextStrayed,
  type Refused,
  refusedHint,
  refusedName,
  type Typing,
  valueHanded,
  withInvalid,
} from '../kit/fields.ts';
import { useBoldText } from '../theme/boldText.ts';
import { inputFaced } from '../theme/fonts.ts';
import { tokens } from '../theme/tokens.ts';
import { fieldChecked, fieldFocused, fieldLeft, fieldTyped, focusedField } from './focusedField.ts';
import { raiseKeysOn } from './keyboardWatch.ts';
import { useReadOut } from './ReadOut.tsx';
import {
  arrivedFocusStep,
  holdsMountFocus,
  mountedKeys,
  openedFocus,
  WindowArriving,
} from './openedFocus.ts';
import { bothRefs, useFocusOnAnswer } from './Screen.tsx';
import { moveScreenReaderFocus, useScreenReader } from './screenReaderFocus.ts';
import { capUnderTitle, CONTROL_TEXT_SIZE } from '../layout/textSize.ts';
import { Text, type TextHandle, TitleCap } from './Text.tsx';
import { UnseenName } from './UnseenName.tsx';
import { useMarkSide } from './markSide.ts';

export { CONTROL_TEXT_SIZE };

interface FieldNamed {
  labelID: string;
  /** The line under the Field, and the unseen copy of its label with "Invalid" that names a refused control on Android. */
  line: string | null | undefined;
  invalidNameID: string;
}

const FieldLabel = createContext<FieldNamed | undefined>(undefined);

/** The nativeID of the label of the Field a control sits in, which names the control on Android. */
export function useFieldLabel(): string | undefined {
  return useContext(FieldLabel)?.labelID;
}

/** While a control is refused, what a screen reader says of it: "Invalid" with its name, and its line as its hint, the Field's line unless it is given its own (sc-31323). */
export function useRefused(wrong: boolean, line?: string | null | undefined): Refused | null {
  const { t } = useTranslation();
  const field = useContext(FieldLabel);
  if (!wrong) return null;

  return { word: t('forms.invalid'), line: line ?? field?.line, nameID: field?.invalidNameID };
}

/** A refused text field's name and hint, from what it would say unrefused. */
export function refusedField(
  refused: Refused | null,
  rest: Pick<TextInputProps, 'accessibilityLabel' | 'accessibilityHint' | 'placeholder'>,
  labelID: string | undefined,
) {
  return {
    ...refusedName(
      Platform.OS,
      fieldName(Platform.OS, rest.accessibilityLabel, {
        labelID,
        placeholder: rest.placeholder,
      }),
      refused,
      rest.placeholder,
    ),
    accessibilityHint: refusedHint(refused, rest.accessibilityHint),
  };
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
  linesQuiet = false,
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
  /** The error and help lines are out of TalkBack's reach, so the control is the last view of the Field it can land on. */
  linesQuiet?: boolean;
  children: ReactNode;
  /** The whole Field, which a client check failing on its picker brings into view. */
  ref?: RefObject<ViewInstance | null> | undefined;
}) {
  const own = useRef<ViewInstance>(null);
  const field = ref ?? own;
  const labelID = useId();
  const invalidNameID = useId();
  const { t } = useTranslation();
  const { read: helpRead } = useFocusOnAnswer<TextHandle>(helpAnswer);
  const helpLines = typeof help === 'string' ? [help] : (help ?? []);
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
        <Text size={tokens.typeButton.size} weight="medium" nativeID={labelID}>
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
      <UnseenName nativeID={invalidNameID}>
        {error == null ? label : withInvalid(label, t('forms.invalid'))}
      </UnseenName>
      <FieldLabel value={{ labelID, line: error, invalidNameID }}>{children}</FieldLabel>
      {(error != null || helpLines.length > 0) && (
        <View
          style={styles.field}
          importantForAccessibility={linesQuiet ? 'no-hide-descendants' : 'auto'}
        >
          {error != null && (
            <FieldError message={error} actions={errorActions} answer={errorAnswer} />
          )}
          {helpLines.map((line, index) => (
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
      )}
    </View>
  );
}

export interface FieldAction {
  label: string;
  onPress: () => void;
  testID: string;
}

/** A refusal whose summary is said in place of each Field's line: each line is read as its control takes focus, and one said as well would queue behind the summary and be said again there (sc-43907). It lasts the one commit the refusal's lines mount in, as it is read only as an error mounts: a line that mounts later, such as a refused cover photo's, is said. TalkBack's alone: its focus move drops queued speech, and VoiceOver says each line after the summary as it did. */
export const LinesInSummary = createContext(false);

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
  useReadOut(answer === undefined ? message : null, {
    quietAtMount: useContext(LinesInSummary),
  });
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
  const [strayed, setStrayed] = useState(false);
  const handed = nextGiven(Platform.OS, value, typing);
  const { typed, pinned, given } = handed;
  const field = {
    held,
    handsHeld: handsHeld(Platform.OS, strayed),
    value: valueHanded(Platform.OS, value, given),
    defaultValue,
    typed,
    pinned,
  };
  const next = nextPin(field, fontScale, scale);

  if (next.scale !== scale) setScale(next.scale);
  if (handed !== typing || next.pinned !== pinned) setTyping({ ...handed, pinned: next.pinned });
  const stillStrayed = nextStrayed(held, strayed, false);
  if (stillStrayed !== strayed) setStrayed(stillStrayed);

  if (held)
    return {
      ...fieldText(field),
      onChangeText: field.handsHeld
        ? undefined
        : () => setStrayed(nextStrayed(held, strayed, true)),
    };

  return {
    ...fieldText(field),
    onChangeText: (text) => {
      setTyping((last) => keyTyped(last, text));
      onChangeText?.(text);
      fieldTyped();
    },
  };
}

/** Whether a password reads as typed: hidden by default, and hidden again once a submit runs, on leaving the screen and when the app goes to the background. */
export function useRevealed(submitting: boolean) {
  const [revealed, setRevealed] = useState(false);
  const [wasSubmitting, setWasSubmitting] = useState(submitting);

  if (submitting !== wasSubmitting) {
    setWasSubmitting(submitting);
    if (submitting) setRevealed(false);
  }

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setRevealed(false);
    });

    return () => listener.remove();
  }, []);

  useFocusEffect(useCallback(() => () => setRevealed(false), []));

  return [revealed, setRevealed] as const;
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
  // Android reads the keys as hidden over a Modal, so a blur there put them down on a check (sc-40584).
  if (Platform.OS === 'android' && focused) {
    fieldChecked(true);
    raiseKeysOn(input);
    return;
  }
  // An iPhone header tap hides the keys and leaves the field focused, and focus() skips a focused field.
  if (focused && !Keyboard.isVisible()) input.blur();
  fieldChecked(focused && Keyboard.isVisible());
  input.focus();
}

/** Android binds the keyboard to a field only after the field's first layout, and shows no keys for a field focused before that. */
const NEW_FIELD_BOUND_MS = 150;

/** To a field drawn in this commit, with the keyboard and the screen reader on it. Returns what cancels the moves still to come. */
export function focusNewField(input: TextInputInstance | null): () => void {
  if (input == null) return () => {};
  focusChecked({ current: input });
  if (Platform.OS !== 'android') return () => {};
  const bound = setTimeout(() => {
    if (!input.isFocused()) return;
    // TalkBack does not follow input focus, and left on the button that added the row it went to the top of the screen (qa2 #83712).
    moveScreenReaderFocus(input);
    if (!Keyboard.isVisible()) raiseKeysOn(input);
  }, NEW_FIELD_BOUND_MS);

  return () => clearTimeout(bound);
}

/** A field that opens focused in a sliding Android window takes its focus once the window has arrived, not at mount, and held there for a few seconds, sent again whenever Android says the field does not have it (sc-91027). One that opens focused in an Android window that does not slide in, as on a tablet, is focused with its keys once, shortly after mount (sc-92467). Spread `autoFocus` and `onPressIn` after the field's own props; `focused` is the field's own focus, from its focus and blur events. */
export function useOpenedFocus(
  autoFocus: boolean | undefined,
  focused: boolean,
): {
  input: RefObject<TextInputInstance | null>;
  autoFocus: boolean | undefined;
  onPressIn: () => void;
} {
  const input = useRef<TextInputInstance>(null);
  const arrival = useContext(WindowArriving);
  const [opened] = useState(() => openedFocus(autoFocus, arrival));
  const [ticks, setTicks] = useState(0);
  const readerOn = useScreenReader();

  useEffect(() => {
    const field = input.current;
    const step = arrivedFocusStep({
      opened,
      arrival,
      focused,
      heldElsewhere: !focused && focusedField() != null,
      readerOn,
      ticks,
    });
    if (step === 'wait' || step === 'done' || field == null) return undefined;
    // TextInput's focus() skips a field JS already counts as focused, which a lost focus leaves it doing.
    if (step === 'focus') raiseKeysOn(field);
    const next = setTimeout(() => setTicks((count) => count + 1), NEW_FIELD_BOUND_MS);

    return () => clearTimeout(next);
  }, [opened, arrival, focused, readerOn, ticks]);

  const [held] = useState(() => holdsMountFocus(Platform.OS, opened, autoFocus, readerOn));
  const [keysStep] = useState(() => mountedKeys(held));
  const [keyTicks, setKeyTicks] = useState(0);
  const touched = useRef(false);

  useEffect(() => {
    const field = input.current;
    if (field == null) return undefined;
    const step = keysStep({
      heldElsewhere: !focused && focusedField() != null,
      readerOn,
      touched: touched.current,
      ticks: keyTicks,
    });
    if (step === 'raise') raiseKeysOn(field);
    if (step === 'wait' || step === 'done') return undefined;
    const next = setTimeout(() => setKeyTicks((count) => count + 1), NEW_FIELD_BOUND_MS);

    return () => clearTimeout(next);
  }, [keysStep, focused, readerOn, keyTicks]);

  return {
    input,
    autoFocus: opened === 'arrived' || held ? false : autoFocus,
    onPressIn: () => {
      touched.current = true;
    },
  };
}

/** At a submit the client checks passed: keys hidden over a focused field stay hidden while it runs and after it. */
export function keysStayDown(): void {
  // A header tap on an iPhone hides the keys and leaves the field focused, and iOS raises them again as the held field changes.
  // Android reads the keys as hidden over a Modal, so there the blur would put them down on a return-key submit.
  if (Platform.OS === 'ios' && !Keyboard.isVisible())
    TextInput.State.currentlyFocusedInput()?.blur();
}

/** Whether the field has focus, for drawing it on the field's own edge. */
export function useFocusEdge<E>(onFocus?: (event: E) => void, onBlur?: (event: E) => void) {
  const [focused, setFocused] = useState(false);

  return {
    focused,
    edging: {
      onFocus: (event: E) => {
        setFocused(true);
        onFocus?.(event);
      },
      onBlur: (event: E) => {
        setFocused(false);
        onBlur?.(event);
      },
    },
  };
}

/** Focus on a bare input's own edge: its 1pt border drawn 2pt, green or red, with 1pt less padding so nothing moves. */
export function focusEdge(focused: boolean, wrong: boolean) {
  return [focused && fieldStyles.edge, wrong && fieldStyles.wrong];
}

/** Focus on the edge of a box that holds its input: laid over the box's 1pt border, so nothing moves. */
export function FocusEdge({ wrong = false }: { wrong?: boolean }) {
  return <View pointerEvents="none" style={[fieldStyles.over, wrong && fieldStyles.wrong]} />;
}

/** Under a frame's title, typed text grows no larger than the title does, as a `Text` there does. */
function useUnderTitle(size: number, own: number | undefined): number | undefined {
  const cap = useContext(TitleCap);

  return cap == null ? own : capUnderTitle(cap, size, own);
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
  const refused = useRefused(wrong);
  const { focused, edging } = useFocusEdge(rest.onFocus, rest.onBlur);
  const bold = useBoldText();
  const opened = useOpenedFocus(rest.autoFocus, focused);

  return (
    <TextInput
      {...fieldDefaults(Platform.OS)}
      {...rest}
      autoFocus={opened.autoFocus}
      onPressIn={opened.onPressIn}
      {...refusedField(refused, rest, labelID)}
      {...holding}
      ref={bothRefs(opened.input, ref)}
      {...edging}
      style={inputFaced([styles.input, focusEdge(focused, wrong), style], 'sans', bold)}
      maxFontSizeMultiplier={useUnderTitle(
        StyleSheet.flatten(style)?.fontSize ?? CONTROL_TEXT_SIZE,
        rest.maxFontSizeMultiplier,
      )}
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
  const refused = useRefused(wrong);
  const { focused, edging } = useFocusEdge(rest.onFocus, rest.onBlur);
  const bold = useBoldText();
  const opened = useOpenedFocus(rest.autoFocus, focused);

  return (
    <TextInput
      {...codeProps(Platform.OS, takesRecoveryCode)}
      autoComplete="sms-otp"
      {...rest}
      autoFocus={opened.autoFocus}
      onPressIn={opened.onPressIn}
      {...refusedField(refused, rest, labelID)}
      {...holding}
      ref={bothRefs(opened.input, ref)}
      {...edging}
      style={inputFaced([styles.code, focusEdge(focused, wrong), style], 'sans', bold)}
      maxFontSizeMultiplier={useUnderTitle(
        StyleSheet.flatten(style)?.fontSize ?? tokens.typeTitleDialog.size,
        rest.maxFontSizeMultiplier,
      )}
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
    borderColor: tokens.colorFieldBorder,
    borderRadius: tokens.radiusField,
    backgroundColor: tokens.colorCard,
    color: tokens.colorInk,
    fontSize: CONTROL_TEXT_SIZE,
  },
  edge: {
    paddingHorizontal: tokens.spaceLg - 1,
    paddingVertical: tokens.spaceSm - 1,
    borderWidth: 2,
    borderColor: tokens.colorAccent,
  },
  over: {
    position: 'absolute',
    top: -1,
    right: -1,
    bottom: -1,
    left: -1,
    borderWidth: 2,
    borderRadius: tokens.radiusField,
    borderColor: tokens.colorAccent,
  },
  wrong: { borderColor: tokens.colorBroken },
});

const styles = StyleSheet.create({
  field: { gap: tokens.spaceSm },
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
  code: {
    minHeight: tokens.sizeHitPhoneHero,
    paddingHorizontal: tokens.spaceLg,
    paddingVertical: tokens.spaceSm,
    borderWidth: 1,
    borderColor: tokens.colorFieldBorder,
    borderRadius: tokens.radiusField,
    backgroundColor: tokens.colorCard,
    color: tokens.colorInk,
    fontSize: tokens.typeTitleDialog.size,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
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
