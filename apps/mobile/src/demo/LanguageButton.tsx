import { LOCALES } from '@soirely/domain';
import { useContext, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewInstance } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { RadioMark } from '../components/RadioMark.tsx';
import { Sheet } from '../components/Sheet.tsx';
import { Text } from '../components/Text.tsx';
import { tokens } from '../theme/tokens.ts';
import { SheetBody } from '../steps/Lines.tsx';
import { OnCover } from './Welcome.tsx';

const LANGUAGES = LOCALES.map((locale) => locale.nativeName);

/** Welcome's language button; the demo's words stay English, so its sheet only shows the choice. */
export function LanguageButton() {
  const opener = useRef<ViewInstance>(null);
  const [open, setOpen] = useState(false);
  const onCover = useContext(OnCover);
  const ink = onCover ? tokens.colorInkOnDark : tokens.colorInkSecondary;

  return (
    <>
      <Pressable
        ref={opener}
        style={[styles.button, onCover && styles.glass]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Language: English"
        testID="demo.language"
      >
        <Svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke={ink}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Circle cx={12} cy={12} r={9.5} />
          <Path d="M2.5 12h19M12 2.5c2.6 2.6 3.9 5.8 3.9 9.5s-1.3 6.9-3.9 9.5c-2.6-2.6-3.9-5.8-3.9-9.5s1.3-6.9 3.9-9.5z" />
        </Svg>
        <Text
          size={tokens.typeButton.size}
          weight="semibold"
          accessible={false}
          style={onCover && styles.onCover}
        >
          English
        </Text>
        <Svg
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="none"
          stroke={ink}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="m6 9 6 6 6-6" />
        </Svg>
      </Pressable>
      <Sheet open={open} onClose={() => setOpen(false)} opener={opener} testID="demo.languageSheet">
        <SheetBody>
          <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
            Language
          </Text>
          <Text size={tokens.typeBody.size} style={styles.note}>
            The demo’s words stay in English; the build keeps the language sheet from sc-28812.
          </Text>
          <View style={styles.list}>
            {LANGUAGES.map((language) => (
              <Pressable
                key={language}
                style={styles.choice}
                onPress={() => setOpen(false)}
                accessibilityRole="radio"
                accessibilityState={{ checked: language === 'English' }}
                accessibilityLabel={language}
                testID={`demo.language.${language}`}
              >
                <RadioMark on={language === 'English'} />
                <Text size={tokens.typeBodyGuest.size} accessible={false}>
                  {language}
                </Text>
              </Pressable>
            ))}
          </View>
        </SheetBody>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingLeft: tokens.spaceMd,
    paddingRight: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorCard,
  },
  glass: { borderColor: tokens.scrimDialog, backgroundColor: tokens.scrimDialog },
  onCover: { color: tokens.colorInkOnDark },
  note: { marginTop: tokens.spaceXs, color: tokens.colorInkSecondary },
  list: { marginTop: tokens.spaceLg },
  choice: {
    minHeight: tokens.sizeListRow,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
  },
});
