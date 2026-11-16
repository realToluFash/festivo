import { type Ref, useEffect, useId, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  type TextInputInstance,
  useWindowDimensions,
  View,
  type ViewInstance,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { FocusEdge } from '../components/Field.tsx';
import { fieldFocused, fieldLeft } from '../components/focusedField.ts';
import { Text } from '../components/Text.tsx';
import { UnseenName } from '../components/UnseenName.tsx';
import { FIELD_DEFAULTS, fieldName, refusedHint, refusedName, withInvalid } from '../kit/fields.ts';
import { Plain, Says } from '../steps/Lines.tsx';
import { useBoldText } from '../theme/boldText.ts';
import { inputFaced } from '../theme/fonts.ts';
import { tokens } from '../theme/tokens.ts';
import { MESSAGE_BOX, MESSAGE_BOX_MOST_SCALE } from './joinMessage.ts';

/** InsideField's LABEL_LARGE: the two multi-line fields share one constant once this moves into the kit. */
const TEXT_LARGE = 17;

/** One focused group, so the keys lift the refusal and the count above Ask to join with the box. */
export function MessageBox({
  label,
  value,
  onChangeText,
  onBlur,
  line,
  count,
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
  const group = useRef<ViewInstance>(null);
  const refused = line == null ? null : { word: t('forms.invalid'), line, nameID: invalidNameID };
  const height = MESSAGE_BOX * Math.min(Math.max(fontScale, 1), MESSAGE_BOX_MOST_SCALE);

  useEffect(() => {
    const mounted = group.current;

    return () => fieldLeft(mounted);
  }, []);

  return (
    <View
      ref={group}
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
            ref={ref}
            value={value}
            onChangeText={onChangeText}
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
    fontSize: TEXT_LARGE,
    textAlignVertical: 'top',
  },
});
