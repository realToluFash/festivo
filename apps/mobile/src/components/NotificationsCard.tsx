import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { tokens } from '../theme/tokens.ts';
import { useCardWords } from './Cover.tsx';
import { CardGlyph, CardSays, OnCard, SummaryCard } from './Summary.tsx';

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
  const blockedLine = t('notificationSettings.pushBlocked');
  const words = useCardWords(blocked ? blockedLine : null);

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
          <CardSays text={says} size={size} heading besideGlyph testID="notifications.says" />
          <OnCard text={counts} />
        </View>
      </View>
      {blocked && (
        <View style={styles.line} onLayout={words.onLine}>
          <OnCard text={blockedLine} strong />
        </View>
      )}
    </SummaryCard>
  );
}

const styles = StyleSheet.create({
  face: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  words: { flexShrink: 1, minWidth: 0, gap: tokens.spaceHair },
  line: { alignSelf: 'flex-start' },
});
