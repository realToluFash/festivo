import { StyleSheet, View } from 'react-native';

import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { WORDS } from './NotificationsModel.ts';
import { CardGlyph, OnCard, SummaryCard } from './Summary.tsx';

/** How you hear on Confetti: the bell, the channels and their counts, and a step only while this device blocks push. */
export function NotificationsCard({
  says,
  counts,
  blocked,
  wide,
  onSettings,
}: {
  says: string;
  counts: string;
  blocked: boolean;
  wide: boolean;
  onSettings: () => void;
}) {
  const face = wide ? 64 : 56;
  const size = wide ? 24 : 22;

  return (
    <SummaryCard
      size={wide ? 'wide' : 'page'}
      height={200}
      step={
        blocked
          ? { label: WORDS.openSettings, onPress: onSettings, testID: 'notifications.step' }
          : null
      }
      testID="notifications.card"
    >
      <View style={styles.face}>
        <CardGlyph name={blocked ? 'bellOff' : 'bell'} side={face} />
        <View style={styles.words}>
          <Text
            size={size}
            weight="bold"
            accessibilityRole="header"
            style={[
              styles.white,
              { lineHeight: Math.round(size * 1.15), letterSpacing: size * -0.015 },
            ]}
            testID="notifications.says"
          >
            {says}
          </Text>
          <OnCard text={counts} />
        </View>
      </View>
      {blocked && <OnCard text={WORDS.pushBlocked} strong />}
    </SummaryCard>
  );
}

const styles = StyleSheet.create({
  face: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  words: { flex: 1, minWidth: 0, gap: tokens.spaceHair },
  white: { color: tokens.colorInkOnDark },
});
