import { LOCALES } from '@soirely/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { currentLocale, setLanguage } from '../i18n/index.ts';
import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

/**
 * Four languages as four chips, which is the design's answer on every screen
 * somebody reaches before signing in.
 *
 * On the page rather than behind a menu, because a reader who cannot read this
 * screen cannot find a menu called "Language" on it either. Each is named in
 * its own language: somebody looking for Português is not helped by a list
 * that says "Portuguese".
 */
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
            onPress={() => void setLanguage(locale.code)}
            accessibilityRole="button"
            accessibilityState={{ selected: chosen }}
            accessibilityLabel={locale.name}
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
    gap: tokens.spaceSm,
  },
  label: { marginRight: tokens.spaceXxs, color: tokens.colorInkSecondary },
  chip: {
    height: tokens.sizeHit,
    justifyContent: 'center',
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.sizeHit / 2,
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
