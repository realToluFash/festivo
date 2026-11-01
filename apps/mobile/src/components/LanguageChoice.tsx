import { LOCALES } from '@soirely/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { chooseLanguage } from '../accountLanguage.ts';
import { currentLocale } from '../i18n/index.ts';
import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

export function LanguageChoice() {
  const { t } = useTranslation();
  const current = currentLocale();

  return (
    <View style={styles.row}>
      <Text size={tokens.typeSmall.size} style={styles.label}>
        {t('language.label')}
      </Text>
      {LOCALES.map((locale) => {
        const chosen = locale.code === current;

        return (
          <Pressable
            key={locale.code}
            style={[styles.chip, chosen ? styles.chipChosen : styles.chipPlain]}
            onPress={() => void chooseLanguage(locale.code)}
            accessibilityRole="button"
            accessibilityState={{ selected: chosen }}
            accessibilityLabel={locale.nativeName}
            accessibilityLanguage={locale.code}
          >
            <Text size={tokens.typeButton.size} weight="semibold" style={styles.chipText}>
              {locale.nativeName}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: tokens.spaceXs,
  },
  label: { marginRight: tokens.spaceXxs, color: tokens.colorInkSecondary },
  chip: {
    minHeight: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg,
    paddingVertical: tokens.spaceXxs,
    borderRadius: tokens.radiusPill,
  },
  chipPlain: {
    borderWidth: 1,
    borderColor: tokens.colorControlBorder,
    backgroundColor: tokens.colorCard,
  },
  chipChosen: {
    borderWidth: 2,
    borderColor: tokens.colorAccent,
    backgroundColor: tokens.colorAccentTint,
  },
  chipText: { color: tokens.colorInk },
});
