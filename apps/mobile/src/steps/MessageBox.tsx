import { type Ref, useEffect, useId, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  type TextInputInstance,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { FocusEdge, useHeld } from '../components/Field.tsx';
import { fieldFocused, fieldLeft } from '../components/focusedField.ts';
import { useAboveKeyboard } from '../components/Screen.tsx';
import { Text } from '../components/Text.tsx';
import { UnseenName } from '../components/UnseenName.tsx';
import { FIELD_DEFAULTS, fieldName, refusedHint, refusedName, withInvalid } from '../kit/fields.ts';
import { useBoldText } from '../theme/boldText.ts';
import { inputFaced } from '../theme/fonts.ts';
import { tokens } from '../theme/tokens.ts';
import { LABEL_LARGE } from './InsideField.tsx';
import { Plain, Says } from './Lines.tsx';

/** The box's height at the default text size: about four lines under its label, and with the label, refusal and count it still fits above the keys and the button on an iPhone SE. It scrolls inside rather than growing. */
export const MESSAGE_BOX = 132;
/** Larger Text grows the box with it up to here, then it scrolls sooner. */
export const MESSAGE_BOX_MOST_SCALE = 1.5;

/** A message of many lines: its label a band of its own over the text, which scrolls below it. One focused group that lifts again as it grows, so a refusal or a longer count shown while typing comes above the button and the keys with the box. */
export function MessageBox({
  label,
  value,
  onChangeText,
  onBlur,
  line,
  count,
  submitting = false,
  autoFocus = false,
  ref,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur: () => void;
  line: string | null;
  count: string;
  /** A request runs: what was typed is held, and the focus and the keys stay. */
  submitting?: boolean;
  autoFocus?: boolean;
  ref?: Ref<TextInputInstance> | undefined;
  testID: string;
}) {
  const { t } = useTranslation();
  const labelID = useId();
  const invalidNameID = useId();
  const { fontScale } = useWindowDimensions();
  const bold = useBoldText();
  const [focused, setFocused] = useState(false);
  const { ref: group, onLayout } = useAboveKeyboard();
  const refused = line == null ? null : { word: t('forms.invalid'), line, nameID: invalidNameID };
  const holding = useHeld(submitting, value, undefined, onChangeText);
  const height = MESSAGE_BOX * Math.min(Math.max(fontScale, 1), MESSAGE_BOX_MOST_SCALE);

  useEffect(() => {
    const mounted = group.current;

    return () => fieldLeft(mounted);
  }, [group]);

  return (
    <View
      ref={group}
      onLayout={onLayout}
      onFocus={() => fieldFocused(group.current)}
      onBlur={() => fieldLeft(group.current)}
    >
      <View style={[styles.box, { height }, refused != null && styles.boxWrong]}>
        <Text
          nativeID={labelID}
          size={tokens.typeSmall.size}
          weight="medium"
          numberOfLines={1}
          style={[styles.label, refused != null ? styles.labelWrong : styles.labelPlain]}
          accessible={false}
        >
          {label}
        </Text>
        <View style={styles.clip}>
          <TextInput
            {...FIELD_DEFAULTS}
            {...refusedName(
              Platform.OS,
              fieldName(Platform.OS, label, { labelID }),
              refused,
              label,
            )}
            accessibilityHint={refusedHint(refused, undefined)}
            {...holding}
            ref={ref}
            multiline
            scrollEnabled
            autoFocus={autoFocus}
            autoCapitalize="sentences"
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              onBlur();
            }}
            style={inputFaced(styles.input, 'sans', bold)}
            aria-invalid={refused != null}
            testID={testID}
          />
        </View>
        <UnseenName nativeID={invalidNameID}>
          {refused == null ? label : withInvalid(label, refused.word)}
        </UnseenName>
        {focused && <FocusEdge wrong={refused != null} />}
      </View>
      {line != null && <Says words={line} />}
      <Plain>{count}</Plain>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: tokens.colorFieldBorder,
    borderRadius: tokens.radiusField,
    backgroundColor: tokens.colorCard,
    overflow: 'hidden',
  },
  boxWrong: { borderColor: tokens.colorBroken },
  label: {
    paddingTop: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXl - 1,
  },
  labelPlain: { color: tokens.colorInkSecondary },
  labelWrong: { color: tokens.colorBrokenText },
  clip: { flex: 1, marginTop: tokens.spaceXxs, overflow: 'hidden' },
  input: {
    flex: 1,
    paddingTop: 0,
    paddingBottom: tokens.spaceSm,
    paddingHorizontal: tokens.spaceXl - 1,
    color: tokens.colorInk,
    fontSize: LABEL_LARGE,
    textAlignVertical: 'top',
  },
});
