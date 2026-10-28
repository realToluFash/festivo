import { useFocusEffect } from 'expo-router';
import { type Ref, useCallback, useEffect, useState } from 'react';
import {
  AppState,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { fieldName, passwordProps } from '../kit/fields.ts';
import { faced } from '../theme/fonts.ts';
import { tokens } from '../theme/tokens.ts';
import { fieldStyles, useFieldLabel, useHeld } from './Field.tsx';
import { Text } from './Text.tsx';

/** Room for "Show" or "Hide", so typed text never runs under the control. */
const REVEAL_ROOM = 72;

/** Hidden by default, and hidden again on submit, on leaving the screen and when the app goes to the background. */
export function PasswordField({
  wrong = false,
  submitting = false,
  value,
  onChangeText,
  onSubmitEditing,
  ref,
  testID,
  ...rest
}: Omit<TextInputProps, 'secureTextEntry'> & {
  wrong?: boolean;
  submitting?: boolean;
  testID: string;
  ref?: Ref<TextInput> | undefined;
}) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const [wasSubmitting, setWasSubmitting] = useState(submitting);

  // Hidden again the moment the form is submitted, adjusted while rendering rather than in an effect.
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
  const holding = useHeld(submitting, value, rest.defaultValue, onChangeText);
  const labelID = useFieldLabel();

  return (
    <View>
      <TextInput
        {...rest}
        {...fieldName(Platform.OS, rest.accessibilityLabel, {
          labelID,
          placeholder: rest.placeholder,
        })}
        {...passwordProps(revealed)}
        value={value}
        {...holding}
        ref={ref}
        style={faced([fieldStyles.input, styles.withReveal, wrong && fieldStyles.wrong])}
        aria-invalid={wrong}
        testID={testID}
        onSubmitEditing={(event) => {
          setRevealed(false);
          onSubmitEditing?.(event);
        }}
      />
      <Pressable
        style={styles.reveal}
        onPress={() => setRevealed((shown) => !shown)}
        accessibilityRole="togglebutton"
        accessibilityState={{ checked: revealed }}
        accessibilityLabel={revealed ? t('signIn.conceal') : t('signIn.reveal')}
        testID={`${testID}.reveal`}
      >
        <Text size={tokens.typeButton.size} weight="semibold" style={styles.accent}>
          {revealed ? t('signIn.conceal') : t('signIn.reveal')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  withReveal: { paddingRight: REVEAL_ROOM },
  reveal: {
    position: 'absolute',
    top: 0,
    right: tokens.spaceHair,
    bottom: 0,
    minWidth: tokens.sizeHit,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg,
  },
  accent: { color: tokens.colorAccentText },
});
