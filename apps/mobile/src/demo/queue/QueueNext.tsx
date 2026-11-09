import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '../../components/Buttons.tsx';
import { PageToast } from '../../components/Summary.tsx';
import { Text } from '../../components/Text.tsx';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import {
  LEAD,
  type QueueState,
  WAITER,
  andList,
  isServed,
  move,
  queueStateOf,
  sectionOf,
  seed,
  startTray,
  waiterNext,
  waiterSections,
} from './QueueModel.ts';
import { FlagLine, Glyph } from './QueueParts.tsx';

export function QueueNextRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = queueStateOf(params.state);

  return <WaiterNext key={state} start={state} />;
}

function WaiterNext({ start }: { start: ReturnType<typeof queueStateOf> }) {
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<QueueState>(() => seed(start));
  const [tab, setTab] = useState<'next' | 'floor'>('next');
  const next = waiterNext(s);
  const p = next == null ? null : s.places[next.place];
  const moved = p != null && s.moved?.place === next?.place && p.trayOf === '';
  const tablesLine = s.queues.A.length === 1 ? '1 table,' : `${s.queues.A.length} tables,`;
  const head = `${s.asWell ? 'Section A, and Section B as well' : 'Section A'} · Mains · ${WAITER}`;

  function lead(change: (x: QueueState) => QueueState): void {
    setS((x) => change({ ...x, waiterToast: '' }));
  }

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          style={styles.back}
          testID="next.back"
        >
          <Text size={15} weight="semibold" style={styles.accent}>
            Back
          </Text>
        </Pressable>
        <Text size={30} weight="bold" accessibilityRole="header">
          {tab === 'next' ? 'Next' : 'Floor'}
        </Text>
        <Text size={15} weight="medium" style={styles.secondary}>
          {tab === 'next' ? head : `Section A · ${tablesLine} in the queue’s order`}
        </Text>
        {tab === 'next' ? (
          next == null || p == null ? (
            <Text size={15} style={styles.secondary}>
              Nothing to serve in {andList(waiterSections(s).map((id) => sectionOf(id).name))}.
            </Text>
          ) : (
            <View style={styles.card}>
              <View style={styles.kickerRow}>
                <Text size={13} weight="semibold" style={styles.kicker}>
                  NEXT TRAY
                </Text>
                {next.owed && (
                  <View style={styles.owed}>
                    <Glyph paths={['M12 7v5l3 2']} circle ink={tokens.colorInk} side={13} />
                    <Text size={13} weight="semibold">
                      Owed
                    </Text>
                  </View>
                )}
              </View>
              <Text size={30} weight="bold">
                {next.place}
              </Text>
              {moved && s.moved != null && (
                <View style={styles.moved}>
                  <Glyph
                    paths={['M12 19V5', 'm5 12 7-7 7 7']}
                    ink={tokens.colorAccentText}
                    side={15}
                  />
                  <Text size={15} weight="semibold" style={styles.accent}>
                    Moved up by {s.moved.by}
                  </Text>
                </View>
              )}
              <Text size={15} style={styles.secondary}>
                {[
                  s.asWell ? sectionOf(next.section).name : '',
                  next.owed
                    ? `${p.owed === 1 ? '1 plate owed' : `${p.owed} plates owed`} since ${p.owedAt}`
                    : `${Math.min(3, p.toServe)} plates`,
                  `${p.served} of ${p.total} served`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              {p.flag !== '' && <FlagLine flag={p.flag} />}
              <PrimaryButton
                label="Start tray"
                onPress={() => setS(startTray(s))}
                testID="next.start"
              />
            </View>
          )
        ) : (
          <View style={styles.card}>
            {s.queues.A.map((name, i) => {
              const place = s.places[name];
              if (place == null) return null;
              const all = isServed(place);
              const isMoved = s.moved?.place === name && place.trayOf === '';
              const word = all
                ? 'All served'
                : place.trayOf !== ''
                  ? 'Now'
                  : next?.place === name
                    ? 'Up next'
                    : 'Later';
              return (
                <View key={name} style={[styles.floorRow, i > 0 && styles.sep]}>
                  <View style={styles.grow}>
                    <Text size={16} weight="semibold">
                      {name}
                    </Text>
                    <Text size={14} style={isMoved ? styles.accent : styles.secondary}>
                      {`${isMoved && s.moved != null ? `Moved up by ${s.moved.by} · ` : ''}${place.served} of ${place.total} served`}
                    </Text>
                  </View>
                  <View
                    style={[styles.word, (word === 'Now' || word === 'Up next') && styles.wordOn]}
                  >
                    <Text size={13} weight="semibold">
                      {word}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <View style={styles.tabs} accessibilityRole="tablist">
          {(['next', 'floor'] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t }}
              style={[styles.tab, tab === t && styles.tabOn]}
              testID={`next.tab.${t}`}
            >
              <Text
                size={15}
                weight={tab === t ? 'bold' : 'semibold'}
                style={tab === t ? styles.accent : styles.secondary}
              >
                {t === 'next' ? 'Next' : 'Floor'}
              </Text>
            </Pressable>
          ))}
        </View>
        <DemoOnly title={`Demo only: what ${LEAD} does on her phone`}>
          <SecondaryButton
            label="Bring Table 5 forward"
            onPress={() => lead((x) => move(x, 'A', 'Table 5', 'front'))}
            testID="next.demo.front"
          />
          <SecondaryButton
            label="Move Row C up"
            onPress={() => lead((x) => move(x, 'A', 'Row C', 'up'))}
            testID="next.demo.up"
          />
          <SecondaryButton
            label="Start again"
            onPress={() => setS(seed(start))}
            testID="next.demo.reset"
          />
        </DemoOnly>
      </ScrollView>
      {s.waiterToast !== '' && (
        <PageToast
          words={s.waiterToast}
          onClose={() => setS((x) => ({ ...x, waiterToast: '' }))}
          bottom={Math.max(insets.bottom, tokens.spaceLg)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  body: { padding: tokens.spaceLg, gap: tokens.spaceMd, paddingBottom: 120 },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  accent: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  kicker: { color: tokens.colorInkSecondary, letterSpacing: 0.5 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm, flexWrap: 'wrap' },
  owed: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: tokens.colorInset,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  card: {
    padding: tokens.spaceLg,
    borderRadius: 22,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
    gap: 10,
  },
  moved: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  floorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: 64,
    paddingVertical: 10,
  },
  sep: { borderTopWidth: 1, borderTopColor: tokens.colorBorder },
  grow: { flex: 1, minWidth: 0, gap: 3 },
  word: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: tokens.colorInset,
    justifyContent: 'center',
  },
  wordOn: { backgroundColor: tokens.colorAccentTint },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 6,
    borderRadius: 32,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  tab: { flex: 1, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: tokens.colorAccentTint },
});
