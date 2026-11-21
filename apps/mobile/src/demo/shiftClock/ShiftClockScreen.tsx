import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, QuietButton, SecondaryButton } from '../../components/Buttons.tsx';
import { Notice } from '../../components/Notice.tsx';
import { ShapeMark } from '../../components/StatusMark.tsx';
import { Text } from '../../components/Text.tsx';
import { useLayout } from '../../layout/useLayout.ts';
import { DemoOnly } from '../../steps/Lines.tsx';
import { tokens } from '../../theme/tokens.ts';
import { goBack } from '../DemoScreen.tsx';
import { clock, timeWords } from './clock.ts';
import {
  type Card,
  type ClockState,
  CW,
  EVENT,
  type Surface,
  cardOf,
  clockStateOf,
  limitOf,
  lineWords,
  opensWords,
  surfaceOf,
  tappedAgain,
} from './shiftClockModel.ts';
import { useClockCard } from './useClockCard.ts';

export function ShiftClockRoute() {
  const params = useLocalSearchParams<{ state?: string; surface?: string }>();
  const state = clockStateOf(params.state);
  const surface = surfaceOf(params.surface);

  return <ShiftClock key={`${state}|${surface}`} state={state} surface={surface} />;
}

function ShiftClock({ state, surface }: { state: ClockState; surface: Surface }) {
  const { c, setCard, busy, said, setSaid, press } = useClockCard(cardOf(state));
  const insets = useSafeAreaInsets();
  const { kind } = useLayout();
  const phone = kind === 'phone';
  const browser = surface === 'browser';
  const endedPage = browser && c.past && c.phase === 'off';

  const clockCard = <ClockCard c={c} busy={busy} said={said} browser={browser} onPress={press} />;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={[
        phone ? styles.bodyPhone : styles.bodyTablet,
        { paddingTop: insets.top + tokens.spaceSm, paddingBottom: insets.bottom + tokens.space3xl },
      ]}
      testID={`shiftClock.${state}`}
    >
      <View style={styles.column}>
        <QuietButton label="Back" onPress={goBack} testID="shiftClock.back" />
        {endedPage ? (
          <EndedPage c={c} said={said} />
        ) : (
          <>
            <Text size={tokens.typeTitlePhone.size} weight="bold" accessibilityRole="header">
              {EVENT}
            </Text>
            {clockCard}
            {!c.past && (
              <View style={styles.place} testID="shiftClock.place">
                <Text size={15} style={styles.secondary}>
                  {CW.place}
                </Text>
                <QuietButton
                  label={CW.openPage}
                  onPress={() => router.push('/demo/my-night')}
                  testID="shiftClock.myNight"
                />
              </View>
            )}
          </>
        )}
        <DemoOnly title="Demo only: the board’s switches">
          <SecondaryButton
            label={c.offline ? 'No connection · on' : 'No connection'}
            onPress={() => setCard({ ...c, offline: !c.offline })}
            testID="shiftClock.demo.offline"
          />
          {(c.phase === 'on' || c.phase === 'off') && (
            <SecondaryButton
              label={c.phase === 'on' ? 'Clock in again, from another phone' : 'Clock out again'}
              onPress={() => {
                setCard(tappedAgain(c));
                setSaid((n) => n + 1);
              }}
              testID="shiftClock.demo.again"
            />
          )}
          <SecondaryButton
            label="Start again"
            onPress={() => setCard(cardOf(state))}
            testID="shiftClock.demo.reset"
          />
        </DemoOnly>
      </View>
    </ScrollView>
  );
}

function StatusLine({ words, done }: { words: string; done: boolean }) {
  return (
    <View style={styles.status}>
      <ShapeMark kind={done ? 'yes' : 'notyet'} side={18} ink={tokens.colorAccent} />
      <Text size={17} weight="semibold" style={styles.shrink}>
        {words}
      </Text>
    </View>
  );
}

function TapLine({ c, said }: { c: Card; said: number }) {
  const words = lineWords(c);
  if (words == null) return null;
  const offline = c.line === 'offIn' || c.line === 'offOut';

  return (
    <View testID={`shiftClock.line.${c.line ?? ''}`}>
      <Notice
        tone={offline ? 'attention' : 'quiet'}
        mark={offline ? '!' : 'i'}
        body={words}
        answer={said}
      />
    </View>
  );
}

