import { codeInPaste } from '@soirely/domain';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { PasteButton } from './PasteReply.tsx';
import { readOut } from './ReadOut.tsx';
import { Text } from './Text.tsx';

/** What a press of Paste code found (sc-99215): a code goes to `onCode`, anything else is said beside the button. The clipboard is read on the press only. */
export function usePasteCode(onCode: (code: string) => void) {
  const { t } = useTranslation();
  const [nothing, setNothing] = useState(false);
  const onText = useCallback(
    (text: string) => {
      const code = codeInPaste(text);
      if (code !== null) {
        setNothing(false);
        onCode(code);
        return;
      }
      setNothing(true);
      readOut(t('pasteCode.nothing'), { interrupts: true });
    },
    [onCode, t],
  );

  return { nothing, onText, typed: useCallback(() => setNothing(false), []) };
}

/** Paste code under a phone's code field, its line beside it, wrapping under it when there is no room. */
export function PasteCode({
  nothing,
  onText,
}: {
  nothing: boolean;
  onText: (text: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <PasteButton onText={onText} label={t('pasteCode.button')} testID="pasteCode" />
      {nothing && (
        <View style={styles.beside}>
          <Text size={14} weight="medium" style={styles.notice} testID="pasteCode.nothing">
            {t('pasteCode.nothing')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: tokens.spaceLg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceMd,
    rowGap: tokens.spaceXs,
  },
  beside: { flexGrow: 1, flexBasis: 180, minWidth: 0 },
  notice: { color: tokens.colorInkSecondary, lineHeight: 14 * 1.4 },
});
