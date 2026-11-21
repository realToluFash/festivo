import { LOCALES } from '@soirely/domain';
import { useContext, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';

import { OnCover } from '../../components/Cover.tsx';
import { Chevron, Globe } from '../../components/LanguageChoice.tsx';
import { LanguageSheetBody, type LanguageSheetWords } from '../../components/LanguageSheetBody.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { Text } from '../../components/Text.tsx';
import { currentLocale } from '../../i18n/index.ts';
import { tokens } from '../../theme/tokens.ts';
import { languageStart } from './languageSheetModel.ts';

/** The signed-out screens' language button and its sheet, as LanguageChoice draws them. The demo keeps the choice to itself: nothing is saved and the app's language stays as it was. */
export function DemoLanguageChoice({ state }: { state?: string | undefined }) {
  const start = useMemo(() => languageStart(state), [state]);
  const onCover = useContext(OnCover);
  const { i18n } = useTranslation();
  const [locale, setLocale] = useState(start.locale ?? currentLocale());
  const [open, setOpen] = useState(start.open);
  const opener = useRef<ViewInstance>(null);
  const t = useMemo(() => i18n.getFixedT(locale), [i18n, locale]);
  const words: LanguageSheetWords = {
    title: t('language.label'),
    line: t('language.follows'),
    done: t('countryPicker.close'),
    nameOf: (code) => t(`languageNames.${code}`),
  };
  const currentName = LOCALES.find((one) => one.code === locale)?.nativeName ?? locale;
  const close = () => setOpen(false);

  return (
    <>
      <Pressable
        ref={opener}
        style={[styles.button, onCover && styles.glass]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={words.title}
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
        scrimLabel={words.done}
        opener={opener}
        headingTakesFocus
        testID="language.sheet"
      >
        <LanguageSheetBody
          words={words}
          current={locale}
          forceUnder={start.doneUnder}
          onClose={close}
          onChoose={(code) => {
            close();
            setLocale(code);
          }}
        />
      </Sheet>
    </>
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
