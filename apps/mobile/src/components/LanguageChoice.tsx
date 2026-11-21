import { LOCALES } from '@soirely/domain';
import { useContext, useRef, useState } from 'react';
import { Pressable, StyleSheet, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';

import { chooseLanguage } from '../accountLanguage.ts';
import { currentLocale } from '../i18n/index.ts';
import { tokens } from '../theme/tokens.ts';
import { OnCover } from './Cover.tsx';
import { LanguageSheetBody } from './LanguageSheetBody.tsx';
import { Sheet } from './Sheet.tsx';
import { Text } from './Text.tsx';

/** The signed-out screens' language: the current one on a button, as dark glass on the cover, and the four in a sheet from the foot. */
export function LanguageChoice() {
  const onCover = useContext(OnCover);
  const { t } = useTranslation();
  const current = currentLocale();
  const [open, setOpen] = useState(false);
  const opener = useRef<ViewInstance>(null);
  const currentName = LOCALES.find((locale) => locale.code === current)?.nativeName ?? current;
  const close = () => setOpen(false);

  return (
    <>
      <Pressable
        ref={opener}
        style={[styles.button, onCover && styles.glass]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('language.label')}
        accessibilityValue={{ text: currentName }}
        testID="language.open"
      >
        <Globe ink={onCover ? tokens.colorInkOnDark : tokens.colorInk} />
        <Text
          size={tokens.typeButton.size}
          weight="medium"
          style={onCover ? styles.onCover : styles.ink}
        >
          {currentName}
        </Text>
        <Chevron ink={onCover ? tokens.colorInkOnDark : tokens.colorInkSecondary} />
      </Pressable>

      <Sheet
        open={open}
        onClose={close}
        scrimLabel={t('countryPicker.close')}
        opener={opener}
        headingTakesFocus
        testID="language.sheet"
      >
        <LanguageSheetBody
          words={{
            title: t('language.label'),
            line: t('language.follows'),
            done: t('countryPicker.close'),
            nameOf: (code) => t(`languageNames.${code}`),
          }}
          current={current}
          onClose={close}
          onChoose={(code) => {
            close();
            void chooseLanguage(code);
          }}
        />
      </Sheet>
    </>
  );
}

export function Globe({ ink }: { ink: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Circle cx={12} cy={12} r={9} stroke={ink} strokeWidth={1.75} />
      <Path
        d="M3 12h18M12 3c2.5 2.6 3.75 5.6 3.75 9S14.5 18.4 12 21c-2.5-2.6-3.75-5.6-3.75-9S9.5 5.6 12 3Z"
        stroke={ink}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function Chevron({ ink }: { ink: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path
        d="m6 9 6 6 6-6"
        stroke={ink}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    paddingHorizontal: tokens.spaceLg,
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    borderRadius: tokens.radiusPill,
    backgroundColor: tokens.colorCard,
  },
  glass: { borderColor: tokens.scrimDialog, backgroundColor: tokens.scrimDialog },
  ink: { color: tokens.colorInk },
  onCover: { color: tokens.colorInkOnDark },
});
