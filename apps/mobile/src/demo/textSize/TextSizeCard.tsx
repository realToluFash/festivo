import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CARD_PIECES, Confetti, Cover } from '../../components/Cover.tsx';
import { Glyph } from '../../components/Glyph.tsx';
import { Text } from '../../components/Text.tsx';
import { Glass } from '../../components/TodayCover.tsx';
import { breakableEmail } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';
import { cardTileShown } from './textSizeRules.ts';

const CARD = { height: 148, avatar: 60, name: 22, mail: 15, role: 13, radius: 26 } as const;

/** The Settings card on a phone as proposed: the tile gives way at the accessibility sizes, the email breaks after its @, the pill grows. */
export function TextSizeCard({
  scale,
  name,
  initials,
  email,
  organisation,
}: {
  scale: number;
  name: string;
  initials: string;
  email: string;
  organisation: string;
}) {
  const { t } = useTranslation();
  const role = t('settings.personRole', { role: t('roles.owner'), organisation });

  return (
    <View
      style={[styles.card, { minHeight: CARD.height, borderRadius: CARD.radius }]}
      accessible
      accessibilityLabel={t('settings.personLabelWithRole', {
        name,
        email,
        role: t('roles.owner'),
        organisation,
      })}
      testID="demo.textSize.card"
    >
      <View style={[StyleSheet.absoluteFill, styles.clip]}>
        <Cover shade="side" pieces={[]} />
        <Confetti pieces={CARD_PIECES} scale={1} />
      </View>
      {cardTileShown(scale) && (
        <View style={styles.avatar} testID="demo.textSize.tile">
          <Text
            size={Math.round(CARD.avatar * 0.36)}
            weight="bold"
            allowFontScaling={false}
            accessible={false}
            style={styles.accent}
          >
            {initials}
          </Text>
        </View>
      )}
      <View style={styles.words}>
        <Text
          size={CARD.name * scale}
          weight="bold"
          allowFontScaling={false}
          accessible={false}
          style={[styles.white, styles.tight]}
        >
          {name}
        </Text>
        <Text
          size={CARD.mail * scale}
          weight="medium"
          allowFontScaling={false}
          accessible={false}
          style={styles.white}
        >
          {breakableEmail(email)}
        </Text>
        <Glass height={28} grows style={styles.role}>
          <Text
            size={CARD.role * scale}
            weight="semibold"
            allowFontScaling={false}
            accessible={false}
            style={styles.white}
            testID="demo.textSize.role"
          >
            {role}
          </Text>
        </Glass>
      </View>
      <Glass height={36} style={styles.chevron}>
        <Glyph name="chevron" size={18} ink={tokens.colorInkOnDark} weight={2.4} />
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXl,
    paddingVertical: tokens.spaceXl,
    paddingLeft: tokens.spaceXxl,
    paddingRight: tokens.spaceXl,
  },
  clip: { borderRadius: CARD.radius, overflow: 'hidden' },
  avatar: {
    width: CARD.avatar,
    height: CARD.avatar,
    borderRadius: CARD.avatar / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorInkOnDark,
  },
  accent: { color: tokens.colorAccent },
  white: { color: tokens.colorInkOnDark },
  tight: { letterSpacing: -0.3 },
  words: { flex: 1, minWidth: 0, gap: 3, alignItems: 'flex-start' },
  role: { marginTop: tokens.spaceXs, paddingHorizontal: 11, paddingVertical: 5 },
  chevron: { width: 36, justifyContent: 'center' },
});
