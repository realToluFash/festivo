import { LOCALES } from '@soirely/domain';
import { useContext, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type ViewInstance } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';

import { chooseLanguage } from '../accountLanguage.ts';
import { currentLocale } from '../i18n/index.ts';
import { tokens } from '../theme/tokens.ts';
import { OnCover } from './Cover.tsx';
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
        <View style={styles.heading}>
          <View style={styles.titles}>
            <Text size={tokens.typeTitleDialog.size} weight="bold" accessibilityRole="header">
              {t('language.label')}
            </Text>
            <Text size={tokens.typeBodyPhone.size} style={styles.secondary}>
              {t('language.follows')}
            </Text>
          </View>
          <Pressable
            style={styles.done}
            onPress={close}
            accessibilityRole="button"
            testID="language.done"
          >
            <Text size={tokens.typeButton.size} weight="semibold" style={styles.accent}>
              {t('countryPicker.close')}
            </Text>
          </Pressable>
        </View>
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {LOCALES.map((locale) => {
            const chosen = locale.code === current;
            const inCurrent = t(`languageNames.${locale.code}`);

            return (
              <Pressable
                key={locale.code}
                style={[styles.option, chosen && styles.optionChosen]}
                onPress={() => {
                  close();
                  void chooseLanguage(locale.code);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen }}
                accessibilityLabel={locale.nativeName}
                accessibilityLanguage={locale.code}
                testID={`language.${locale.code}`}
              >
                <View style={styles.optionWords}>
                  <Text size={tokens.typeButton.size} weight="semibold" style={styles.ink}>
                    {locale.nativeName}
                  </Text>
                  {inCurrent !== locale.nativeName && (
                    <Text size={tokens.typeSmall.size} style={styles.secondary}>
                      {inCurrent}
                    </Text>
                  )}
                </View>
                {chosen && <Tick />}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </>
  );
}

function Globe({ ink }: { ink: string }) {
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

function Chevron({ ink }: { ink: string }) {
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

function Tick() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" accessible={false}>
      <Path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke={tokens.colorAccent}
        strokeWidth={2.5}
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
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.space3xl,
    paddingTop: tokens.space3xl,
    paddingBottom: tokens.spaceLg,
  },
  titles: { flex: 1, gap: tokens.spaceXxs },
  done: { minHeight: tokens.sizeHit, justifyContent: 'center' },
  list: { flexGrow: 0 },
  listContent: { paddingHorizontal: tokens.spaceXl, paddingBottom: tokens.spaceXl },
  option: {
    minHeight: tokens.sizeHitPhonePrimary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
    paddingHorizontal: tokens.spaceLg,
    paddingVertical: tokens.spaceSm,
    borderRadius: tokens.radiusRow,
  },
  optionChosen: { backgroundColor: tokens.colorAccentTint },
  optionWords: { flex: 1, gap: tokens.spaceHair },
});
