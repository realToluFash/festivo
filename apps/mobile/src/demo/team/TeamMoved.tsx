import { useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { SECTIONS, type SectionId, WAITER, placedOn } from '../queue/QueueModel.ts';
import { WaiterNext } from '../queue/QueueNext.tsx';
import { Glyph } from '../queue/QueueParts.tsx';
import {
  NOW,
  type TeamState,
  dishTrays,
  nameOf,
  seed,
  stationText,
  stationsOf,
  teamStateOf,
} from './TeamModel.ts';
import { Disc } from './TeamParts.tsx';

/** /demo/team-moved (sc-36034): the moved person's own screen, the waiter's Next from sc-36033 or a disher's station. */
export function TeamMovedRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = teamStateOf(params.state);
  const s = seed(state);

  return state === 'movedKitchen' ? (
    <Station key={state} s={s} />
  ) : (
    <WaiterNext key={state} first={placedOn(sectionsOf(s), s.lines[WAITER] ?? '')} />
  );
}

function sectionsOf(s: TeamState): SectionId[] {
  return stationsOf(s, WAITER).filter((id): id is SectionId => SECTIONS.some((x) => x.id === id));
}

function Frame({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          style={styles.back}
          testID="moved.back"
        >
          <Text size={15} weight="semibold" style={styles.accent}>
            Back
          </Text>
        </Pressable>
        {children}
      </ScrollView>
    </View>
  );
}

function MovedLine({ words }: { words: string }) {
  useReadOut(words);

  return words === '' ? null : (
    <View style={styles.line} testID="moved.line">
      <Glyph paths={['M5 12h14', 'm12 5 7 7-7 7']} ink={tokens.colorAccentText} side={15} />
      <Text size={15} weight="semibold" style={styles.accent}>
        {words}
      </Text>
    </View>
  );
}

function Station({ s }: { s: TeamState }) {
  const who = s.disher;
  const { stations, trays } = dishTrays(s, who);
  const two = stations.length > 1;

  return (
    <Frame>
      <Text size={30} weight="bold" accessibilityRole="header">
        {stations.length > 0 ? stationText(stations) : 'On no station'}
      </Text>
      <Text size={15} weight="medium" style={styles.secondary}>
        {who}
        {two ? ' · two stations' : ''} · Live · updated {NOW}
      </Text>
      <MovedLine words={s.lines[who] ?? ''} />
      <View style={styles.card}>
        {trays.map((t, i) => (
          <View key={`${t.table}|${t.station}`} style={[styles.row, i > 0 && styles.rowSep]}>
            <Disc name={t.who} />
            <View style={styles.grow}>
              <Text size={16} weight="semibold">
                {t.who} · {t.table}
              </Text>
              {two && (
                <Text size={14} weight="bold" style={styles.accent}>
                  {nameOf(t.station)}
                </Text>
              )}
              <Text size={14}>{t.items}</Text>
              <Text size={14} style={styles.secondary}>
                {t.when}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  body: { padding: tokens.spaceLg, gap: tokens.spaceLg },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  accent: { color: tokens.colorAccentText },
  secondary: { color: tokens.colorInkSecondary },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceXs,
    padding: tokens.spaceMd,
    borderRadius: tokens.radiusRow,
    backgroundColor: tokens.colorAccentTint,
  },
  card: {
    padding: tokens.spaceLg,
    gap: 4,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spaceMd,
    minHeight: 56,
    paddingVertical: 8,
  },
  rowSep: { borderTopWidth: 1, borderTopColor: tokens.colorBorder },
  grow: { flex: 1, minWidth: 0, gap: 2 },
});
