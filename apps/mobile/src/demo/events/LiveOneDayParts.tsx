import { type MarkedMilestone, milestoneMoment, namesZone } from '@soirely/domain';
import { type ReactNode, useState } from 'react';
import { PixelRatio, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { QuietButton } from '../../components/Buttons.tsx';
import { Arrived } from '../../components/Skeleton.tsx';
import { Text } from '../../components/Text.tsx';
import { cardFrame } from '../../components/cardFrame.ts';
import { dateLocale } from '../../i18n/index.ts';
import { distanceWords } from '../../kit/distanceWords.ts';
import { SMALL_LINE, TITLE_LINE, rowsFloor } from '../../layout/textSize.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { tokens } from '../../theme/tokens.ts';
import type { ComingUpShows } from './LiveOneDay.ts';

const HIDDEN = { accessibilityElementsHidden: true, importantForAccessibility: 'no' } as const;

const UNSEEN = {
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
} as const;

/** The card with no step keeps the height it has with one, measured from the same card with its finished step, unseen, so nothing below moves when the step comes back. */
export function KeepsHeight({
  footed,
  children,
}: {
  footed: ReactNode;
  children: (height: number | undefined) => ReactNode;
}) {
  const [height, setHeight] = useState<number>();

  return (
    <View>
      <View
        style={styles.unseen}
        pointerEvents="none"
        onLayout={(event) => setHeight(event.nativeEvent.layout.height)}
        {...UNSEEN}
      >
        {footed}
      </View>
      {children(height)}
    </View>
  );
}

function readerZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Main's Coming up, with the end as Today's live cover says it in place of the finished sentence while the event is on: no ✓, and the inset, heading and rows' height as they are (sc-93858). */
export function ComingUpPart({
  shows,
  timeZone,
  now,
  onAllDates,
}: {
  shows: ComingUpShows;
  timeZone: string;
  now: Date;
  onAllDates: () => void;
}) {
  const { t } = useTranslation();
  const { kind } = useLayout();
  const { fontScale } = useWindowDimensions();

  return (
    <View style={cardFrame(kind)} testID="timeline.comingUp">
      <View style={styles.head}>
        <Text size={tokens.typeTitleSection.size} weight="bold" accessibilityRole="header">
          {t('timeline.comingUp')}
        </Text>
        <QuietButton
          label={t('timeline.allDates')}
          onPress={onAllDates}
          testID="timeline.allDates"
        />
      </View>
      <View
        style={{
          minHeight: rowsFloor(fontScale, Platform.OS === 'android' ? PixelRatio.get() : null),
        }}
      >
        {shows.kind === 'ends' && (
          <View style={styles.inset} testID="timeline.endsToday">
            <Text size={tokens.typeBodyPhone.size} muted style={styles.insetWords}>
              {t('todayScreen.endsToday', { time: shows.time })}
            </Text>
          </View>
        )}
        {shows.kind === 'finished' && (
          <View style={styles.inset} testID="timeline.finished">
            <Text size={tokens.typeBodyPhone.size} muted {...HIDDEN}>
              {tokens.marks.done.glyph}
            </Text>
            <Text size={tokens.typeBodyPhone.size} muted style={styles.insetWords}>
              {t('timeline.finished')}
            </Text>
          </View>
        )}
        {shows.kind === 'rows' && (
          <Arrived>
            {shows.rows.map((marked, index) => (
              <Row key={index} marked={marked} timeZone={timeZone} now={now} first={index === 0} />
            ))}
          </Arrived>
        )}
      </View>
    </View>
  );
}

function Row({
  marked,
  timeZone,
  now,
  first,
}: {
  marked: MarkedMilestone;
  timeZone: string;
  now: Date;
  first: boolean;
}) {
  const { t } = useTranslation();
  const { milestone, nextUp } = marked;
  const moment = milestoneMoment(milestone.at, timeZone, now, dateLocale());
  const when = namesZone(timeZone, readerZone())
    ? t('timeline.momentInZone', { moment, timeZone })
    : moment;

  return (
    <View style={[styles.row, !first && styles.rowDivider]} testID="timeline.row">
      <Text size={tokens.typeSmall.size} muted style={styles.smallLine}>
        {`${when} · ${distanceWords(t, milestone.at, timeZone, now)}`}
      </Text>
      <Text size={tokens.typeRowTitle.size} weight="semibold" style={styles.titleLine}>
        {milestone.title}
      </Text>
      <View style={styles.marks}>
        <View style={[styles.pill, styles.quiet]}>
          <Text
            size={tokens.typeSmall.size}
            style={[styles.smallLine, styles.quietInk]}
            {...HIDDEN}
          >
            ▦
          </Text>
          <Text
            size={tokens.typeSmall.size}
            weight="semibold"
            style={[styles.smallLine, styles.quietInk]}
          >
            {t('timeline.owner_event')}
          </Text>
        </View>
        {nextUp && (
          <View style={[styles.pill, styles.accent]}>
            <Text
              size={tokens.typeSmall.size}
              weight="semibold"
              style={[styles.smallLine, styles.accentInk]}
            >
              {t('timeline.nextUp')}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  unseen: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0 },
  head: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spaceSm,
  },
  inset: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceSm,
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
  },
  insetWords: { flex: 1 },
  row: { gap: tokens.spaceXxs, paddingVertical: tokens.spaceMd },
  rowDivider: { borderTopWidth: 1, borderTopColor: tokens.colorInsetBorder },
  smallLine: { lineHeight: SMALL_LINE },
  titleLine: { lineHeight: TITLE_LINE },
  marks: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spaceXs },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXxs,
    paddingHorizontal: tokens.spaceSm,
    paddingVertical: tokens.spaceXxs,
    borderRadius: tokens.radiusPill,
  },
  quiet: { backgroundColor: tokens.colorInset },
  quietInk: { color: tokens.colorInkSecondary },
  accent: { backgroundColor: tokens.colorAccentTint },
  accentInk: { color: tokens.colorAccentText },
});
