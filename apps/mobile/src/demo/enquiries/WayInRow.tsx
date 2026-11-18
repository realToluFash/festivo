import { type Href, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { WAY_IN_WORDS } from './WayInModel.ts';

/** Events' way into Enquiries, under its title block: one row, the whole of it the target. */
export function WayInRow() {
  const { i18n } = useTranslation();
  const words = WAY_IN_WORDS[i18n.language === 'fr' ? 'fr' : 'en'];

  return (
    <Pressable
      onPress={() => router.push('/demo/enquiries' as Href)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={words}
      testID="events.enquiries"
    >
      <Glyph name="chat" size={20} ink={tokens.colorInkSecondary} />
      <Text size={17} weight="semibold" style={styles.grow} accessible={false}>
        {words}
      </Text>
      <Glyph name="chevron" size={18} ink={tokens.colorInkSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: tokens.sizeHitPhoneHero,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    paddingHorizontal: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    backgroundColor: tokens.colorCard,
  },
  grow: { flex: 1, minWidth: 0 },
  pressed: { opacity: tokens.opacityPressed },
});
