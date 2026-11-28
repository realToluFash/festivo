import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Glyph } from '../components/Glyph.tsx';
import { PasteButton, usePasteHeight } from '../components/PasteReply.tsx';
import { readOut } from '../components/ReadOut.tsx';
import { TextAction } from '../components/SummaryRows.tsx';
import { Text } from '../components/Text.tsx';
import { DemoOnly } from '../steps/Lines.tsx';
import { tokens } from '../theme/tokens.ts';
import { NOTHING_TO_PASTE, PASTE_CODE, codeInPaste } from './pasteCode.ts';
import { SAMPLE } from './samples.ts';

const RING = 1.5;

/** The demo's stand-ins for what was copied, so every path opens on a simulator with nothing copied. */
const COPIED = [
  { label: 'Copied: Copy code in WhatsApp', text: SAMPLE.code },
  {
    label: 'Copied: the whole WhatsApp message',
    text: `*${SAMPLE.code}* is your verification code. For your security, do not share this code.`,
  },
  { label: 'Copied: a phone number', text: '+234 801 234 5678' },
  { label: 'Copied: two different codes', text: `${SAMPLE.code}, then 771204` },
  { label: 'Copied: nothing', text: '' },
] as const;

/** Android's and iOS's before 16: Soirely's own secondary button, which reads the clipboard only when pressed. */
function OwnPasteCode({ onText }: { onText: (text: string) => void }) {
  const height = usePasteHeight();
  const press = () => {
    Clipboard.getStringAsync().then(onText, () => onText(''));
  };

  return (
    <Pressable
      onPress={press}
      style={({ pressed }) => [
        styles.own,
        { height, borderRadius: height / 2 },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={PASTE_CODE}
      testID="demo.pasteCode"
    >
      <Glyph name="clipboard" ink={tokens.colorInk} />
      <Text size={15} weight="semibold" numberOfLines={1} accessible={false}>
        {PASTE_CODE}
      </Text>
    </Pressable>
  );
}

function PasteCodeButton({ onText }: { onText: (text: string) => void }) {
  return Platform.OS === 'ios' && Clipboard.isPasteButtonAvailable ? (
    <PasteButton onText={onText} />
  ) : (
    <OwnPasteCode onText={onText} />
  );
}

/** What a press found, and the line beside the button until the person types or presses again. */
export function usePasteCode(onCode: (code: string) => void) {
  const [nothing, setNothing] = useState(false);
  const onText = (text: string) => {
    const code = codeInPaste(text);
    if (code !== null) {
      setNothing(false);
      onCode(code);
      return;
    }
    setNothing(true);
    readOut(NOTHING_TO_PASTE, { interrupts: true });
  };

  return { nothing, onText, typed: () => setNothing(false) };
}

/** Paste code beside the code boxes (sc-99215), the Nothing to paste line beside it, wrapping under it when there is no room. */
export function PasteCode({
  nothing,
  onText,
  demo = true,
}: {
  nothing: boolean;
  onText: (text: string) => void;
  demo?: boolean;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <PasteCodeButton onText={onText} />
        {nothing && (
          <View style={styles.beside}>
            <Text size={14} weight="medium" style={styles.notice} testID="demo.pasteCode.nothing">
              {NOTHING_TO_PASTE}
            </Text>
          </View>
        )}
      </View>
      {demo && (
        <DemoOnly title="Demo only: what the press finds copied">
          {COPIED.map((each, index) => (
            <TextAction
              key={each.label}
              label={each.label}
              onPress={() => onText(each.text)}
              testID={`demo.pasteCode.copied.${index}`}
            />
          ))}
        </DemoOnly>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: tokens.spaceLg, gap: tokens.spaceSm },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spaceMd,
    rowGap: tokens.spaceXs,
  },
  beside: { flexGrow: 1, flexBasis: 180, minWidth: 0 },
  notice: { color: tokens.colorInkSecondary, lineHeight: 14 * 1.4 },
  pressed: { opacity: tokens.opacityPressed },
  own: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: RING,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
});
