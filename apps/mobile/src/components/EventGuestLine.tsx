import { type Choice, guestLineOf } from '@soirely/domain';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { Shown } from '../kit/eventsList.ts';
import { tokens } from '../theme/tokens.ts';
import { Text } from './Text.tsx';

/** sc-3786: under the event's card or row, beside its link and never inside it, each figure its own link into the event's Guests. */
export function EventGuestLine({
  event,
  inset,
  onOpen,
}: {
  event: Shown;
  inset: number;
  onOpen: (filter: Choice) => void;
}) {
  const { t } = useTranslation();
  const figures = guestLineOf(event.guests ?? null, event.phase);
  if (figures == null) return null;

  const coming = t('guestList.countComing', { count: figures.coming });
  const notReplied = t('guestList.havent', { count: figures.notReplied });

  return (
    <View style={[styles.line, { marginLeft: inset }]} testID={`events.line.${event.id}`}>
      <FigureLink
        words={coming}
        name={t('eventsScreen.comingOpens', { figure: coming, event: event.name })}
        onPress={() => onOpen('coming')}
        testID={`events.line.${event.id}.coming`}
      />
      <Text
        size={14}
        weight="medium"
        style={styles.secondary}
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        ·
      </Text>
      <FigureLink
        words={notReplied}
        name={t('eventsScreen.notRepliedOpens', { figure: notReplied, event: event.name })}
        onPress={() => onOpen('noReply')}
        testID={`events.line.${event.id}.notReplied`}
      />
    </View>
  );
}

function FigureLink({
  words,
  name,
  onPress,
  testID,
}: {
  words: string;
  name: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={name}
      style={({ pressed }) => [styles.figureLink, pressed && styles.pressed]}
      testID={testID}
    >
      <Text size={14} weight="semibold" accessible={false} style={[styles.accent, styles.figures]}>
        {words}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: tokens.spaceXs },
  figureLink: { minHeight: tokens.sizeHit, justifyContent: 'center' },
  pressed: { opacity: tokens.opacityPressed },
});
