import { type Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  TextInput,
  type TextInputInstance,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { FocusEdge, useHeld } from '../components/Field.tsx';
import { Text } from '../components/Text.tsx';
import { codeProps, fieldName, refusedHint, refusedName } from '../kit/fields.ts';
import { inputFaced } from '../theme/fonts.ts';
import { tokens } from '../theme/tokens.ts';
import { tap } from './haptics.ts';
import { CODE_LENGTH, codeDigits } from './rules.ts';
import { useShake } from './shake.ts';

export type CodeState = 'typing' | 'wrong' | 'done';

export interface CodeBoxesHandle {
  /** Shakes the boxes once with a warning tap, then clears them for the next try. */
  refuse: () => void;
  focus: () => void;
}

/** One field drawn as six boxes, so a paste or the code offered above the keys fills all six; the sixth digit sends it. */
export function CodeBoxes({
  label,
  value,
  onChange,
  onFull,
  done = false,
  line,
  autoFocus = true,
  ref,
  testID,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  onFull?: (code: string) => void;
  done?: boolean;
  /** The line under the boxes about the code: while it shows, a screen reader hears "Invalid" with the name and the line as the hint (sc-31323). */
  line?: string | null | undefined;
  autoFocus?: boolean;
  ref?: Ref<CodeBoxesHandle> | undefined;
  testID: string;
}) {
  const { t } = useTranslation();
  const refused = line == null ? null : { word: t('forms.invalid'), line };
  const input = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  const [wrong, setWrong] = useState(false);
  const { shaken, shake } = useShake();
  const holding = useHeld(done, value, undefined, (text) => {
    const digits = codeDigits(text);
    setWrong(false);
    onChange(digits);
    if (digits.length === CODE_LENGTH) onFull?.(digits);
  });

  useImperativeHandle(ref, () => ({
    refuse: () => {
      tap.wrong();
      setWrong(true);
      shake(() => onChange(''));
    },
    focus: () => input.current?.focus(),
  }));

  useEffect(() => {
    if (done) tap.done();
  }, [done]);

  const digits = [...value];

  return (
    <View>
      <Animated.View
        style={[styles.row, shaken]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: CODE_LENGTH }, (_, index) => (
          <View key={index} style={[styles.box, done && styles.boxDone]}>
            {focused && !done && !wrong && index === Math.min(digits.length, CODE_LENGTH - 1) && (
              <FocusEdge />
            )}
            <Text
              size={tokens.typeTitlePhone.size}
              weight="semibold"
              style={done ? styles.digitDone : undefined}
              accessible={false}
            >
              {digits[index] ?? ''}
            </Text>
          </View>
        ))}
      </Animated.View>
      <TextInput
        {...codeProps(false)}
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        {...refusedName(Platform.OS, fieldName(Platform.OS, label, {}), refused, label)}
        accessibilityHint={refusedHint(refused, undefined)}
        {...holding}
        ref={input}
        autoFocus={autoFocus}
        maxLength={CODE_LENGTH}
        caretHidden
        contextMenuHidden={false}
        selectionColor="transparent"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={inputFaced(styles.input)}
        aria-invalid={wrong}
        testID={testID}
      />
    </View>
  );
}

/** A code's label above its boxes, where a screen has two codes. */
export function CodeLabel({ words }: { words: string }) {
  return (
    <Text size={tokens.typeBody.size} weight="semibold" style={styles.label}>
      {words}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: tokens.spaceSm },
  box: {
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colorFieldBorder,
    borderRadius: tokens.radiusField,
    backgroundColor: tokens.colorCard,
  },
  boxDone: { borderColor: tokens.colorAccentHover, backgroundColor: tokens.colorAccentTint },
  digitDone: { color: tokens.colorAccentText },
  input: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    color: 'transparent',
    backgroundColor: 'transparent',
    fontSize: 1,
  },
  label: { marginTop: tokens.spaceXl, marginBottom: tokens.spaceSm },
});
