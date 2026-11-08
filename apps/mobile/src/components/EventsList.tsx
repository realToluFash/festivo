import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LIST_TABS, type ListTab, TAB_WORD, tabWidths } from '../kit/eventsList.ts';
import { tokens } from '../theme/tokens.ts';
import { Cover } from './Cover.tsx';
import { CardPieces } from './EventCard.tsx';
import { Glyph } from './Glyph.tsx';
import { Notice } from './Notice.tsx';
import { useReadOut } from './ReadOut.tsx';
import { CardSays, StepButton, SummaryCard } from './Summary.tsx';
import { Row, RowList } from './SummaryRows.tsx';
import { Text } from './Text.tsx';

const CELL_PAD = 12;
const TRACK_PAD = 3;
const TAB_GAP = 2;

const FIRST_RUN_STEPS = [
  'eventsScreen.firstRunStepName',
  'eventsScreen.firstRunStepDefaults',
  'eventsScreen.firstRunStepOpen',
] as const;

/** Upcoming, Drafts and Past as one segment: the lit tab white with a tick, each with its count. */
export function EventsTabs({
  tab,
  counts,
  onTab,
}: {
  tab: ListTab;
  counts: Record<ListTab, number>;
  onTab: (tab: ListTab) => void;
}) {
  const { t } = useTranslation();
  // Yoga neither keeps a tab's min-content width nor shares the rest as CSS does, so the tabs are sized here,
  // from copies no tab squeezes.
  const [words, setWords] = useState<Partial<Record<ListTab, number>>>({});
  const [track, setTrack] = useState<number>();
  const mins = LIST_TABS.map((each) => words[each]);
  const sized =
    track != null && mins.every((w) => w != null)
      ? tabWidths(
          track - 2 * TRACK_PAD - (LIST_TABS.length - 1) * TAB_GAP,
          mins.map((w) => (w ?? 0) + 2 * CELL_PAD),
        )
      : undefined;

  return (
    <View
      style={styles.segment}
      accessibilityRole="tablist"
      onLayout={(event) => setTrack(event.nativeEvent.layout.width)}
    >
      {LIST_TABS.map((each, i) => {
        const on = each === tab;
        const width = sized?.[i];

        return (
          <Pressable
            key={each}
            onPress={() => onTab(each)}
            style={[
              styles.cell,
              width != null && {
                flexBasis: width,
                minWidth: width,
                maxWidth: width,
                flexGrow: 0,
                flexShrink: 0,
              },
              on && styles.cellOn,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${t(TAB_WORD[each])}, ${counts[each]}`}
            testID={`events.tab.${each}`}
          >
            <TabWords tab={each} on={on} count={counts[each]} />
          </Pressable>
        );
      })}
      <View
        style={styles.tabMeasures}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {LIST_TABS.map((each) => (
          <View
            key={each}
            style={styles.tabMeasure}
            onLayout={(event) => {
              const width = Math.ceil(event.nativeEvent.layout.width);
              setWords((was) => (was[each] === width ? was : { ...was, [each]: width }));
            }}
          >
            <TabWords tab={each} on={each === tab} count={counts[each]} />
          </View>
        ))}
      </View>
    </View>
  );
}

function TabWords({ tab, on, count }: { tab: ListTab; on: boolean; count: number }) {
  const { t } = useTranslation();
  const ink = on ? tokens.colorAccentText : tokens.colorInkSecondary;
  const weight = on ? 'semibold' : 'medium';

  return (
    <View style={styles.tabContent}>
      {on && <Glyph name="tick" size={14} ink={tokens.colorAccent} weight={2.6} />}
      <View style={styles.tabWords}>
        <Text
          size={14.5}
          weight={weight}
          numberOfLines={1}
          accessible={false}
          style={{ color: ink }}
        >
          {t(TAB_WORD[tab])}
        </Text>
        <Text size={14.5} weight={weight} accessible={false} style={[{ color: ink }, styles.count]}>
          {String(count)}
        </Text>
      </View>
    </View>
  );
}

/** No events yet: the cover card that starts the first one, or the ask-an-owner Notice under it, then the three steps. */
export function EventsFirstRun({
  wide,
  onCreate,
}: {
  wide: boolean;
  /** Absent for a role without Create events, which reads where events will come from. */
  onCreate: (() => void) | undefined;
}) {
  const { t } = useTranslation();

  return (
    <>
      <SummaryCard
        size={wide ? 'wide' : 'page'}
        height={200}
        backdrop={
          <>
            <Cover shade="side" pieces={[]} />
            <CardPieces />
          </>
        }
        testID="events.firstRun"
      >
        <CardSays text={t('eventsScreen.firstRunTitle')} size={wide ? 28 : 24} heading />
        {onCreate != null && (
          <View style={styles.cardFoot}>
            <StepButton
              label={t('eventsScreen.firstRunCreate')}
              onPress={onCreate}
              testID="events.none.new"
            />
          </View>
        )}
      </SummaryCard>
      {onCreate == null && (
        <Notice
          tone="quiet"
          mark={tokens.marks.info.glyph}
          body={t('eventsScreen.firstRunAskOwner')}
        />
      )}
      <RowList
        items={FIRST_RUN_STEPS.map((step, index) => ({
          key: step,
          inset: 52,
          row: <Row title={t(step)} lead={<StepTile n={index + 1} />} />,
        }))}
      />
    </>
  );
}

function StepTile({ n }: { n: number }) {
  return (
    <View
      style={styles.stepTile}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text size={16} weight="bold" accessible={false} style={[styles.accent, styles.figures]}>
        {String(n)}
      </Text>
    </View>
  );
}

/** A line in the list's quiet voice, as its footer and More shown are. */
export function SaidLine({ words, testID }: { words: string; testID?: string }) {
  return (
    <Text
      size={14}
      weight="medium"
      style={[styles.secondary, styles.figures, styles.said]}
      testID={testID}
    >
      {words}
    </Text>
  );
}

/** A line the screen reader says as it appears. */
export function Said({ words }: { words: string }) {
  useReadOut(words);

  return <SaidLine words={words} />;
}

/** The line under Events' title, in the list's quiet voice. */
export function EventsSummaryLine({ words }: { words: string }) {
  return (
    <Text
      size={15}
      weight="medium"
      style={[styles.secondary, styles.figures, styles.summary]}
      testID="events.summary"
    >
      {words}
    </Text>
  );
}

const styles = StyleSheet.create({
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  figures: { fontVariant: ['tabular-nums'] },
  said: { lineHeight: 14 * 1.45 },
  summary: { marginTop: tokens.spaceHair, lineHeight: 15 * 1.45 },
  segment: {
    height: tokens.sizeHit,
    flexDirection: 'row',
    gap: TAB_GAP,
    padding: TRACK_PAD,
    borderRadius: 22,
    backgroundColor: tokens.colorInsetBorder,
  },
  cell: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    height: 38,
    paddingHorizontal: CELL_PAD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  cellOn: {
    backgroundColor: tokens.colorCard,
    shadowColor: tokens.colorInk,
    shadowOpacity: 0.12,
    shadowRadius: 1.5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tabContent: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabMeasures: { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0 },
  tabMeasure: { position: 'absolute', top: 0, left: 0 },
  count: { opacity: 0.8, fontVariant: ['tabular-nums'] },
  tabWords: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.spaceXxs },
  cardFoot: { marginTop: 'auto' },
  stepTile: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorAccentTint,
  },
});
