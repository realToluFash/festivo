import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '../../components/Buttons.tsx';
import { useReadOut } from '../../components/ReadOut.tsx';
import { Text } from '../../components/Text.tsx';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import {
  type NextRow,
  type NextState,
  carryOn,
  nextSeed,
  nextStateOf,
  plates,
} from './HowItsGoingModel.ts';
import { Chip, type ChipTone, PATHS, TabBar, type TabId, shared } from './HowItsGoingParts.tsx';

export function HowItsGoingNextRoute() {
  const params = useLocalSearchParams<{ state?: string }>();
  const state = nextStateOf(params.state);

  return <WaiterNext key={state} start={state} />;
}

const ROW_CHIP: Record<
  NextRow['kind'],
  { word: string; paths: readonly string[]; tone: ChipTone }
> = {
  inHand: { word: 'In hand', paths: PATHS.tray, tone: 'accent' },
  given: { word: 'Given to you', paths: PATHS.given, tone: 'accent' },
  owed: { word: 'Owed', paths: PATHS.clock, tone: 'plain' },
  offered: { word: 'Next tray', paths: PATHS.given, tone: 'plain' },
};

function WaiterNext({ start }: { start: ReturnType<typeof nextStateOf> }) {
  const insets = useSafeAreaInsets();
  const [s, setS] = useState<NextState>(() => nextSeed(start));
  const [tab, setTab] = useState<TabId>('next');
  const [presses, setPresses] = useState(0);
  const [note, setNote] = useState('');

  const heard = presses > 0 ? s.say : s.paused ? s.pausedLine : s.say;
  useReadOut(heard === '' ? null : heard, { answer: presses });

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.body}>
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          style={styles.back}
          testID="next.back"
        >
          <Text size={15} weight="semibold" style={shared.accent}>
            Back
          </Text>
        </Pressable>
        <Text size={30} weight="bold" accessibilityRole="header">
          {tab === 'next' ? 'Next' : 'Floor'}
        </Text>
        <Text size={15} weight="medium" style={shared.secondary}>
          {`Mains · ${s.waiter}`}
        </Text>
        {tab === 'floor' ? (
          <View style={shared.card}>
            <Text size={15} style={shared.secondary}>
              Floor is the waiter’s tables (sc-4021), unchanged here.
            </Text>
          </View>
        ) : (
          <>
            {s.refused !== '' && (
              <View accessibilityRole="alert" style={styles.refused}>
                <Text size={16} weight="semibold">
                  {s.refused}
                </Text>
                <Text size={14} style={shared.secondary}>
                  Your Next goes on to your next tray.
                </Text>
              </View>
            )}
            {s.rows.map((r, i) => {
              const chip = ROW_CHIP[r.kind];
              const paused = r.kind === 'inHand' && s.paused;
              return (
                <View
                  key={`${r.kind}.${r.table}`}
                  style={shared.card}
                  testID={`next.row.${r.kind}`}
                >
                  <View style={shared.wrap}>
                    <Chip word={chip.word} paths={chip.paths} tone={chip.tone} />
                    {paused && <Chip word="Paused" paths={PATHS.pause} tone="paused" />}
                  </View>
                  <Text size={i === 0 ? 26 : 20} weight="bold">
                    {`${r.table} · ${plates(r.plates)}`}
                  </Text>
                  {paused ? (
                    <>
                      <Text size={15} weight="semibold">
                        {s.pausedLine}
                      </Text>
                      <Text size={14} style={shared.secondary}>
                        {r.line}
                      </Text>
                      <PrimaryButton
                        label="Carry on"
                        onPress={() => {
                          setS(carryOn(s));
                          setPresses((n) => n + 1);
                        }}
                        testID="next.carryOn"
                      />
                    </>
                  ) : (
                    <Text size={15} weight={r.kind === 'given' ? 'semibold' : 'regular'}>
                      {r.line}
                    </Text>
                  )}
                  {r.kind === 'offered' && (
                    <PrimaryButton
                      label="Start the tray"
                      onPress={() => setNote('Starting a tray is sc-1361’s.')}
                      testID="next.start"
                    />
                  )}
                </View>
              );
            })}
            {note !== '' && (
              <Text size={14} style={shared.secondary}>
                {note}
              </Text>
            )}
          </>
        )}
        <DemoOnly title="Demo only: the board’s switches">
          <SecondaryButton
            label="Start again"
            onPress={() => {
              setS(nextSeed(start));
              setPresses(0);
              setNote('');
            }}
            testID="next.demo.reset"
          />
        </DemoOnly>
      </ScrollView>
      <TabBar
        tabs={['next', 'floor']}
        current={tab}
        onPick={setTab}
        bottom={Math.max(insets.bottom, tokens.spaceSm)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  body: { padding: tokens.spaceLg, gap: tokens.spaceMd, paddingBottom: tokens.spaceXl },
  back: { minHeight: tokens.sizeHit, justifyContent: 'center', alignSelf: 'flex-start' },
  refused: {
    padding: tokens.spaceMd,
    borderRadius: 12,
    backgroundColor: tokens.colorInset,
    gap: 4,
  },
});