export function ClockCard({
  c,
  busy,
  said,
  browser,
  onPress,
}: {
  c: Card;
  busy: boolean;
  said: number;
  browser: boolean;
  onPress: () => void;
}) {
  const at = (minutes: number | null) => timeWords(minutes ?? 0, c.now);
  let body;

  if (c.phase === 'before')
    body = (
      <>
        <PrimaryButton
          label={opensWords()}
          onPress={() => undefined}
          off
          testID="shiftClock.opens"
        />
        <Text size={15} style={styles.secondary}>
          {CW.opensLine}
        </Text>
      </>
    );
  else if (c.phase === 'ready')
    body = (
      <>
        <TapLine c={c} said={said} />
        <PrimaryButton
          label={busy ? CW.clockingIn : CW.clockIn}
          busy={busy}
          onPress={onPress}
          testID="shiftClock.in"
        />
        <Text size={15} style={styles.secondary}>
          {CW.readyLine}
        </Text>
      </>
    );
  else if (c.phase === 'on')
    body = (
      <>
        <StatusLine words={CW.clockedInAt(at(c.clockIn))} done />
        <TapLine c={c} said={said} />
        <PrimaryButton
          label={busy ? CW.clockingOut : CW.clockOut}
          busy={busy}
          onPress={onPress}
          testID="shiftClock.out"
        />
        {c.past ? (
          browser && (
            <Text size={15} style={styles.secondary} testID="shiftClock.browserLine">
              {CW.browserOut(at(limitOf(c)))}
            </Text>
          )
        ) : (
          <Text size={15} style={styles.secondary}>
            {CW.stayLine(clock(c.end))}
          </Text>
        )}
      </>
    );
  else if (c.phase === 'off')
    body = c.past ? (
      <>
        <StatusLine words={CW.clockedOutAt(at(c.clockOut))} done />
        <TapLine c={c} said={said} />
      </>
    ) : (
      <>
        <StatusLine words={CW.inOut(at(c.clockIn), at(c.clockOut))} done />
        <Text size={15} weight="medium" style={styles.secondary}>
          {CW.recorded((c.clockOut ?? 0) - (c.clockIn ?? 0))}
        </Text>
        <TapLine c={c} said={said} />
        <Text size={15} style={styles.secondary}>
          {CW.helper}
        </Text>
      </>
    );
  else
    body = (
      <>
        <StatusLine words={CW.closedAt(clock(c.end))} done={false} />
        <Text size={15} weight="medium">
          {CW.closedLine}
        </Text>
      </>
    );

  return (
    <View style={styles.card} testID="shiftClock.card">
      {body}
    </View>
  );
}

/** Past access in a browser, once clocked out: the link's ended page, without the event's name. */
function EndedPage({ c, said }: { c: Card; said: number }) {
  return (
    <View style={styles.ended} testID="shiftClock.ended">
      <Text size={17} weight="bold" style={styles.accent}>
        Soirely
      </Text>
      <StatusLine words={CW.clockedOutAt(timeWords(c.clockOut ?? 0, c.now))} done />
      <TapLine c={c} said={said} />
      <Text size={tokens.typeTitlePhone.size} weight="bold" accessibilityRole="header">
        {CW.signedOut}
      </Text>
      <View style={styles.inset}>
        <Text size={15}>{CW.ended}</Text>
      </View>
      <Text size={15} style={styles.secondary}>
        {CW.nothingSaved}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colorPage },
  bodyPhone: { paddingHorizontal: tokens.spaceLg },
  bodyTablet: { paddingHorizontal: tokens.spaceXl, alignItems: 'center' },
  column: { width: '100%', maxWidth: 560, gap: tokens.spaceLg },
  place: { gap: tokens.spaceXs, alignItems: 'flex-start' },
  card: {
    gap: tokens.spaceMd,
    padding: tokens.spaceXl,
    borderRadius: tokens.radiusCardPhone,
    backgroundColor: tokens.colorCard,
    borderWidth: 1,
    borderColor: tokens.colorBorder,
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: tokens.spaceSm },
  ended: { gap: tokens.spaceLg, paddingTop: tokens.spaceXl },
  inset: {
    padding: tokens.spaceLg,
    borderRadius: tokens.radiusInset,
    backgroundColor: tokens.colorInset,
    borderWidth: 1,
    borderColor: tokens.colorInsetBorder,
  },
  secondary: { color: tokens.colorInkSecondary },
  accent: { color: tokens.colorAccentText },
  shrink: { flexShrink: 1 },
});
