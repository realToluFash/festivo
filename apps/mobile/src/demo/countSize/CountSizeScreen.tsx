import { type EventsFilters, NO_EVENTS_FILTERS } from '@soirely/domain';
import { useMemo, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EventsResults } from '../../components/EventsSearch.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { useMeasuredAt } from '../../components/Title.tsx';
import { isTablet } from '../../layout/classify.ts';
import { countLineDrawn, countLineStarts } from '../../layout/countLineFit.ts';
import { LABEL_LINE, wordsIn } from '../../layout/textSize.ts';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { NavBar } from '../DemoScreen.tsx';
import { Choices } from '../focusedHeader/FocusedHeaderScreen.tsx';
import {
  FILTER_LANGUAGES,
  FILTER_SIZES,
  type FilterLanguage,
  type FilterSize,
  filterScale,
} from '../filterSize/filterSizeRules.ts';
import { frameTitleCap } from '../frameTitleCap.ts';
import { COUNT_FOUND, type CountFound, FOUND_COUNT } from './countSizeRules.ts';

export interface CountSizeStart {
  size: FilterSize;
  language: FilterLanguage;
  found: CountFound;
}

const A_TYPE: EventsFilters = { ...NO_EVENTS_FILTERS, types: ['party'] };

/** sc-75214: Events' count line at a stand-in text size, Clear filters under the count once the two cannot share a line. */
export function CountSizeScreen({ start }: { start: CountSizeStart }) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const layout = useLayout();
  const [size, setSize] = useState(start.size);
  const [language, setLanguage] = useState(start.language);
  const [found, setFound] = useState(start.found);
  const words = useMemo(
    () => i18n.cloneInstance({ lng: language, initAsync: false }),
    [i18n, language],
  );
  const scale = filterScale(size, fontScale);
  const cap = frameTitleCap(isTablet(layout.kind), Math.min(layout.width, layout.height), scale);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 40 }}
      >
        <NavBar />
        <I18nextProvider i18n={words}>
          <View style={styles.page}>
            <Text
              size={cap}
              weight="bold"
              allowFontScaling={false}
              accessibilityRole="header"
              style={{ lineHeight: Math.ceil(cap * tokens.typeTitleFrame.lineHeight) }}
            >
              {words.t('eventsScreen.title')}
            </Text>
            {found === 'none' ? (
              <EventsResults
                typed=""
                filters={A_TYPE}
                groups={[]}
                locale={language}
                onClearSearch={() => undefined}
                onClearFilters={() => setFound('unfiltered')}
              />
            ) : (
              <CountLine
                count={FOUND_COUNT[found]}
                filtered={found !== 'unfiltered'}
                scale={scale}
                cap={cap}
                onClear={() => setFound('unfiltered')}
              />
            )}
          </View>
        </I18nextProvider>
        <View style={styles.page}>
          <DemoOnly title="Stand-ins for the device’s text size, its language and what the filter found. The Events title draws at the size the frame gives it there, and the count line draws at the size chosen, no larger than the title. At AX1 to AX5, once the count and Clear filters cannot both sit whole on one line, Clear filters takes the line under the count, starting where the count starts. At the standard sizes the line is main’s. Nothing found is main’s screen at this device’s size. Clear filters shows the unfiltered count, as the app does. Nothing is sent and no string is added.">
            <Choices
              heading="Text size"
              options={FILTER_SIZES}
              chosen={size}
              onChoose={setSize}
              id="size"
              prefix="demo.countSize"
            />
            <Choices
              heading="Language"
              options={FILTER_LANGUAGES}
              chosen={language}
              onChoose={setLanguage}
              id="language"
              prefix="demo.countSize"
            />
            <Choices
              heading="Found"
              options={COUNT_FOUND}
              chosen={found}
              onChoose={setFound}
              id="found"
              prefix="demo.countSize"
            />
          </DemoOnly>
        </View>
      </ScrollView>
    </View>
  );
}

function CountLine({
  count,
  filtered,
  scale,
  cap,
  onClear,
}: {
  count: number;
  filtered: boolean;
  scale: number;
  cap: number;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const said = t('eventsSearch.count', { count });
  const clear = t('eventsSearch.clearFilters');
  const [room, setRoom] = useState(0);
  const starts = countLineStarts(scale, cap);
  const counted = useMeasuredAt(starts.count, [said, ...wordsIn([said])]);
  const cleared = useMeasuredAt(starts.clear, [clear, ...wordsIn([clear])]);
  const widest = (widths: (number | undefined)[]) => Math.max(0, ...widths.slice(1).map(Number));
  const ready =
    room > 0 && [...counted.widths, ...cleared.widths].every((width) => width !== undefined);
  const drawn = countLineDrawn({
    scale,
    cap,
    room,
    gap: tokens.spaceLg,
    count: filtered && ready ? (counted.widths[0] ?? 0) : 0,
    clear: filtered && ready ? (cleared.widths[0] ?? 0) : 0,
    countWidest: widest(counted.widths),
    clearWidest: widest(cleared.widths),
  });

  useReadOut(said);

  return (
    <View onLayout={(event) => setRoom(event.nativeEvent.layout.width)}>
      {counted.measure}
      {cleared.measure}
      <View
        style={[styles.countRow, drawn.stacked && styles.countStacked]}
        testID="demo.countSize.line"
      >
        <Text
          size={drawn.countSize}
          weight="semibold"
          allowFontScaling={false}
          style={[
            drawn.stacked ? styles.whole : styles.grow,
            styles.figures,
            { lineHeight: Math.ceil(drawn.countSize * LABEL_LINE) },
          ]}
          testID="demo.countSize.count"
        >
          {said}
        </Text>
        {filtered && count > 0 && (
          <Pressable
            onPress={onClear}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={clear}
            testID="demo.countSize.clear"
          >
            <Text
              size={drawn.clearSize}
              weight="semibold"
              allowFontScaling={false}
              accessible={false}
              style={[styles.on, { lineHeight: Math.ceil(drawn.clearSize * LABEL_LINE) }]}
            >
              {clear}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colorPage },
  page: { paddingHorizontal: tokens.spaceXl, paddingTop: tokens.spaceLg, gap: tokens.spaceLg },
  countRow: {
    minHeight: tokens.sizeHit,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceLg,
  },
  countStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 0 },
  grow: { flex: 1, minWidth: 0 },
  whole: { flexShrink: 1 },
  figures: { fontVariant: ['tabular-nums'] },
  action: {
    minHeight: tokens.sizeHit,
    minWidth: tokens.sizeHit,
    flexShrink: 1,
    justifyContent: 'center',
    paddingVertical: 11,
  },
  pressed: { opacity: tokens.opacityPressed },
  on: { color: tokens.colorAccentText },
});
