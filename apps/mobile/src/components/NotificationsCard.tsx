import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { useCardWords } from './Cover.tsx';
import { CardGlyph, OnCard, SummaryCard } from './Summary.tsx';
import { Text } from './Text.tsx';

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
  const { t } = useTranslation();
  const face = wide ? 64 : 56;
  const size = wide ? 24 : 22;
  const words = useCardWords(blocked ? 'blocked' : null);

  return (
    <SummaryCard
      size={wide ? 'wide' : 'page'}
      height={200}
      words={words.boxes}
      step={
        blocked
          ? {
              label: t('notificationSettings.openSettings'),
              onPress: onSettings,
              testID: 'notifications.step',
            }
          : null
      }
      testID="notifications.card"
    >
      <View style={styles.face} onLayout={words.onArea}>
        <CardGlyph name={blocked ? 'bellOff' : 'bell'} side={face} />
        <View style={styles.words} onLayout={words.onWords}>
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
      {blocked && (
        <View style={styles.line} onLayout={words.onLine}>
          <OnCard text={t('notificationSettings.pushBlocked')} strong />
        </View>
      )}
    </SummaryCard>
  );
}

const styles = StyleSheet.create({
  face: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  words: { flexShrink: 1, minWidth: 0, gap: tokens.spaceHair },
  white: { color: tokens.colorInkOnDark },
  line: { alignSelf: 'flex-start' },
});
