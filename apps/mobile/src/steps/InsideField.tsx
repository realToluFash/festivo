import { type Ref, useEffect, useId, useRef, useState } from 'react';
import {
  Animated,
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
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { FocusEdge, useHeld } from '../components/Field.tsx';
import { fieldFocused, fieldLeft } from '../components/focusedField.ts';
import { Text } from '../components/Text.tsx';
import { UnseenName } from '../components/UnseenName.tsx';
import {
  FIELD_DEFAULTS,
  fieldName,
  passwordProps,
  refusedHint,
  refusedName,
  withInvalid,
} from '../kit/fields.ts';
import { glide } from '../motion.ts';
import { useBoldText } from '../theme/boldText.ts';
import { inputFaced } from '../theme/fonts.ts';
import { tokens } from '../theme/tokens.ts';

const HEIGHT = 56;
const LABEL_LARGE = 17;
const LABEL_SMALL = tokens.typeSmall.size;

export type FieldState = 'plain' | 'blank';

/** The label inside the box: large while it is empty, small at its top once there is text, so it never goes. */
export function InsideField({
  label,
  value,
  defaultValue,
  onChangeText,
  password = false,
  state = 'plain',
  line,
  submitting = false,
  multiline = false,
  ref,
  testID,
  ...rest
}: Omit<TextInputProps, 'value' | 'defaultValue' | 'onChangeText' | 'style'> & {
  label: string;
  /** A typed field takes `defaultValue` instead: a value handed back on every key drops characters. */
  value?: string;
  defaultValue?: string;
  onChangeText?: (text: string) => void;
  password?: boolean;
  /** Blank or malformed: a thin red edge and a red label. A refusal shakes the field and leaves its edge. */
  state?: FieldState;
  /** The line about it under it: while it shows, a screen reader hears "Invalid" with the name and the line as the hint (sc-31323). */
  line?: string | null | undefined;
  /** A request runs: what was typed is held, and the focus and the keys stay. */
  submitting?: boolean;
  multiline?: boolean;
  ref?: Ref<TextInputInstance> | undefined;
  testID: string;
}) {
  const { t } = useTranslation();
  const labelID = useId();
  const invalidNameID = useId();
  const refused = line == null ? null : { word: t('forms.invalid'), line, nameID: invalidNameID };
  const { fontScale } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  const bold = useBoldText();
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState(value ?? defaultValue ?? '');
  const raised = focused || (value ?? typed) !== '' || multiline;
  const [lift] = useState(() => new Animated.Value(raised ? 1 : 0));
  const holding = useHeld(submitting, value, defaultValue, (text) => {
    setTyped(text);
    onChangeText?.(text);
  });
  const labelLine = LABEL_SMALL * 1.35 * fontScale;
  const box = useRef<ViewInstance>(null);

  useEffect(() => {
    const mounted = box.current;

    return () => fieldLeft(mounted);
  }, []);

  useEffect(() => {
    const run = glide(lift, raised ? 1 : 0, tokens.motionFast);
    run.start();

    return () => run.stop();
  }, [lift, raised]);

  const scale = lift.interpolate({
    inputRange: [0, 1],
    outputRange: [1, LABEL_SMALL / LABEL_LARGE],
  });
  const translateY = lift.interpolate({
    inputRange: [0, 1],
    outputRange: [(HEIGHT - 2 - LABEL_LARGE * 1.3 * fontScale) / 2, tokens.spaceSm],
  });

  return (
    <View
      ref={box}
      onFocus={() => fieldFocused(box.current)}
      onBlur={() => fieldLeft(box.current)}
      style={[styles.box, multiline && styles.tall, state === 'blank' && styles.blank]}
    >
      <TextInput
        {...FIELD_DEFAULTS}
        {...(password && passwordProps(revealed))}
        {...rest}
        {...refusedName(Platform.OS, fieldName(Platform.OS, label, { labelID }), refused, label)}
        accessibilityHint={refusedHint(refused, rest.accessibilityHint)}
        {...holding}
        ref={ref}
        multiline={multiline}
        onFocus={(event) => {
          setFocused(true);
          rest.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          rest.onBlur?.(event);
        }}
        style={inputFaced(
          [
            styles.input,
            { paddingTop: tokens.spaceSm + labelLine },
            multiline && styles.inputTall,
            password && styles.inputBeside,
          ],
          'sans',
          bold,
        )}
        aria-invalid={state !== 'plain'}
        testID={testID}
      />
      <UnseenName nativeID={invalidNameID}>
        {refused == null ? label : withInvalid(label, refused.word)}
      </UnseenName>
      <Animated.View
        pointerEvents="none"
        style={[styles.label, { transform: [{ translateY }, { scale }] }]}
      >
        <Text
          nativeID={labelID}
          size={LABEL_LARGE}
          weight="medium"
          numberOfLines={1}
          style={state === 'blank' ? styles.labelBlank : styles.labelText}
          accessible={false}
        >
          {label}
        </Text>
      </Animated.View>
      {password && (
        <Pressable
          style={styles.eye}
          onPress={() => setRevealed((shown) => !shown)}
          accessibilityRole="button"
          accessibilityLabel={revealed ? t('steps.hidePassword') : t('steps.showPassword')}
          testID={`${testID}.reveal`}
        >
          <Svg
            width={22}
            height={22}
            viewBox="0 0 24 24"
            fill="none"
            stroke={tokens.colorInkSecondary}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
            <Circle cx={12} cy={12} r={3} />
            {revealed && <Path d="M3 3l18 18" />}
          </Svg>
        </Pressable>
      )}
      {focused && <FocusEdge wrong={state === 'blank'} />}
    </View>
  );
}

/** One line under a field: the rule as it is met, or what is wrong. */
export function FieldLine({ words, tone }: { words: string; tone: 'met' | 'unmet' | 'wrong' }) {
  return (
    <View style={styles.line}>
      {tone !== 'wrong' && (
        <Svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke={tone === 'met' ? tokens.colorAccentText : tokens.colorInkSecondary}
          strokeWidth={tone === 'met' ? 2.8 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {tone === 'met' ? (
            <Path d="M5 12.5l4.5 4.5L19 7.5" />
          ) : (
            <Circle cx={12} cy={12} r={8.5} />
          )}
        </Svg>
      )}
      <Text size={tokens.typeBody.size} style={LINE[tone]}>
        {words}
      </Text>
    </View>
  );
}

const LINE = StyleSheet.create({
  met: { color: tokens.colorAccentText },
  unmet: { color: tokens.colorInkSecondary },
  wrong: { color: tokens.colorBrokenText },
});

const styles = StyleSheet.create({
  box: {
    minHeight: HEIGHT,
    borderWidth: 1,
    borderColor: tokens.colorFieldBorder,
    borderRadius: tokens.radiusField,
    backgroundColor: tokens.colorCard,
    justifyContent: 'center',
  },
  tall: { minHeight: 132 },
  blank: { borderColor: tokens.colorBroken },
  input: {
    minHeight: HEIGHT - 2,
    paddingHorizontal: tokens.spaceXl - 1,
    paddingBottom: tokens.spaceSm,
    color: tokens.colorInk,
    fontSize: LABEL_LARGE,
  },
  inputTall: { minHeight: 130, textAlignVertical: 'top' },
  inputBeside: { paddingRight: tokens.sizeHit + tokens.spaceXxs },
  label: {
    position: 'absolute',
    top: 0,
    left: tokens.spaceXl - 1,
    right: tokens.sizeHit,
    transformOrigin: 'left top',
  },
  labelText: { color: tokens.colorInkSecondary },
  labelBlank: { color: tokens.colorBrokenText },
  eye: {
    position: 'absolute',
    right: tokens.spaceXxs,
    top: (HEIGHT - 2 - tokens.sizeHit) / 2,
    width: tokens.sizeHit,
    height: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    marginTop: tokens.spaceSm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
  },
});
